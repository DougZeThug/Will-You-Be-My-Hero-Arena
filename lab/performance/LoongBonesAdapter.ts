import * as Phaser from 'phaser';
import {
  NativeFactory,
  type NativeArmature,
} from '../loongbones/NativeFactory';
import { NativeMesh } from '../loongbones/NativeMesh';
import { dragonBones as db } from '../loongbones/vendor/dragonBones';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
import { validateExport } from '../loongbones/validate-export';
import {
  validateHumanRig,
  SIDE_RIG_BONES,
} from '../../lib/arena/engine/motion/HumanSkeleton';
import { registerArmMaterial } from '../human-motion/ArmMaterialRegistration';
import {
  DOUG_ARM_MATERIAL_RECIPE,
  readDougArmMaterialMarker,
} from '../human-motion/ArmMaterialRecipe.mjs';
import { RigIntegrityValidator } from '../../lib/arena/engine/motion/RigIntegrityValidator';
import { NATIVE_LIMITS } from '../../lib/arena/engine/performance/NativeLimits';
import { softReachDrop } from '../../lib/arena/engine/performance/KneeReach';
import { chestContactWeight } from '../../lib/arena/engine/motion/ContactEnvelope';
import type { AnimationGraph } from '../../lib/arena/engine/motion/AnimationGraph';
import type {
  MotionClip,
  Vec2,
} from '../../lib/arena/engine/motion/MotionTypes';
import type {
  CharacterAnimationRuntime,
  PerformanceProfile,
} from '../../lib/arena/engine/performance/PerformanceTypes';
import {
  compilePerformance,
  installShippedPerformanceClips,
  PERFORMANCE_REVISION,
} from './compile';
import { releaseHands } from './ReleaseHands';
import { assertInterchangeBudget } from '../loongbones/side-rig/limits';
import {
  blendWristCut,
  registerHandMaterial,
  releaseHandMesh,
} from './HandMaterialRegistration';

const segments = [
  ['upperArm', 'upper_arm_L', 'forearm_L'],
  ['forearm', 'forearm_L', 'hand_L'],
  ['rightThigh', 'thigh_L', 'shin_L'],
  ['rightShin', 'shin_L', 'foot_L'],
  ['leftThigh', 'thigh_R', 'shin_R'],
  ['leftShin', 'shin_R', 'foot_R'],
] as const;
const limits = NATIVE_LIMITS;

/** The only mutable native-rig boundary for character performances.
 * Native states persist. Game time drives blends and playheads together. All
 * procedural offsets are rewritten from zero, never accumulated. */
