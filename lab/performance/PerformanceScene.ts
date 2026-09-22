import * as Phaser from 'phaser';
import {
  CharacterPerformanceController,
  alignedSubstep,
} from '../../lib/arena/engine/performance/CharacterPerformanceController';
import {
  performanceProfiles,
  validatePerformanceProfile,
} from '../../lib/arena/engine/performance/PerformanceProfiles';
import type { PerformanceProfile } from '../../lib/arena/engine/performance/PerformanceTypes';
import { LoongBonesAdapter } from './LoongBonesAdapter';
import { performanceDefinitions } from './definitions';
import { queueRig } from '../loongbones/arena/provider';
import { queueReleaseHands } from './ReleaseHands';
import { queueArenaAssets } from '../../lib/arena/engine/scenes/CharacterAssetLoader';
import { Equipment } from '../../lib/arena/engine/objects/Equipment';
import { Projectile } from '../../lib/arena/engine/objects/Projectile';
import { PerformanceFeedback } from '../../lib/arena/engine/presentation/PerformanceFeedback';
import { placement } from '../../lib/arena/equipment-layout';
import { CornholePerformancePlayback } from '../../lib/arena/engine/events/cornhole/CornholePerformancePlayback';
import { createRecording, resolveScenario } from '../scenarios';
import { project, simulate } from '../../lib/arena/simulation';
import { performanceActions } from '../../lib/arena/engine/performance/Choreography';
import type { Attempt } from '../../lib/arena/model';
import { scoreTime } from '../../lib/arena/match-timeline';

