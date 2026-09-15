import * as Phaser from 'phaser';
import type {
  AuthoredCharacterRig,
  SocketName,
} from '../../../lib/arena/engine/characters/CharacterRig';
import { REST, type PuppetPose } from '../../../lib/arena/puppet-motion';
import { animation } from '../../../lib/arena/engine/animation/AnimationRegistry';
import { NativeFactory, type NativeArmature } from '../NativeFactory';
import { NativeMesh } from '../NativeMesh';
import { validateExport } from '../validate-export';
import type { WeightedRigDefinition } from './RigDefinition';
import { dragonBones as db } from '../vendor/dragonBones';

type ExportClip = {
  name: string;
  duration: number;
  frame?: { duration: number; events?: { name: string; bone?: string }[] }[];
};

const SOCKETS: Record<SocketName, string> = {
  throwingHand: 'throwing_hand',
  offHand: 'off_hand',
  head: 'skull_center',
  chest: 'chest',
  waist: 'pelvis',
  footL: 'foot_L',
  footR: 'foot_R',
  effect: 'chest',
};

/** Main-Lab adapter for verified weighted character definitions. No paper pose is applied
 * to this mesh. Authored bones/weights/IK are sampled by the recording clock. */
export class WeightedMatchRig implements AuthoredCharacterRig {
  readonly continuousThrow = true;
  readonly backend = 'loongbones-weighted';
  readonly root: Phaser.GameObjects.Container;
  private factory: NativeFactory;
  private actor: NativeArmature;
  private shadow: Phaser.GameObjects.Graphics;
  private clips: Map<string, ExportClip>;
  private frameRate: number;
  private requested = 'idle_breathe';
  private progress = -1;
  private resolved = 'idle_breathe';
  private blending = false;
  private silhouette = false;
  private sampled = new Map<string, { x: number; y: number }>();
  private releases = new Map<
    string,
    import('../../../lib/arena/engine/events/ArenaEvent').ReleaseFrame
  >();