export class LoongBonesAdapter implements CharacterAnimationRuntime {
  readonly root: Phaser.GameObjects.Container;
  readonly heldObjectLayer: Phaser.GameObjects.Container;
  readonly clips: ReadonlyMap<string, MotionClip>;
  private actor: NativeArmature;
  private factory: NativeFactory;
  private bones: Map<string, db.Bone>;
  private states = new Map<
    string,
    { revision: number; state: db.AnimationState }
  >();
  private meshes: NativeMesh[];
  private shadow: Phaser.GameObjects.Ellipse;
  private validator = new RigIntegrityValidator();
  private setup = new Map<string, number>();
  private widths = new Map<string, { indices: number[]; width: number }>();
  private planted = new Map<string, Vec2>();
  private soleSamples: {
    side: string;
    mesh: NativeMesh;
    index: number;
    anchor: Vec2;
  }[] = [];
  private wristSamples: { mesh: NativeMesh; index: number }[] = [];
  private gaze = 0;
  private kneeDrop = 0;
  private warnings = new Set<string>();
  private contactError = 0;
  private starts = 0;
  private ticks = 0;
  private maxDrift = 0;
  private destroyed = false;
  readonly correctedVertices: number;
  readonly armCorrectionRecipe: string | null;
  readonly geometryBudget: ReturnType<typeof assertInterchangeBudget>;
  readonly wristBlendVertices: number;
  constructor(
    scene: Phaser.Scene,
    readonly definition: WeightedRigDefinition,
    readonly profile: PerformanceProfile,
  ) {
    this.root = scene.add.container(0, 0);
    this.shadow = scene.add
      .ellipse(12, 0, 112, 10, 0x201a13, 0.24)
      .setScale(definition.courtDepthScale ?? 1);
    const original = scene.cache.json.get(definition.key + '-skeleton');
    validateExport(original);
    const data = structuredClone(original),
      arm = data.armature[0];
    const validation = validateHumanRig(
      arm.bone.map((b: { name: string }) => b.name),
    );
    if (!validation.valid)
      throw Error(
        'Missing semantic joints: ' +
          validation.missing.map((m) => m.semantic).join(', '),
      );
    const correction = readDougArmMaterialMarker(arm);
    if (correction) {
      const armMesh = arm.skin[0].slot.find(
        (slot: { name: string }) => slot.name === 'arm',
      )?.display[0];
      if (armMesh?.vertices?.length / 2 !== correction.correctedVertexCount)
        throw Error('Doug arm material correction marker count mismatch');
      this.correctedVertices = correction.correctedVertexCount;
      this.armCorrectionRecipe = correction.recipe;
    } else {
      this.correctedVertices = registerArmMaterial(definition.id, arm);
      this.armCorrectionRecipe = this.correctedVertices
        ? DOUG_ARM_MATERIAL_RECIPE
        : null;
    }
    const library = compilePerformance(profile);
    this.clips = library.clips;
    installShippedPerformanceClips(arm, definition, library);
    const art = releaseHands[definition.id as keyof typeof releaseHands];
    arm.slot.push({ name: 'releaseHand', parent: 'root', color: { aM: 0 } });
    arm.skin[0].slot.push({
      name: 'releaseHand',
      display: [releaseHandMesh(definition.id as 'dan' | 'doug')],
    });
    const wristSamples = registerHandMaterial(
      definition.id as 'dan' | 'doug',
      arm,
    );
    // The proximal hand drawing extends underneath the continuous forearm.
    // Drawing that cut edge on top produces a visible cuff at the wrist.
    const handSlots = arm.slot.filter((slot: { name: string }) =>
      ['grip', 'open', 'relaxed', 'releaseHand'].includes(slot.name),
    );
    arm.slot = arm.slot.filter(
      (slot: { name: string }) => !handSlots.includes(slot),
    );
    arm.slot.splice(
      arm.slot.findIndex((slot: { name: string }) => slot.name === 'arm'),
      0,
      ...handSlots,
    );
    this.geometryBudget = assertInterchangeBudget(
      arm.skin[0].slot.map(
        (slot: { display: Parameters<typeof assertInterchangeBudget>[0] }) =>
          slot.display[0],
      ),
    );
    arm.bone.push(
      {
        name: 'performance_chest_contact',
        parent: 'chest',
        transform: { x: -32, y: 55 },
      },
      {
        name: 'performance_chest_target',
        parent: 'root',
        transform: { x: 0, y: -300 },
      },
    );
    arm.ik.push({
      name: 'performance_chest_hand',
      bone: 'forearm_L',
      target: 'performance_chest_target',
      chain: 1,
      bendPositive: false,
      weight: 0,
    });
    // Both knees face the rightward lane in this authored side view. The old
    // far-leg branch bent backward as the pelvis lowered, closing the knees
    // into a crossed silhouette. Keep the original ankle targets and lengths.
    for (const contact of arm.ik)
      if (contact.name === 'plant_R') contact.bendPositive = true;
    for (const side of ['L', 'R']) {
      const target = arm.bone.find(
        (b: { name: string }) => b.name === 'foot_target_' + side,
      );
      target.transform.x *= profile.stanceWidth;
    }
    this.factory = new NativeFactory(scene);
    const key = definition.key + '-performance';
    this.factory.parseDragonBonesData(data, key);
    this.factory.parseTextureAtlasData(
      scene.cache.json.get(definition.key + '-atlas'),
      definition.key + '-texture',
      key,
    );
    this.factory.parseTextureAtlasData(
      {
        name: key,
        width: art.width,
        height: art.height,
        SubTexture: [
          {
            name: 'performance-release',
            x: 0,
            y: 0,
            width: art.width,
            height: art.height,
          },
        ],
      },
      definition.id + '-performance-release',
      key,
    );
    this.actor = this.factory.build(definition.armature, key);
    this.actor.setScale(definition.scale);
    this.root.add([this.shadow, this.actor]);
    this.bones = new Map(
      this.actor.armature.getBones().map((b) => [b.name, b]),
    );
    this.meshes = this.actor.list.filter(
      (m): m is NativeMesh => m instanceof NativeMesh,
    );
    // A held bag belongs in front of the torso and behind the fingers, not
    // behind the entire actor. Keep this layer through the first release frames.
    this.heldObjectLayer = scene.add
      .container(0, 0)
      .setDepth(this.meshes.find((m) => m.name === 'grip')!.depth - 0.5);
    this.actor.add(this.heldObjectLayer).sort('depth');
    for (const m of this.meshes) m.setTint(0xfff2df);
    this.actor.armature.advanceTime(0);
    this.wristBlendVertices = blendWristCut(
      this.meshes.find((mesh) => mesh.name === 'arm')!.vertices,
      this.local('forearm_L'),
      this.local('hand_L'),
    );
    for (const sample of wristSamples) {
      const mesh = this.meshes.find((m) => m.name === sample.name)!,
        v = mesh.vertices[sample.index];
      const texture = mesh.texture.getSourceImage() as HTMLImageElement;
      if (
        (scene.textures.getPixelAlpha(
          Math.floor(v.u * texture.width),
          Math.floor(v.v * texture.height),
          mesh.texture.key,
        ) ?? 0) > 128
      )
        this.wristSamples.push({ mesh, index: sample.index });
    }
    for (const name of ['grip', 'open', 'relaxed'])
      if (!this.wristSamples.some((s) => s.mesh.name === name))
        throw Error('Missing painted wrist samples: ' + name);
    for (const [id, a, b] of segments) {
      const m = this.bones.get(a)!.globalTransformMatrix,
        n = this.bones.get(b)!.globalTransformMatrix;
      const dx = n.tx - m.tx,
        dy = n.ty - m.ty,
        length = Math.hypot(dx, dy);
      this.setup.set(id, length);
      if (id === 'upperArm' || id === 'forearm') {
        const mesh = this.meshes.find((m) => m.name === 'arm')!;
        const candidates = mesh.vertices
          .map((v, i) => ({
            i,
            along:
              ((v.vx - m.tx) * dx + (v.vy - m.ty) * dy) / (length * length),
            side: (-(v.vx - m.tx) * dy + (v.vy - m.ty) * dx) / length,
          }))
          .filter((v) => v.along > 0.48 && v.along < 0.62)
          .sort((a, b) => a.side - b.side);
        if (candidates.length < 2) throw Error('Missing arm width samples');
        this.widths.set(id, {
          indices: [candidates[0].i, candidates.at(-1)!.i],
          width: candidates.at(-1)!.side - candidates[0].side,
        });
      }
    }
    for (const name of [
      'foot_L',
      'foot_R',
      'heel_L',
      'heel_R',
      'toe_L',
      'toe_R',
    ]) {
      const b = this.bones.get(name)!.globalTransformMatrix;
      this.planted.set(name, { x: b.tx, y: b.ty });
    }
    // Validate painted sole material as well as anatomical foot landmarks.
    // Samples come from opaque atlas pixels close to each heel-to-toe contact.
    const body = this.meshes.find((m) => m.name === 'body')!;
    const texture = body.texture.getSourceImage() as HTMLImageElement;
    for (const side of ['L', 'R']) {
      const heel = this.planted.get('heel_' + side)!,
        toe = this.planted.get('toe_' + side)!;
      const dx = toe.x - heel.x,
        dy = toe.y - heel.y,
        length = Math.hypot(dx, dy);
      for (const [index, v] of body.vertices.entries()) {
        const along =
          ((v.vx - heel.x) * dx + (v.vy - heel.y) * dy) / (length * length);
        const distance =
          Math.abs((v.vx - heel.x) * dy - (v.vy - heel.y) * dx) / length;
        if (along < 0 || along > 1 || distance > 14) continue;
        if (
          (scene.textures.getPixelAlpha(
            Math.floor(v.u * texture.width),
            Math.floor(v.v * texture.height),
            body.texture.key,
          ) ?? 0) < 16
        )
          continue;
        this.soleSamples.push({
          side,
          mesh: body,
          index,
          anchor: { x: v.vx, y: v.vy },
        });
      }
      if (!this.soleSamples.some((s) => s.side === side))
        throw Error('Missing painted sole samples: ' + side);
    }
  }
  private local(name: string) {
    const b = this.bones.get(name);
    if (!b) throw Error('Missing attachment ' + name);
    const m = b.globalTransformMatrix;
    return { x: m.tx, y: m.ty };
  }
  private world(name: string) {
    const p = this.local(name);
    return this.actor.getWorldTransformMatrix().transformPoint(p.x, p.y);
  }
  attachment(name: 'rightHand' | 'leftHand') {
    const key = name === 'rightHand' ? 'throwing_hand' : 'off_hand',
      b = this.bones.get(key)!;
    const m = b.globalTransformMatrix,
      world = this.actor.getWorldTransformMatrix();
    const p = world.transformPoint(m.tx, m.ty);
    return {
      x: p.x,
      y: p.y,
      scale:
        Math.abs(this.root.scaleX) * (this.definition.courtDepthScale ?? 1),
      angle: Math.atan2(
        world.b * m.a + world.d * m.b,
        world.a * m.a + world.c * m.b,
      ),
      flatten: 0.46,
    };
  }
  private constraint(weight: number) {
    const c = this.actor.armature._constraints.find(
      (c) => c.name === 'performance_chest_hand',
    ) as db.IKConstraint;
    c._weight = weight;
    c.invalidUpdate();
  }
  evaluate(
    graph: AnimationGraph,
    dt: number,
    time: number,
    target: Vec2 | undefined,
    held: boolean,
  ) {
    if (this.destroyed) return;
    const active = graph.active();
    for (const [layer, entry] of this.states)
      if (!active.some((s) => s.clip.layer === layer)) {
        entry.state.fadeOut(0.24, false);
        this.states.delete(layer);
      }
    for (const s of active) {
      let entry = this.states.get(s.clip.layer);
      if (entry?.revision !== s.revision) {
        const state = this.actor.animation.fadeIn(
          s.clip.native,
          s.clip.fade,
          s.clip.loop ? 0 : 1,
          s.clip.layer === 'base' ? 0 : 1,
          s.clip.layer,
          db.AnimationFadeOutMode.SameGroup,
        )!;
        if (!state) throw Error('Missing native animation ' + s.clip.native);
        state.play();
        state.resetToPose = true;
        const sampleTime = Math.max(0, s.time - dt * s.rate);
        state.currentTime = s.clip.loop
          ? sampleTime % s.clip.duration
          : Math.min(sampleTime, s.clip.duration);
        entry = { revision: s.revision, state };
        this.states.set(s.clip.layer, entry);
        this.starts++;
      }
      entry.state.timeScale = s.rate;
    }
    for (const b of this.bones.values()) {
      b.offset.identity();
      b.invalidUpdate();
    }
    this.constraint(0);
    this.factory.runtime.advanceTime(dt);
    this.ticks++;
    for (const s of active) {
      const native = this.states.get(s.clip.layer)!.state;
      const expected = s.clip.loop
        ? s.time % s.clip.duration
        : Math.min(s.time, s.clip.duration);
      const difference = Math.abs(expected - native.currentTime);
      // The two ends of a loop are the same phase; floating point can place
      // one clock just below duration and the other just above zero.
      const drift = s.clip.loop
        ? Math.min(difference, Math.abs(s.clip.duration - difference))
        : difference;
      this.maxDrift = Math.max(this.maxDrift, drift);
      if (drift > 1 / 120 + 0.0001)
        this.warnings.add('Native/graph time disagreement');
    }
    // Absolute bounded corrections only. Bone lengths and scales never change.
    for (const [name, [min, max]] of Object.entries(limits)) {
      const b = this.bones.get(name)!,
        r = (b.animationPose.rotation * 180) / Math.PI;
      if (!Number.isFinite(r)) throw Error('Non-finite joint ' + name);
      const constrained = Math.max(min, Math.min(max, r));
      if (Math.abs(r - constrained) > 0.01) {
        b.offset.rotation = ((constrained - r) * Math.PI) / 180;
        b.invalidUpdate();
        this.warnings.add('Clamped ' + name);
      }
    }
    // Soft knee reach: lower the pelvis just enough that neither planted leg
    // enters the two-bone singularity near full extension (where a pixel of
    // hip drop swings the knee by ~8°). Feet and IK targets stay fixed.
    const pelvis = this.bones.get('pelvis')!;
    // WorldClock.advanceTime(0) is a no-op, so zero-length evaluations (the
    // release re-evaluation, seeks) would still read last frame's lowered
    // hips. Refresh the skeleton from the reset offsets before measuring.
    this.actor.armature.advanceTime(0);
    this.kneeDrop = softReachDrop(
      (['L', 'R'] as const).map((side) => ({
        hip: this.local('thigh_' + side),
        ankle: this.local('foot_target_' + side),
        length:
          this.bones.get('thigh_' + side)!.boneData.length +
          this.bones.get('shin_' + side)!.boneData.length,
      })),
    );
    if (this.kneeDrop > 0) {
      pelvis.offset.y = this.kneeDrop;
      pelvis.invalidUpdate();
    }
    const head = this.world('skull_center');
    const desire = target
      ? Math.max(
          -0.055,
          Math.min(
            0.055,
            Math.atan2(target.y - head.y, Math.abs(target.x - head.x)),
          ),
        )
      : 0;
    this.gaze += (desire - this.gaze) * (1 - Math.exp(-dt / 0.2));
    const h = this.bones.get('head')!;
    h.offset.rotation += this.gaze;
    h.invalidUpdate();
    this.actor.armature.advanceTime(0);
    const action = graph.get('action');
    this.contactError = 0;
    if (action?.clip.id === 'chestTap') {
      const influence = chestContactWeight(
        action.time,
        action.clip.markers
          .filter((m) => m.name.startsWith('chestTapContact'))
          .map((m) => m.at),
      );
      if (influence > 0) {
        const contact = this.local('performance_chest_contact'),
          wrist = this.local('hand_L');
        const palm = () => {
          const m = this.bones.get('hand_L')!.globalTransformMatrix;
          return { x: m.tx + m.a * 20, y: m.ty + m.b * 20 };
        };
        let p = palm(),
          x = contact.x - p.x + wrist.x,
          y = contact.y - p.y + wrist.y;
        this.constraint(influence);
        const b = this.bones.get('performance_chest_target')!;
        for (let i = 0; i < 4; i++) {
          b.offset.x = x - b.origin!.x;
          b.offset.y = y - b.origin!.y;
          b.invalidUpdate();
          this.actor.armature.advanceTime(0);
          p = palm();
          x += (contact.x - p.x) * 0.7;
          y += (contact.y - p.y) * 0.7;
        }
        if (influence > 0.98)
          this.contactError =
            Math.hypot(contact.x - p.x, contact.y - p.y) *
            this.definition.scale;
      }
    }
    // Native clip crossfades must never dissolve two finger drawings together.
    const releaseAt = action?.clip.markers.find(
      (m) => m.name === 'equipmentRelease',
    )?.at;
    const exposure =
      action?.clip.id === 'underhand' &&
      releaseAt !== undefined &&
      action.time >= releaseAt - 0.07 &&
      action.time < releaseAt + 0.32
        ? 'releaseHand'
        : held
          ? 'grip'
          : action?.clip.id === 'chestTap' &&
              action.time > 0.2 &&
              action.time < 0.82
            ? 'open'
            : 'relaxed';
    for (const name of ['grip', 'open', 'relaxed', 'releaseHand']) {
      const slot = this.actor.armature.getSlot(name)!;
      if (
        slot._colorTransform.alphaMultiplier !== (name === exposure ? 1 : 0)
      ) {
        const color = new db.ColorTransform();
        color.copyFrom(slot._colorTransform);
        color.alphaMultiplier = name === exposure ? 1 : 0;
        slot._setColor(color);
      }
    }
    this.actor.armature.advanceTime(0);
    for (const b of this.bones.values())
      if (
        ![b.globalTransformMatrix.tx, b.globalTransformMatrix.ty].every(
          Number.isFinite,
        )
      )
        throw Error('Non-finite evaluated transform ' + b.name);
  }
  inspect() {
    const arm = this.meshes.find((m) => m.name === 'arm')!;
    const limbs = this.validator.inspect(
      segments.map(([id, a, b]) => {
        const m = this.bones.get(a)!.globalTransformMatrix,
          n = this.bones.get(b)!.globalTransformMatrix;
        const dx = n.tx - m.tx,
          dy = n.ty - m.ty,
          length = Math.hypot(dx, dy),
          sample = this.widths.get(id),
          pair = sample?.indices.map((i) => arm.vertices[i]);
        return {
          id,
          length,
          setupLength: this.setup.get(id)!,
          scaleX: Math.hypot(m.a, m.b),
          scaleY: Math.hypot(m.c, m.d),
          width: pair
            ? Math.abs(
                -(pair[1].vx - pair[0].vx) * dy +
                  (pair[1].vy - pair[0].vy) * dx,
              ) / length
            : undefined,
          setupWidth: sample?.width,
        };
      }),
    );
    const feet = [...this.planted].map(([name, anchor]) => {
      const p = this.local(name);
      return {
        name,
        anchor,
        error:
          Math.hypot(p.x - anchor.x, p.y - anchor.y) * this.definition.scale,
        world: this.world(name),
      };
    });
    const soles = ['L', 'R'].map((side) => {
      const samples = this.soleSamples.filter((s) => s.side === side);
      return {
        side,
        samples: samples.length,
        error: Math.max(
          ...samples.map((s) => {
            const v = s.mesh.vertices[s.index];
            return (
              Math.hypot(v.vx - s.anchor.x, v.vy - s.anchor.y) *
              this.definition.scale
            );
          }),
        ),
      };
    });
    const joints = Object.fromEntries(
      Object.entries(SIDE_RIG_BONES).map(([name, native]) => [
        name,
        this.world(native),
      ]),
    );
    const pelvis = joints.pelvis,
      chest = joints.chest;
    // The small painted cuff must occupy the forearm side of the wrist,
    // centered over the forearm. A rigid palm-owned cuff fails this at chest
    // contact even when the anatomical wrist and hand socket are connected.
    const elbow = this.local('forearm_L'),
      wrist = this.local('hand_L');
    const length = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
    const ux = (wrist.x - elbow.x) / length,
      uy = (wrist.y - elbow.y) / length;
    const handJoins = ['grip', 'open', 'relaxed'].map((name) => {
      const samples = this.wristSamples.filter((s) => s.mesh.name === name);
      const center = samples.reduce(
        (sum, s) => {
          const v = s.mesh.vertices[s.index];
          return {
            x: sum.x + v.vx / samples.length,
            y: sum.y + v.vy / samples.length,
          };
        },
        { x: 0, y: 0 },
      );
      const x = center.x - wrist.x,
        y = center.y - wrist.y;
      return {
        name,
        samples: samples.length,
        visible: samples[0].mesh.alpha > 0.99,
        proximalAlong: (x * ux + y * uy) * this.definition.scale,
        centerOffset: Math.abs(-x * uy + y * ux) * this.definition.scale,
      };
    });
    return {
      backend: 'loongbones',
      runtimeRevision: PERFORMANCE_REVISION,
      composition: [
        'whole-body native action over idle',
        'bounded local channels',
        'filtered gaze',
        'chest-relative native IK',
        'soft knee reach',
        'opaque hand exposure',
      ],
      kneeDrop: this.kneeDrop,
      source: this.definition.provenance,
      derivedRuntimeMotion: true,
      productionInstalled:
        this.definition.provenance.performanceInstalled === true,
      correctedVertices: this.correctedVertices,
      armCorrectionRecipe: this.armCorrectionRecipe,
      geometryBudget: this.geometryBudget,
      wristBlendVertices: this.wristBlendVertices,
      armSurfaceDepth: arm.depth,
      starts: this.starts,
      ticks: this.ticks,
      maxNativeDrift: this.maxDrift,
      native: this.actor.animation.getStates().map((s) => ({
        name: s.name,
        time: s.currentTime,
        weight: s.weight,
        fade: s._fadeProgress,
      })),
      joints,
      bones: [...this.bones].map(([name, b]) => ({
        name,
        parent: b.parent?.name ?? null,
        rotation: b.global.rotation,
        localRotation: b.animationPose.rotation + b.offset.rotation,
        ...this.world(name),
      })),
      massProxy: {
        x: pelvis.x * 0.65 + chest.x * 0.35,
        y: pelvis.y * 0.65 + chest.y * 0.35,
      },
      bounds: {
        x: this.root.x - 90 * this.root.scaleX,
        y: this.root.y - 371 * this.root.scaleY,
        width: 200 * Math.abs(this.root.scaleX),
        height: 371 * this.root.scaleY,
      },
      limbs,
      feet,
      soles,
      handJoins,
      chestContactError: this.contactError,
      chestTarget: this.world('performance_chest_contact'),
      warnings: [
        ...this.warnings,
        ...limbs.flatMap((l) => l.flags.map((f) => l.id + ': ' + f)),
        ...feet
          .filter((f) => f.error > 2)
          .map((f) => f.name + ': planted support moved'),
        ...soles
          .filter((s) => s.error > 2)
          .map((s) => s.side + ': painted sole moved'),
      ],
      hands: this.meshes
        .filter((m) =>
          ['grip', 'open', 'relaxed', 'releaseHand'].includes(m.name),
        )
        .map((m) => ({ name: m.name, alpha: m.alpha, depth: m.depth })),
    };
  }
  setSilhouette(on: boolean) {
    for (const m of this.meshes) m.setTint(on ? 0 : 0xfff2df);
    this.shadow.setVisible(!on);
  }
  reset() {
    this.actor.animation.reset();
    this.states.clear();
    this.gaze = 0;
    this.warnings.clear();
    this.starts = 0;
    this.ticks = 0;
    this.maxDrift = 0;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.actor.dispose();
    this.factory.runtime.advanceTime(0);
    this.factory.clear();
    this.factory.runtime.advanceTime(0);
    this.root.destroy(true);
  }
}
