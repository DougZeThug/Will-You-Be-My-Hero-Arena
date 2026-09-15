import * as Phaser from 'phaser';
import { NativeFactory, NativeArmature } from '../NativeFactory';
import { NativeMesh } from '../NativeMesh';
import { dragonBones as db } from '../vendor/dragonBones';
import { validateExport } from '../validate-export';
import { drawRig, snapshotRig } from './inspection';
import { danSamples, type DanSample } from './samples';

/** Internal authoring review. Same native bridge as the real editor export;
 * no production character replacement or gameplay/persistence writes. */
export class DanRigScene extends Phaser.Scene {
  factory!: NativeFactory;
  actor!: NativeArmature;
  source!: Phaser.GameObjects.Image;
  backdrop!: Phaser.GameObjects.Image;
  referenceLabel!: Phaser.GameObjects.Text;
  rigLabel!: Phaser.GameObjects.Text;
  debug!: Phaser.GameObjects.Graphics;
  shadow!: Phaser.GameObjects.Graphics;
  bag!: Phaser.GameObjects.Rectangle;
  ready = false;
  playing = false;
  seconds = 0;
  overlay = false;
  silhouette = false;
  mirrored = false;
  court = false;
  clipName = 'idle_breathe';
  clipStart = 0;
  frameTimes: number[] = [];
  markers: { name: string; clip: string; time: number; observedAt: number }[] =
    [];
  release: null | { x: number; y: number; time: number; markerTime: number } =
    null;
  releaseLocal: null | { x: number; y: number } = null;
  onReady = () => {};
  constructor(
    readonly sample: DanSample = 'authored',
    readonly assetIdentityVerified = false,
  ) {
    super('DanWeightedRig');
  }
  preload() {
    const { path, skeleton, atlas, texture } = danSamples[this.sample];
    this.load.json('dan-skeleton', path + skeleton);
    this.load.json('dan-atlas', path + atlas);
    this.load.image('dan-texture', path + texture);
    this.load.image(
      'dan-approved-source',
      '/loongbones/assets/dan-weighted-v1/dan_tex.png',
    );
    this.load.image('sunset', '/assets/paper-arena.webp');
  }
  create() {
    this.add.rectangle(640, 380, 1280, 760, 0xd5d3c8);
    this.backdrop = this.add
      .image(640, 380, 'sunset')
      .setDisplaySize(1280, 760)
      .setVisible(false);
    const label = (x: number, text: string) =>
      this.add.text(x, 25, text, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#233127',
      });
    this.referenceLabel = label(105, 'APPROVED SOURCE / unchanged proportions');
    this.rigLabel = label(725, 'DAN / ' + danSamples[this.sample].label);
    this.shadow = this.add.graphics();
    this.source = this.add
      .image(320, 700, 'dan-approved-source')
      .setOrigin(404 / 808, 1918 / 1947);
    this.factory = new NativeFactory(this);
    const data = this.cache.json.get('dan-skeleton');
    validateExport(data);
    this.factory.parseDragonBonesData(data, 'dan');
    this.factory.parseTextureAtlasData(
      this.cache.json.get('dan-atlas'),
      'dan-texture',
      'dan',
    );
    this.actor = this.factory.build('dan_weighted_v1', 'dan');
    this.debug = this.add.graphics();
    this.bag = this.add
      .rectangle(0, 0, 18, 14, 0xf4b62a)
      .setStrokeStyle(2, 0x191a15)
      .setVisible(false);
    this.actor.on(db.EventObject.FRAME_EVENT, (e: db.EventObject) => {
      this.markers.push({
        name: e.name,
        clip: e.animationState.name,
        time: e.time,
        observedAt: this.seconds,
      });
      if (this.markers.length > 60) this.markers.shift();
      if (e.name === 'release' && !this.release) {
        const p = this.actor.socket('throwing_hand');
        this.release = {
          x: p.x,
          y: p.y,
          time: this.seconds,
          markerTime: e.time,
        };
        this.releaseLocal = {
          x: (p.x - this.actor.x) / this.actor.scaleX,
          y: (p.y - this.actor.y) / this.actor.scaleY,
        };
      }
    });
    this.layout();
    this.reset('idle_breathe');
    this.ready = true;
    this.onReady();
    this.events.once('shutdown', () => {
      this.actor.dispose();
      this.factory.runtime.advanceTime(0);
      this.factory.clear();
      this.factory.runtime.advanceTime(0);
    });
  }
  layout() {
    const scale = (this.court ? 371 : 625) / 1900;
    this.source
      .setScale(scale)
      .setPosition(this.court ? 365 : 320, this.court ? 675 : 700)
      .setVisible(!this.court);
    this.actor
      .setScale(this.mirrored ? -scale : scale, scale)
      .setPosition(this.court ? 425 : 915, this.court ? 675 : 700);
    this.backdrop.setVisible(this.court);
    this.referenceLabel.setVisible(!this.court);
    this.rigLabel.setVisible(!this.court);
    this.present();
  }
  reset(name = this.clipName) {
    if (!this.actor.animation.hasAnimation(name))
      throw Error('Unknown Dan clip ' + name);
    this.seconds = 0;
    this.clipStart = 0;
    this.markers = [];
    this.release = null;
    this.releaseLocal = null;
    this.frameTimes = [];
    this.clipName = name;
    this.actor.animation.reset();
    this.actor.animation.fadeIn(name, 0);
    this.actor.armature.advanceTime(0);
    this.factory.runtime.advanceTime(0);
    this.present();
  }
  playClip(name: string, fade = 0.2) {
    if (!this.actor.animation.hasAnimation(name))
      throw Error('Unknown Dan clip ' + name);
    this.clipName = name;
    this.clipStart = this.seconds;
    this.release = null;
    this.releaseLocal = null;
    this.markers = [];
    this.actor.animation.fadeIn(name, fade);
    this.actor.armature.advanceTime(0);
    this.factory.runtime.advanceTime(0);
    this.present();
  }
  step(delta: number) {
    if (!Number.isFinite(delta) || delta < 0 || delta > 10)
      throw Error('Step must be 0–10 seconds');
    for (let t = delta; t > 1e-10;) {
      const dt = Math.min(t, 1 / 120);
      this.seconds += dt;
      this.factory.runtime.advanceTime(dt);
      t -= dt;
    }
    this.present();
  }
  view(options: {
    overlay?: boolean;
    silhouette?: boolean;
    mirrored?: boolean;
    court?: boolean;
  }) {
    for (const [key, value] of Object.entries(options)) {
      if (
        !['overlay', 'silhouette', 'mirrored', 'court'].includes(key) ||
        typeof value !== 'boolean'
      )
        throw Error('Invalid view option');
    }
    Object.assign(this, options);
    this.layout();
  }
  present() {
    if (!this.actor) return;
    const tint = this.silhouette ? 0 : this.court ? 0xfff2df : 0xffffff;
    for (const mesh of this.actor.list)
      if (mesh instanceof NativeMesh) mesh.setTint(tint);
    this.source.setTint(this.silhouette ? 0 : 0xffffff);
    this.debug.clear();
    this.shadow.clear();
    for (const side of ['L', 'R']) {
      const heel = this.actor.socket('heel_' + side),
        toe = this.actor.socket('toe_' + side);
      this.shadow
        .fillStyle(0x251d15, 0.12)
        .fillEllipse(
          (heel.x + toe.x) / 2,
          (heel.y + toe.y) / 2,
          Math.abs(toe.x - heel.x) + 13,
          5,
        );
    }
    if (this.overlay) drawRig(this.actor, this.debug);
    this.bag.setVisible(this.clipName === 'throw_low' && !this.silhouette);
    if (this.release && this.releaseLocal) {
      const age = this.seconds - this.release.time;
      // Flight lives in rig coordinates so review zoom/mirror cannot disconnect it.
      const referenceScale = 625 / 1900;
      this.bag
        .setPosition(
          this.actor.x +
            (this.releaseLocal.x + (age * 200) / referenceScale) *
              this.actor.scaleX,
          this.actor.y +
            (this.releaseLocal.y +
              (-age * 210 + age * age * 150) / referenceScale) *
              this.actor.scaleY,
        )
        .setAngle(age * 160 * (this.mirrored ? -1 : 1));
      if (age > 1.45) this.bag.setVisible(false);
    } else {
      const p = this.actor.socket('throwing_hand');
      this.bag.setPosition(p.x, p.y).setAngle(0);
    }
  }
  snapshot() {
    return snapshotRig(this);
  }
  update(_time: number, delta: number) {
    if (!this.ready || !this.playing) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 300) this.frameTimes.shift();
    this.step(Math.min(delta / 1000, 0.1));
  }
}