/** Development-only scene. It renders the real game adapter and recorded event module. */
export class PerformanceScene extends Phaser.Scene {
  ready = false;
  playing = false;
  loop = false;
  rate = 1;
  elapsed = 0;
  selected = 'doug';
  action = 'cornholeThrow';
  controller!: CharacterPerformanceController;
  runtime!: LoongBonesAdapter;
  playback?: CornholePerformancePlayback;
  profile: PerformanceProfile = { ...performanceProfiles.doug };
  outcome: 'success' | 'board' | 'miss' = 'success';
  view = {
    skeleton: false,
    names: false,
    attachments: false,
    bounds: false,
    silhouette: false,
    close: false,
  };
  onReady = () => {};
  private projectile!: Projectile;
  private equipment!: Equipment;
  private overlay!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private feedback!: PerformanceFeedback;
  private completionAt: number | null = null;
  private initiated = false;
  private recorded!: Attempt;
  private fixtureSeed = '';
  private timings: number[] = [];
  private fixture = createRecording(resolveScenario('cornhole-recorded'))
    .recording;
  constructor() {
    super('CharacterPerformanceLab');
  }
  preload() {
    queueReleaseHands(this);
    performanceDefinitions.forEach((d) => queueRig(this, d));
    queueArenaAssets(this);
  }
  create() {
    this.add.image(640, 380, 'arena-background').setDisplaySize(1280, 760);
    this.equipment = new Equipment(this);
    this.equipment.update('cornhole', []);
    this.projectile = new Projectile(this, 'cornhole', 0);
    this.feedback = new PerformanceFeedback(this);
    this.overlay = this.add.graphics().setDepth(100);
    this.reset();
    this.ready = true;
    this.onReady();
    this.events.once('shutdown', () => {
      this.playback?.destroy();
      this.projectile.destroy();
      this.controller.destroy();
      this.equipment.destroy();
      this.feedback.destroy();
    });
  }
  private chooseTake() {
    // Re-order the Lab setup before simulating, then choose an existing actual
    // outcome. No forced score, winner, contact, or post-simulation mutation.
    const setup = structuredClone(this.fixture.setup);
    if (this.selected === 'doug') {
      setup.participants.reverse();
      setup.characterAssets?.reverse();
    }
    for (let n = 0; n < 16; n++) {
      const recording = simulate({ ...setup, seed: `performance-lab:${n}` });
      const take = recording.attempts.find(
        (a) =>
          a.actor === 0 &&
          (this.outcome === 'success'
            ? a.contact === 'hole'
            : a.contact === this.outcome),
      );
      if (take) {
        this.fixtureSeed = `performance-lab:${n}`;
        return take;
      }
    }
    throw Error('No matching seeded recorded take');
  }
  reset(
    options: {
      character?: string;
      action?: string;
      outcome?: 'success' | 'board' | 'miss';
      profile?: PerformanceProfile;
    } = {},
  ) {
    const selected = options.character ?? this.selected;
    if (!['doug', 'dan'].includes(selected)) throw Error('Unknown character');
    const profile = validatePerformanceProfile(
      options.profile ??
        (selected !== this.selected
          ? performanceProfiles[selected as 'doug' | 'dan']
          : this.profile),
    );
    const action = options.action ?? this.action;
    if (profile.id !== selected)
      throw Error('Profile id must match the selected character');
    if (!['success', 'board', 'miss'].includes(options.outcome ?? this.outcome))
      throw Error('Unknown recorded take');
    if (!performanceActions(profile).has(action))
      throw Error('Unknown performance action');
    this.playback?.destroy();
    this.projectile?.detach();
    this.controller?.destroy();
    this.selected = selected;
    this.profile = profile;
    this.action = action;
    this.outcome = options.outcome ?? this.outcome;
    const definition = performanceDefinitions.find(
      (d) => d.id === this.selected,
    )!;
    this.runtime = new LoongBonesAdapter(this, definition, profile);
    const base = project({ x: 1, y: 0, z: 0 });
    this.runtime.root.setPosition(base.x, base.y).setDepth(40);
    this.controller = new CharacterPerformanceController(this.runtime, profile);
    this.recorded = this.chooseTake();
    this.playback = new CornholePerformancePlayback(
      this.controller,
      this.recorded,
    );
    this.controller.onEvent((e) => {
      if (e.name === 'ACTION_COMPLETED') this.completionAt = e.time;
      this.feedback.receive(e, placement('cornhole', 0).anchor);
    });
    this.elapsed = 0;
    this.initiated = false;
    this.completionAt = null;
    this.timings = [];
    this.feedback.reset();
    this.projectile.hide();
    this.render();
  }
  step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 15)
      throw Error('Step accepts 0–15 seconds');
    let left = seconds;
    while (left > 1e-9) {
      const dt = alignedSubstep(this.controller.time, left);
      if (!this.initiated && this.controller.time >= 0.6 - 1e-9) {
        this.initiated = true;
        if (this.action === 'cornholeThrow') this.playback!.start();
        else this.controller.perform(this.action);
      }
      this.controller.advance(dt);
      this.elapsed = this.controller.time;
      this.playback!.update();
      left -= dt;
    }
    this.render();
  }
  seek(time: number) {
    if (!Number.isFinite(time) || time < 0 || time > 15)
      throw Error('Seek accepts 0–15 seconds');
    this.playing = false;
    this.feedback.silent = true;
    try {
      this.reset();
      this.step(time);
    } finally {
      this.feedback.silent = false;
    }
  }
  setAudio(on: boolean) {
    this.feedback.setAudio(on);
  }
  applyProfile(input: unknown) {
    const profile = validatePerformanceProfile(input);
    if (profile.id !== this.selected)
      throw Error('Profile id must match the selected character');
    // Reconstruct the currently inspected instant with the same fixture.
    // seek silences feedback and pauses; it does not alter recorded outcomes.
    this.profile = profile;
    this.seek(this.elapsed);
  }
  private render() {
    const attachment = this.controller.attachments.current();
    if (this.controller.attachments.attached && attachment)
      this.projectile.hold(
        attachment.x,
        attachment.y,
        attachment.angle,
        attachment.scale,
        this.runtime.root.depth - 0.01,
        this.runtime.heldObjectLayer,
        attachment.flatten,
      );
    else if (this.playback?.frame)
      this.projectile.release(
        this.playback.frame,
        this.runtime.heldObjectLayer,
        this.runtime.attachment('rightHand'),
      );
    else this.projectile.hide();
    this.runtime.setSilhouette(this.view.silhouette);
    const base = project({ x: 1, y: 0, z: 0 });
    const zoom =
      (this.view.close ? 1.65 : 1) * this.feedback.draw(this.controller.time);
    this.cameras.main
      .setBackgroundColor(0xd8d2bf)
      .setZoom(zoom)
      .centerOn(
        this.view.close ? Math.max(1280 / 2 / zoom, base.x + 30) : 640,
        this.view.close ? base.y - 190 : 380,
      );
    this.overlay.clear();
    for (const l of this.labels) l.setVisible(false);
    if (!Object.values(this.view).some(Boolean)) return;
    const debug = this.runtime.inspect();
    let label = 0;
    if (this.view.skeleton)
      for (const bone of debug.bones) {
        const parent = debug.bones.find((b) => b.name === bone.parent);
        if (parent)
          this.overlay
            .lineStyle(1, 0x168a9c, 0.85)
            .lineBetween(bone.x, bone.y, parent.x, parent.y);
        this.overlay
          .fillStyle(bone.name.includes('target') ? 0xffb627 : 0x00b8cf)
          .fillCircle(bone.x, bone.y, 2);
        if (this.view.names) {
          const text =
            this.labels[label] ??
            (this.labels[label] = this.add
              .text(0, 0, '', {
                fontSize: '11px',
                color: '#073a44',
                backgroundColor: '#fff3d6',
              })
              .setDepth(101));
          text
            .setPosition(bone.x + 3, bone.y)
            .setText(bone.name)
            .setVisible(true);
          label++;
        }
      }
    if (this.view.attachments) {
      const hand = this.runtime.attachment('rightHand');
      for (const [point, color] of [
        [hand, 0xffbd35],
        [debug.chestTarget, 0x6bbf73],
        [debug.massProxy, 0xa759b9],
      ] as const)
        this.overlay.lineStyle(2, color).strokeCircle(point.x, point.y, 5);
      const release = this.playback?.release;
      if (release)
        this.overlay
          .lineStyle(2, 0xff613b)
          .strokeCircle(release.x, release.y, 7)
          .lineBetween(
            release.x,
            release.y,
            release.x + release.velocity.x * 0.12,
            release.y + release.velocity.y * 0.12,
          );
      for (const foot of debug.feet)
        this.overlay
          .lineStyle(1, 0x158955)
          .strokeCircle(foot.world.x, foot.world.y, 3);
    }
    if (this.view.bounds) {
      const b = debug.bounds;
      this.overlay
        .lineStyle(1, 0xa759b9, 0.8)
        .strokeRect(b.x, b.y, b.width, b.height);
    }
  }
  update(_time: number, delta: number) {
    if (!this.ready || !this.playing) return;
    this.timings.push(delta);
    if (this.timings.length > 300) this.timings.shift();
    this.step(Math.min(0.1, delta / 1000) * this.rate);
    if (
      this.completionAt !== null &&
      this.controller.time - this.completionAt > 0.8
    ) {
      if (this.loop) this.reset();
      else this.playing = false;
    }
  }
  refreshView() {
    this.render();
  }
  checkpoints() {
    if (this.action !== 'cornholeThrow') {
      let cursor = 0.6;
      return [
        { name: 'idle', time: 0 },
        ...this.controller.actions.get(this.action)!.segments.map((segment) => {
          const duration =
            segment.duration ?? this.runtime.clips.get(segment.clip)!.duration;
          const checkpoint = {
            name: segment.state,
            time: cursor + Math.min(0.4, duration / 2),
          };
          cursor += duration;
          return checkpoint;
        }),
      ];
    }
    const notice = 0.28 + (1 - this.profile.confidence) * 0.18;
    const duration = this.runtime.clips.get('underhand')!.duration;
    const begin = 0.6 + notice + 0.34;
    const release = begin + this.runtime.clips.get('underhand')!.markers[0].at;
    const reaction =
      Math.max(
        begin + duration,
        release +
          scoreTime(this.recorded) -
          this.recorded.releaseAt +
          this.profile.perception,
      ) + 0.02;
    const responseDuration = this.runtime.clips.get(
      this.outcome === 'miss' ? 'negative' : 'positive',
    )!.duration;
    return [
      { name: 'idle', time: 0 },
      { name: 'notice', time: 0.62 },
      { name: 'settle', time: 0.62 + notice },
      { name: 'anticipate', time: begin + 0.05 },
      { name: 'windup', time: begin + duration * 0.27 },
      { name: 'drive', time: begin + duration * 0.43 },
      { name: 'release', time: release + 0.004 },
      { name: 'followThrough', time: begin + duration * 0.64 },
      { name: 'watchTarget', time: begin + duration + 0.01 },
      {
        name: this.outcome !== 'miss' ? 'reactPositive' : 'reactNegative',
        time: reaction + 0.1,
      },
      ...(this.outcome === 'success'
        ? [
            {
              name: 'celebrate',
              time:
                reaction +
                responseDuration +
                (this.profile.celebration === 'chestTap' ? 22 / 60 : 0.3),
            },
          ]
        : []),
      {
        name: 'recover',
        time:
          reaction +
          responseDuration +
          (this.outcome === 'success'
            ? this.runtime.clips.get(this.profile.celebration)!.duration
            : 0) +
          0.08,
      },
    ];
  }
  snapshot() {
    return structuredClone({
      ready: this.ready,
      character: this.selected,
      action: this.action,
      elapsed: this.elapsed,
      playing: this.playing,
      loop: this.loop,
      rate: this.rate,
      performance: this.controller.snapshot(),
      rig: this.runtime.inspect(),
      playback: this.playback?.snapshot(),
      projectile: {
        ...this.projectile.worldFrame(),
        attached: this.projectile.attached,
      },
      view: this.view,
      cueCount: this.feedback.count,
      frameTiming: {
        samples: this.timings.length,
        p95: this.timings.length
          ? [...this.timings].sort((a, b) => a - b)[
              Math.floor(this.timings.length * 0.95)
            ]
          : null,
      },
      fixture: {
        seed: this.fixtureSeed,
        attempt: this.recorded?.id,
        mode: 'recorded',
        outcome: this.outcome,
      },
    });
  }
}
