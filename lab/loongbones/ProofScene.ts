import * as Phaser from 'phaser';
import { dragonBones as db } from './vendor/dragonBones';
import { NativeFactory, NativeArmature } from './NativeFactory';
import { NativeMesh } from './NativeMesh';
import { weightedFixture, fixtureAtlas } from './weighted-fixture';
import { validateExport } from './validate-export';
import type { EditorExportVerification } from './editor-export';

export class ProofScene extends Phaser.Scene {
  factory!: NativeFactory;
  sample!: NativeArmature;
  arm!: NativeArmature;
  bag!: Phaser.GameObjects.Rectangle;
  debug!: Phaser.GameObjects.Graphics;
  sampleTitle!: Phaser.GameObjects.Text;
  sampleCaption!: Phaser.GameObjects.Text;
  ready = false;
  playing = false;
  seconds = 0;
  overlay = true;
  onReady = () => {};
  importCount = 0;
  sampleDataName = 'sample';
  editorExport: EditorExportVerification | null = null;
  sampleSource: {
    kind: string;
    files: string[];
    version: string;
    armature: string;
  } = {
    kind: 'official-dragonbones-reference',
    files: ['mecha_1406_ske.json', 'mecha_1406_tex.json', 'mecha_1406_tex.png'],
    version: '5.5',
    armature: 'mecha_1406',
  };
  eventsLog: {
    name: string;
    clip: string;
    time: number;
    observedAt: number;
  }[] = [];
  release: null | { time: number; x: number; y: number; markerTime: number } =
    null;
  frameTimes: number[] = [];
  constructor() {
    super('LoongBonesProof');
  }
  preload() {
    this.load.json('sample-skeleton', '/loongbones/assets/mecha_1406_ske.json');
    this.load.json('sample-atlas', '/loongbones/assets/mecha_1406_tex.json');
    this.load.image('sample-texture', '/loongbones/assets/mecha_1406_tex.png');
  }
  create() {
    this.add.rectangle(600, 340, 1200, 680, 0xd5d3c8);
    this.add.line(0, 0, 25, 555, 1175, 555, 0x536454).setOrigin(0);
    const title = (x: number, y: number, text: string) =>
      this.add.text(x, y, text, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#182219',
      });
    this.sampleTitle = title(65, 48, 'AUTHORED CHARACTER / DragonBones 5.5');
    title(680, 48, 'WEIGHTED MESH / Arena test fixture');
    this.sampleCaption = title(
      65,
      593,
      'Official sample • original animation + IK',
    );
    title(680, 593, 'Bones → mesh → hand socket → release marker');
    // One static test texture. No canvas-to-texture upload during animation.
    const canvas = this.textures.createCanvas('fixture-texture', 164, 26)!;
    const ctx = canvas.context;
    ctx.fillStyle = '#ecb943';
    ctx.fillRect(0, 0, 164, 26);
    ctx.strokeStyle = '#704d13';
    ctx.lineWidth = 2;
    for (let x = 0; x < 164; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 26);
      ctx.stroke();
    }
    canvas.refresh();
    this.factory = new NativeFactory(this);
    const data = this.cache.json.get('sample-skeleton');
    validateExport(data);
    validateExport(weightedFixture);
    this.factory.parseDragonBonesData(data, 'sample');
    this.factory.parseTextureAtlasData(
      this.cache.json.get('sample-atlas'),
      'sample-texture',
      'sample',
    );
    this.factory.parseDragonBonesData(weightedFixture, 'fixture');
    this.factory.parseTextureAtlasData(
      fixtureAtlas,
      'fixture-texture',
      'fixture',
    );
    this.sample = this.factory
      .build('mecha_1406', 'sample')
      .setPosition(310, 540)
      .setScale(1.4);
    this.arm = this.factory
      .build('weighted_arm', 'fixture')
      .setPosition(755, 275)
      .setScale(1.8);
    this.bag = this.add
      .rectangle(0, 0, 21, 16, 0xdf642e)
      .setStrokeStyle(2, 0x20281c);
    this.debug = this.add.graphics();
    for (const actor of [this.sample, this.arm]) this.observe(actor);
    this.reset();
    this.ready = true;
    this.onReady();
    this.events.once('shutdown', () => {
      this.sample.armature.dispose();
      this.arm.armature.dispose();
      this.factory.runtime.advanceTime(0);
      this.factory.clear();
      this.factory.runtime.advanceTime(0);
    });
  }
  observe(actor: NativeArmature) {
    actor.on(db.EventObject.FRAME_EVENT, (e: db.EventObject) => {
      this.eventsLog.push({
        name: e.name,
        clip: e.animationState.name,
        time: e.time,
        observedAt: this.seconds,
      });
      if (this.eventsLog.length > 100) this.eventsLog.shift();
      if (actor === this.arm && e.name === 'release' && !this.release) {
        const p = this.arm.socket('throwing_hand');
        this.release = {
          time: this.seconds,
          x: p.x,
          y: p.y,
          markerTime: e.time,
        };
      }
    });
  }
  reset() {
    this.seconds = 0;
    this.release = null;
    this.eventsLog = [];
    this.frameTimes = [];
    for (const actor of [this.sample, this.arm]) {
      actor.animation.reset();
      actor.animation.fadeIn(
        actor.animation.hasAnimation('idle')
          ? 'idle'
          : actor.animation.animationNames[0],
        0,
        0,
      );
      // WorldClock deliberately skips zero-delta updates. Evaluate the armature
      // itself so a paused reset shows the authored first pose, not setup art.
      actor.armature.advanceTime(0);
    }
    this.factory.runtime.advanceTime(0);
    this.present();
  }
  clip(name: string, actor: 'sample' | 'arm' = 'sample', fade = 0.18) {
    const target = this[actor];
    if (!target.animation.hasAnimation(name))
      throw Error(`Unknown ${actor} animation ${name}`);
    if (!Number.isFinite(fade) || fade < 0 || fade > 2)
      throw Error('Fade must be between 0 and 2 seconds');
    if (actor === 'arm' && name === 'throw') this.release = null;
    target.animation.fadeIn(
      name,
      fade,
      name === 'idle' || name === 'walk' ? 0 : 1,
    );
    target.armature.advanceTime(0);
    this.factory.runtime.advanceTime(0);
    this.present();
  }
  step(delta: number) {
    if (!Number.isFinite(delta) || delta < 0 || delta > 10)
      throw Error('Step must be 0–10 seconds');
    // Bound event/socket lag to one 120 Hz tick, independent of render framerate.
    for (let remaining = delta; remaining > 1e-10;) {
      const dt = Math.min(1 / 120, remaining);
      this.seconds += dt;
      this.factory.runtime.advanceTime(dt);
      remaining -= dt;
    }
    this.present();
  }
  present() {
    const p = this.arm.socket('throwing_hand');
    if (this.release) {
      const age = this.seconds - this.release.time;
      this.bag
        .setPosition(
          this.release.x + age * 100,
          this.release.y - age * 200 + 200 * age * age,
        )
        .setAngle(age * 200);
    } else this.bag.setPosition(p.x, p.y).setAngle(0);
    this.debug.clear();
    if (this.overlay)
      for (const actor of [this.sample, this.arm]) {
        for (const bone of actor.armature.getBones()) {
          const point = actor.socket(bone.name);
          this.debug.fillStyle(0x117e94, 0.85).fillCircle(point.x, point.y, 3);
          if (bone.parent) {
            const parent = actor.socket(bone.parent.name);
            this.debug
              .lineStyle(1, 0x117e94, 0.65)
              .lineBetween(parent.x, parent.y, point.x, point.y);
          }
        }
      }
  }
  snapshot() {
    const capture = (actor: NativeArmature) => ({
      transform: {
        x: actor.x,
        y: actor.y,
        scaleX: actor.scaleX,
        scaleY: actor.scaleY,
      },
      animations: actor.animation.animationNames,
      tracks: actor.animation.getStates().map((s) => ({
        name: s.name,
        time: s.currentTime,
        fade: s.isFadeIn,
        weight: s.weight,
        completed: s.isCompleted,
      })),
      bones: actor.armature.getBones().map((b) => ({
        name: b.name,
        ...actor.socket(b.name),
        matrix: { ...b.globalTransformMatrix },
      })),
      meshes: actor.list
        .filter((o): o is NativeMesh => o instanceof NativeMesh)
        .map((m) => ({
          name: m.name,
          depth: m.depth,
          visible: m.visible,
          alpha: m.alpha,
          vertices: m.vertices.map((v) => [v.vx, v.vy]),
          triangles: m.faces.length,
        })),
      slots: actor.armature.getSlots().map((s) => ({
        name: s.name,
        displayIndex: s.displayIndex,
        matrix: { ...s.globalTransformMatrix },
      })),
    });
    const times = [...this.frameTimes].sort((a, b) => a - b);
    return {
      ready: true as const,
      phaser: Phaser.VERSION,
      runtime: db.DragonBones.VERSION,
      renderer: 'Phaser native WebGL mesh',
      status: 'experimental-runtime-proof',
      freshLoongBonesExportVerified: this.editorExport !== null,
      editorExport: this.editorExport ? { ...this.editorExport } : null,
      sampleSource: {
        ...this.sampleSource,
        files: [...this.sampleSource.files],
      },
      seconds: this.seconds,
      playing: this.playing,
      sample: capture(this.sample),
      arm: capture(this.arm),
      hand: this.arm.socket('throwing_hand'),
      bag: { x: this.bag.x, y: this.bag.y, attached: !this.release },
      release: this.release ? { ...this.release } : null,
      events: this.eventsLog.map((e) => ({ ...e })),
      performance: {
        samples: times.length,
        p95Ms: times[Math.floor(times.length * 0.95)] ?? null,
        gameObjects: this.children.length,
        textureCount: this.textures.getTextureKeys().length,
      },
    };
  }
  update(_time: number, delta: number) {
    if (!this.ready || !this.playing) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 300) this.frameTimes.shift();
    this.step(Math.min(0.1, delta / 1000));
  }
}