  constructor(
    scene: Phaser.Scene,
    readonly definition: WeightedRigDefinition,
  ) {
    this.root = scene.add.container(0, 0);
    this.shadow = scene.add.graphics();
    this.factory = new NativeFactory(scene);
    const data = scene.cache.json.get(definition.key + '-skeleton');
    validateExport(data);
    const armature = data.armature.find(
      (a: { name: string }) => a.name === definition.armature,
    );
    if (!armature) throw Error('Missing armature ' + definition.armature);
    this.frameRate = armature.frameRate ?? data.frameRate;
    this.clips = new Map(
      armature.animation.map((a: ExportClip) => [a.name, a]),
    );
    this.factory.parseDragonBonesData(data, definition.key);
    this.factory.parseTextureAtlasData(
      scene.cache.json.get(definition.key + '-atlas'),
      definition.key + '-texture',
      definition.key,
    );
    this.actor = this.factory.build(definition.armature, definition.key);
    this.actor.setScale(definition.scale);
    this.root.add([this.shadow, this.actor]);
    for (const mesh of this.actor.list)
      if (mesh instanceof NativeMesh) mesh.setTint(0xfff2df);
    this.apply(REST);
  }
  private resolve(id: string) {
    if (this.clips.has(id)) return id;
    const name =
      this.definition.aliases[id] ??
      this.definition.categories[animation(id).category] ??
      'neutral';
    if (!this.clips.has(name))
      throw Error(`Missing authored clip ${name} for ${id}`);
    return name;
  }
  duration(id: string) {
    return this.clips.get(this.resolve(id))!.duration / this.frameRate;
  }
  landmarks(id: string) {
    let frame = 0;
    return (this.clips.get(this.resolve(id))!.frame ?? []).map((entry) => {
      const landmark = {
        name: entry.events?.[0]?.name ?? 'pose',
        seconds: frame / this.frameRate,
      };
      frame += entry.duration;
      return landmark;
    });
  }
  marker(id: string, name: string) {
    let frame = 0;
    for (const entry of this.clips.get(this.resolve(id))!.frame ?? []) {
      const event = entry.events?.find((e) => e.name === name);
      if (event) {
        if (name === 'release' && event.bone !== 'throwing_hand')
          throw Error(
            this.definition.id + ' release needs its throwing_hand association',
          );
        return frame / this.frameRate;
      }
      frame += entry.duration;
    }
    throw Error(`${this.definition.id} ${id} has no ${name} marker`);
  }
  apply(_pose: PuppetPose, id = 'idle_breathe', progress = 0) {
    progress = Math.max(0, Math.min(1, progress));
    if (!this.blending && id === this.requested && progress === this.progress)
      return;
    this.blending = false;
    this.requested = id;
    this.resolved = this.resolve(id);
    this.progress = progress;
    this.actor.animation.reset();
    // Sample at an absolute clip time: pause, reverse seeks and replay cannot
    // accumulate a second wall clock or replay game/audio side effects.
    const seconds = Math.min(
      progress * this.duration(id),
      this.duration(id) - 1e-6,
    );
    this.actor.animation.gotoAndStopByTime(this.resolved, seconds);
    this.actor.armature.advanceTime(0);
    this.factory.runtime.advanceTime(0);
    this.refreshTint();
    this.shadow.clear();
    const depthScale = this.definition.courtDepthScale ?? 1;
    for (const side of ['L', 'R']) {
      const heel = this.bone('heel_' + side),
        toe = this.bone('toe_' + side);
      const x = (heel.x + toe.x) / 2,
        y = (heel.y + toe.y) / 2,
        width = Math.abs(toe.x - heel.x) + 13 * depthScale;
      this.shadow
        .fillStyle(0x251d15, 0.08)
        .fillEllipse(x, y, width + 12 * depthScale, 8 * depthScale);
      this.shadow
        .fillStyle(0x251d15, 0.16)
        .fillEllipse(x, y, width, 4 * depthScale);
    }
  }
  private bone(name: string) {
    const bone = this.actor.armature.getBone(name);
    if (!bone) throw Error('Missing ' + this.definition.id + ' bone ' + name);
    const m = bone.globalTransformMatrix;
    return { x: m.tx * this.definition.scale, y: m.ty * this.definition.scale };
  }
  socket(name: SocketName) {
    return this.bone(SOCKETS[name]);
  }
  socketTransform(name: SocketName) {
    const bone = this.actor.armature.getBone(SOCKETS[name])!;
    // The soft bag is kept mostly level in the palm. This local grip adjustment
    // follows the evaluated hand, with bounded tilt rather than a rigid square.
    return {
      ...this.socket(name),
      angle:
        Math.atan2(bone.globalTransformMatrix.b, bone.globalTransformMatrix.a) *
        (this.definition.gripAngleScale ?? 0.18),
    };
  }
  applyBlend(
    from: string,
    fromProgress: number,
    to: string,
    toProgress: number,
    weight: number,
  ) {
    if (weight >= 1) {
      this.apply(REST, to, toProgress);
      return;
    }
    this.actor.animation.reset();
    for (const [id, progress, w, group] of [
      [from, fromProgress, 1 - weight, 'from'],
      [to, toProgress, weight, 'to'],
    ] as const) {
      const state = this.actor.animation.fadeIn(
        this.resolve(id),
        0,
        1,
        0,
        group,
        db.AnimationFadeOutMode.SameGroup,
      )!;
      state.weight = w;
      state.currentTime = Math.min(
        this.duration(id) - 1e-6,
        Math.max(0, progress * this.duration(id)),
      );
      state.stop();
    }
    this.actor.armature.advanceTime(0);
    this.factory.runtime.advanceTime(0);
    this.refreshTint();
    this.requested = to;
    this.resolved = this.resolve(to);
    this.progress = toProgress;
    this.blending = true;
  }
  sampleSocket(name: SocketName, id: string, progress: number) {
    const key = JSON.stringify([name, this.resolve(id), progress]);
    const cached = this.sampled.get(key);
    if (cached) return { ...cached };
    const previous = this.requested,
      time = this.progress;
    this.apply(REST, id, progress);
    const point = this.socket(name);
    this.apply(REST, previous, time);
    if (this.sampled.size >= 32) this.sampled.clear();
    this.sampled.set(key, point);
    return { ...point };
  }
  releaseMotion(id: string) {
    const resolved = this.resolve(id),
      cached = this.releases.get(resolved);
    if (cached) return structuredClone(cached);
    const t = this.marker(id, 'release'),
      duration = this.duration(id),
      h = 1 / 240;
    const a = this.sampleSocket('throwingHand', id, (t - h) / duration),
      b = this.sampleSocket('throwingHand', id, (t + h) / duration);
    const previous = this.requested,
      progress = this.progress;
    this.apply(REST, id, t / duration);
    const point = this.socketTransform('throwingHand');
    this.apply(REST, previous, Math.max(0, progress));
    const result = {
      ...point,
      velocity: { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h) },
    };
    this.releases.set(resolved, result);
    return structuredClone(result);
  }
  debugInfo() {
    const meshes = this.actor.list.filter(
      (o): o is NativeMesh => o instanceof NativeMesh,
    );
    return {
      ...this.definition.provenance,
      sample: this.definition.provenance.sample ?? null,
      editorRoundTripVerified:
        this.definition.provenance.editorRoundTripVerified === true,
      handedness: this.definition.provenance.handedness ?? null,
      armature: this.definition.armature,
      assetIdentityVerified: true,
      skeleton: this.definition.path + this.definition.skeleton,
      requestedClip: this.requested,
      resolvedClip: this.resolved,
      clipTime: this.progress * this.duration(this.requested),
      authoredClips: [...this.clips.keys()],
      releaseMarker: this.marker(
        this.resolved.startsWith('cornhole_throw_')
          ? this.resolved
          : this.definition.throwClip,
        'release',
      ),
      releaseBone: 'throwing_hand',
      releaseParent: this.actor.armature.getBone('throwing_hand')!.parent?.name,
      handTransform: this.socketTransform('throwingHand'),
      limitation: this.definition.limitation,
      bones: this.actor.armature.getBones().length,
      meshes: meshes.length,
      vertices: meshes.reduce((n, m) => n + m.vertices.length, 0),
      triangles: meshes.reduce((n, m) => n + m.faces.length, 0),
      handSurfaces: meshes
        .filter((m) => ['grip', 'open', 'relaxed'].includes(m.name))
        .map((m) => ({ name: m.name, alpha: m.alpha, visible: m.visible })),
      feet: Object.fromEntries(
        ['heel_L', 'toe_L', 'heel_R', 'toe_R'].map((n) => [n, this.bone(n)]),
      ),
    };
  }
  setSilhouette(on: boolean) {
    this.silhouette = on;
    this.refreshTint();
    this.shadow.setVisible(!on);
  }
  private refreshTint() {
    for (const o of this.actor.list)
      if (o instanceof NativeMesh) o.setTint(this.silhouette ? 0 : 0xfff2df);
  }
  inspectionPose() {
    return {
      bones: this.actor.armature.getBones().map((b) => ({
        name: b.name,
        parent: b.parent?.name ?? null,
        ...this.bone(b.name),
      })),
      meshes: this.actor.list
        .filter((o): o is NativeMesh => o instanceof NativeMesh)
        .map((m) => ({
          name: m.name,
          alpha: m.alpha,
          vertices: m.vertices.map((v) => [
            v.vx * this.definition.scale,
            v.vy * this.definition.scale,
          ]),
          triangles: m.faces.length,
        })),
    };
  }
  destroy() {
    this.actor.dispose();
    this.factory.runtime.advanceTime(0);
    this.factory.clear();
    this.factory.runtime.advanceTime(0);
    this.root.destroy(true);
    this.sampled.clear();
    this.releases.clear();
  }
}
