import * as Phaser from 'phaser';
import { REST } from '../../../lib/arena/puppet-motion';
import { WeightedMatchRig } from './WeightedMatchRig';
import { queueRig } from './provider';
import type { WeightedRigDefinition } from './RigDefinition';

/** Authoring inspection of the exact adapter used in the main match. */
export class RigReviewScene extends Phaser.Scene {
  rig!: WeightedMatchRig;
  ready = false;
  playing = false;
  seconds = 0;
  playbackRate = 1;
  clipName = 'idle_breathe';
  viewOptions = {
    overlay: false,
    silhouette: false,
    mirrored: false,
    court: false,
  };
  private source!: Phaser.GameObjects.Image;
  private neutralRig?: WeightedMatchRig;
  private backdrop!: Phaser.GameObjects.Image;
  private overlay!: Phaser.GameObjects.Graphics;
  private marks: {
    name: string;
    clip: string;
    time: number;
    socket: { x: number; y: number };
  }[] = [];
  private times: number[] = [];
  onReady = () => {};
  constructor(readonly definition: WeightedRigDefinition) {
    super('WeightedReview');
  }
  preload() {
    queueRig(this, this.definition);
    this.load.image('review-source', this.definition.source);
    this.load.image('review-court', '/assets/paper-arena.webp');
  }
  create() {
    this.add.rectangle(640, 380, 1280, 760, 0xd5d3c8);
    this.backdrop = this.add
      .image(640, 380, 'review-court')
      .setDisplaySize(1280, 760)
      .setVisible(false);
    const source = this.textures
      .get('review-source')
      .getSourceImage() as HTMLImageElement;
    this.source = this.add
      .image(320, 700, 'review-source')
      .setOrigin(
        this.definition.sourceOrigin.x / source.width,
        this.definition.sourceOrigin.y / source.height,
      );
    this.rig = new WeightedMatchRig(this, this.definition);
    if (this.definition.layeredSource) {
      this.neutralRig = new WeightedMatchRig(this, this.definition);
      this.neutralRig.apply(REST, 'neutral', 0);
      this.add.text(130, 26, 'NEUTRAL ASSEMBLY', {
        color: '#17261d',
        fontSize: '18px',
      });
      this.add.text(770, 26, 'AUTHORED MOTION', {
        color: '#17261d',
        fontSize: '18px',
      });
    }
    this.overlay = this.add.graphics();
    this.view({});
    this.reset();
    this.ready = true;
    this.onReady();
    this.events.once('shutdown', () => {
      this.rig.destroy();
      this.neutralRig?.destroy();
    });
  }
  reset(clip = this.clipName) {
    this.rig.duration(clip);
    this.clipName = clip;
    this.seconds = 0;
    this.marks = [];
    this.times = [];
    this.sample();
  }
  setPlaybackRate(rate: number) {
    if (![0.25, 0.5, 1].includes(rate))
      throw Error('Review speed must be 0.25, 0.5 or 1');
    this.playbackRate = rate;
  }
  seek(seconds: number) {
    if (
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds > this.rig.duration(this.clipName)
    )
      throw Error('Seek must remain inside the authored clip');
    this.playing = false;
    this.seconds = seconds;
    this.marks = [];
    this.sample();
  }
  private sample() {
    const duration = this.rig.duration(this.clipName),
      loop =
        this.clipName === 'neutral' ||
        this.clipName.startsWith('idle') ||
        this.clipName === 'weight_shift';
    this.rig.apply(
      REST,
      this.clipName,
      loop
        ? (this.seconds % duration) / duration
        : Math.min(1, this.seconds / duration),
    );
    this.drawOverlay();
  }
  step(delta: number) {
    if (!Number.isFinite(delta) || delta < 0 || delta > 10)
      throw Error('Step accepts 0–10 seconds');
    const previous = this.seconds;
    this.seconds += delta;
    if (
      this.clipName.startsWith('throw') ||
      this.clipName.startsWith('cornhole_throw_')
    ) {
      const time = this.rig.marker(this.clipName, 'release');
      if (previous < time && this.seconds >= time) {
        const socket = this.rig.sampleSocket(
          'throwingHand',
          this.clipName,
          time / this.rig.duration(this.clipName),
        );
        this.marks.push({ name: 'release', clip: this.clipName, time, socket });
      }
    }
    this.sample();
  }
  view(options: Partial<typeof this.viewOptions>) {
    for (const [key, value] of Object.entries(options))
      if (!(key in this.viewOptions) || typeof value !== 'boolean')
        throw Error('Invalid review option');
    Object.assign(this.viewOptions, options);
    const { court, mirrored, silhouette } = this.viewOptions,
      scale = court ? 1 : 625 / 371;
    this.rig.root
      .setPosition(court ? 425 : 915, court ? 675 : 700)
      .setScale(mirrored ? -scale : scale, scale);
    this.rig.setSilhouette(silhouette);
    this.backdrop.setVisible(court);
    this.source
      .setVisible(!court && !this.definition.layeredSource)
      .setScale(this.definition.scale * scale)
      .setTint(silhouette ? 0 : 0xffffff);
    this.neutralRig?.root
      .setVisible(!court)
      .setPosition(320, 700)
      .setScale(mirrored ? -scale : scale, scale);
    this.neutralRig?.setSilhouette(silhouette);
    this.drawOverlay();
  }
  private drawOverlay() {
    this.overlay.clear();
    if (!this.viewOptions.overlay) return;
    const pose = this.rig.inspectionPose(),
      matrix = this.rig.root.getWorldTransformMatrix();
    const points = Object.fromEntries(
      pose.bones.map((b) => [b.name, matrix.transformPoint(b.x, b.y)]),
    );
    for (const b of pose.bones) {
      const p = points[b.name];
      if (
        b.parent &&
        !b.name.startsWith('foot_target') &&
        b.name !== 'pelvis'
      ) {
        const q = points[b.parent];
        this.overlay
          .lineStyle(1.5, 0x008fa0, 0.9)
          .lineBetween(p.x, p.y, q.x, q.y);
      }
      this.overlay
        .fillStyle(b.name.startsWith('foot_target') ? 0xe99015 : 0x007789)
        .fillCircle(p.x, p.y, 3);
    }
  }
  snapshot() {
    return structuredClone({
      ready: this.ready,
      character: this.definition.id,
      clip: this.clipName,
      seconds: this.seconds,
      playing: this.playing,
      playbackRate: this.playbackRate,
      duration: this.rig.duration(this.clipName),
      landmarks: this.rig.landmarks(this.clipName),
      view: this.viewOptions,
      rig: this.rig.debugInfo(),
      pose: this.rig.inspectionPose(),
      markers: this.marks,
      root: {
        x: this.rig.root.x,
        y: this.rig.root.y,
        scaleX: this.rig.root.scaleX,
        scaleY: this.rig.root.scaleY,
      },
      performance: {
        samples: this.times.length,
        p95Ms:
          [...this.times].sort((a, b) => a - b)[
            Math.floor(this.times.length * 0.95)
          ] ?? null,
      },
    });
  }
  update(_time: number, delta: number) {
    if (!this.ready || !this.playing) return;
    this.times.push(delta);
    if (this.times.length > 300) this.times.shift();
    this.step(Math.min(delta / 1000, 0.1) * this.playbackRate);
  }
}
