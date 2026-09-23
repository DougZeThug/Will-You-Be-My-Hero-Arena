import * as Phaser from 'phaser';
import type { ArenaCharacter } from './ArenaCharacter';
import type { LoadedCharacter } from '../scenes/CharacterAssetLoader';
import { createCharacterRig } from './createCharacterRig';
import { PaperCharacterRig } from './PaperCharacterRig';
import type { CharacterRig } from './CharacterRig';
import type { CharacterRigProvider } from './CharacterRig';
import { clamp } from '../input/InputActions';
import { mixPuppet } from '../../puppet-motion';
import { squashOffset, squashScale } from '../motion/SquashStretch';
/** Body transform between the previous and current fixed step. Facing is not
 * interpolated (a flip is a discrete event). */
export function presentedBody(c: ArenaCharacter, alpha: number) {
  const b = c.body,
    p = c.previous?.body;
  if (!p || alpha >= 1) return b;
  const at = (a: number, z: number) => a + (z - a) * alpha;
  return {
    ...b,
    x: at(p.x, b.x),
    y: at(p.y, b.y),
    z: at(p.z, b.z),
    scale: at(p.scale, b.scale),
  };
}
export class CharacterPresentation {
  private rig: CharacterRig;
  private card: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private timelineRevision = -1;
  private performanceAction: number | null = null;
  private resultReported = false;
  private liveRelease: number | null = null;
  private rate = 1;
  private scoreAtThrow = 0;
  private facing?: number;
  private flipFrom = 1;
  private flipAt = -Infinity;
  private drivenAt?: number;
  constructor(
    scene: Phaser.Scene,
    loaded: LoadedCharacter,
    private character: ArenaCharacter,
    private index: number,
    provider?: CharacterRigProvider,
    private reduced = false,
  ) {
    this.rig =
      provider?.create(scene, loaded, character.profile, {
        lane: index,
        scale: character.body.scale,
      }) ?? createCharacterRig(scene, loaded, character.profile, true);
    if (this.rig.performance) {
      character.setPresentedHand(() => this.hand());
      character.attach({
        can: () => false,
        perform: () => false,
        update: (dt) => this.updatePerformance(dt),
        cleanup: () => character.setPresentedHand(),
      });
    }
    if (this.rig instanceof PaperCharacterRig)
      this.rig.shadow.setVisible(false);
    this.shadow = scene.add.ellipse(0, 0, 80, 10, 0x201a13, 0.26);
    this.shadow.setVisible(
      !('performance' in this.rig && this.rig.performance),
    );
    this.glow = scene.add.graphics();
    this.card = scene.add.container(0, 0, [
      this.glow,
      scene.add
        .rectangle(0, -68, 96, 140, 0xfff0cc)
        .setStrokeStyle(3, 0xffcc25),
      scene.add.image(0, -68, loaded.cardKey).setDisplaySize(86, 126),
    ]);
  }
  /** Cartoon beats from the simulation: stretch on takeoff, squash on
   * landing, recoil on a hit. Evaluated from the beat times, so it is
   * deterministic and follows pause and hit-stop. */
  private squash(time: number) {
    const beats = this.character.beats,
      pulses = [];
    if (beats.takeoff !== undefined)
      pulses.push({ at: beats.takeoff, amount: 0.12, settle: 0.22, frequency: 2.4 });
    if (beats.land !== undefined)
      pulses.push({ at: beats.land, amount: -0.16, settle: 0.3, frequency: 4 });
    if (beats.hit !== undefined)
      pulses.push({ at: beats.hit, amount: -0.1, settle: 0.26, frequency: 5 });
    return squashScale(squashOffset(pulses, time));
  }
  /** Facing turns as a quick paper flip (~0.1 s) instead of a one-frame
   * mirror. */
  private turn(facing: number, time: number) {
    if (this.facing !== undefined && facing !== this.facing) {
      this.flipFrom = this.shownFacing(time);
      this.flipAt = time;
    }
    this.facing = facing;
    return this.shownFacing(time);
  }
  private shownFacing(time: number) {
    const facing = this.facing ?? 1,
      u = clamp((time - this.flipAt) / 0.1),
      f = this.flipFrom + (facing - this.flipFrom) * u * u * (3 - 2 * u);
    return u >= 1 ? facing : Math.sign(f || facing) * Math.max(0.04, Math.abs(f));
  }
  /** `alpha` is the session's fraction into the next fixed step: body and
   * pose are drawn between the previous and current step. `hold` is the
   * remaining hit-stop; the fighter who was just hit shivers through it. */
  update(time: number, alpha = 1, hold = 0) {
    if (this.rig.drive) return this.drive(time, alpha);
    const c = this.character,
      b = presentedBody(c, alpha),
      shown = time - (1 - alpha) / 60,
      u = clamp((time - this.index * 0.2) / 1.05),
      ease = u * u * (3 - 2 * u),
      offset = (1 - ease) * -55,
      lift = Math.sin(ease * Math.PI) * 26,
      q = this.rig.performance ? { x: 1, y: 1 } : this.squash(shown),
      facing = this.rig.performance ? b.facing : this.turn(b.facing, shown),
      shiver = hold > 0 && c.beats.hit === time ? (hold % 2 ? 3 : -3) : 0;
    this.rig.root
      .setPosition(b.x + offset + shiver, b.y - b.z - lift)
      .setScale(
        (this.rig.performance ? 1 : b.scale) * (0.45 + 0.55 * ease) * facing * q.x,
        (this.rig.performance ? 1 : b.scale) * (0.45 + 0.55 * ease) * q.y,
      )
      .setDepth(b.y + 20)
      .setAlpha(clamp(u * 4));
    const clip =
      c.animation.timeline.clip || c.animation.locomotion || c.animation.idle;
    if (!this.rig.performance)
      this.rig.apply(
        alpha < 1 && c.previous
          ? mixPuppet(c.previous.pose, c.animation.pose, alpha)
          : c.animation.pose,
        clip,
        c.animation.timeline.clip
          ? c.animation.timeline.progress
          : (time / 2) % 1,
      );
    this.shadow
      .setPosition(b.x, b.y + 2)
      .setScale(b.scale * (1 - b.z / 600) * q.x, b.scale)
      .setDepth(b.y - 2)
      .setAlpha(0.27 * Math.max(0.2, 1 - b.z / 150));
    this.card
      .setPosition(b.x - 83, b.y - 8)
      .setDepth(b.y - 1)
      .setScale(0.74)
      .setAlpha(0.8);
    this.glow.clear();
    if (u < 1)
      this.glow
        .lineStyle(6, 0xffcf25, Math.sin(u * Math.PI) * 0.65)
        .strokeRect(-54, -143, 108, 153);
  }
  /** A side-view motion rig animates and places itself from the presented
   * body; its velocity is the simulation's own step displacement. */
  private drive(time: number, alpha: number) {
    const c = this.character,
      b = presentedBody(c, alpha),
      p = c.previous?.body ?? c.body,
      shown = time - (1 - alpha) / 60;
    this.rig.drive!({
      x: b.x,
      y: b.y,
      z: b.z,
      vx: (c.body.x - p.x) * 60,
      vy: (c.body.y - p.y) * 60,
      facing: b.facing,
      scale: b.scale,
      time: shown,
      dt: this.drivenAt === undefined ? 1 / 60 : shown - this.drivenAt,
      clip: c.animation.timeline.clip,
      clipRevision: c.animation.timeline.revision,
      clipDuration: c.animation.timeline.duration,
      substate: c.substate,
      reduced: this.reduced,
    });
    this.drivenAt = shown;
    this.shadow
      .setPosition(b.x, b.y + 2)
      .setScale(b.scale * (1 - b.z / 600), b.scale)
      .setDepth(b.y - 2)
      .setAlpha(0.27 * Math.max(0.2, 1 - b.z / 150));
    // The card trails its runner but sorts behind the runner in the next lane
    // up (lanes are 62 px apart), so it never hides a profile stride.
    this.card
      .setPosition(b.x - 83, b.y - 8)
      .setDepth(b.y - 45)
      .setScale(0.74)
      .setAlpha(0.8);
    this.glow.clear();
  }
  /**
   * Live cornhole clock. The charge plays the take's settle and backswing at
   * authored speed and eases into a hold at the top of the backswing. The
   * release input then plays the drive so the take's release marker lands on
   * the live release step: at authored speed after a normal charge (holding
   * any spare time at the top), faster only when the player skips the charge.
   * The playback rate is smoothed so the swing never changes speed in a step.
   * (It used to play the whole pre-release take at ~3x, then snap to 1x.)
   */
  private updatePerformance(dt: number) {
    const performance = this.rig.performance;
    if (!performance) return;
    const c = this.character,
      timeline = c.animation.timeline;
    const underhand = performance.runtime.clips.get('underhand');
    const marker = (name: string) =>
      underhand?.markers.find((m) => m.name === name)?.at;
    const releaseAt = marker('equipmentRelease') ?? 0,
      peakAt = marker('windupPeak') ?? releaseAt;
    const start = () => {
      if (performance.state === 'recover') performance.cancel();
      this.performanceAction = performance.perform('liveCornholeThrow', {
        objectId: 'held',
        queue: false,
      });
      this.resultReported = false;
      this.scoreAtThrow = c.score;
      this.liveRelease = null;
      this.rate = 1;
    };
    if (c.substate === 'charging' && this.performanceAction === null) start();
    if (
      timeline.revision !== this.timelineRevision &&
      timeline.clip.startsWith('throw.')
    ) {
      this.timelineRevision = timeline.revision;
      if (this.performanceAction === null || performance.released) start();
      const liveMarker = c.animation
        .resolve(timeline.clip)
        .markers.find((m) => m.name === 'release')?.at;
      this.liveRelease =
        liveMarker === undefined ? null : liveMarker * timeline.duration;
    }
    // An abandoned charge (pause, blur) lets go of the unreleased swing.
    if (
      this.performanceAction !== null &&
      this.liveRelease === null &&
      !performance.released &&
      c.substate !== 'charging'
    ) {
      performance.cancel(this.performanceAction);
      this.performanceAction = null;
    }
    let target = 1;
    if (
      this.performanceAction !== null &&
      !performance.released &&
      performance.segmentClip === 'underhand'
    ) {
      const t = performance.segmentTime;
      if (this.liveRelease === null)
        // Charging: ease into a held top of the backswing.
        target = Math.max(0, Math.min(1, (peakAt + 0.05 - t) / 0.2));
      else {
        const remaining = releaseAt - t,
          left = this.liveRelease - timeline.time;
        // Hold spare time at the top, then drive at authored speed; compress
        // only when the charge was skipped. The last step lands exactly.
        target =
          left <= dt
            ? remaining / dt
            : remaining >= left
              ? remaining / left
              : t < peakAt
                ? 1
                : left - remaining > dt
                  ? 0
                  : remaining / left;
        target = Math.max(0, Math.min(6, target));
      }
    }
    const exact =
      this.liveRelease !== null &&
      !performance.released &&
      this.liveRelease - timeline.time <= dt;
    this.rate = exact ? target : this.rate + (target - this.rate) * 0.35;
    performance.advance(dt * this.rate);
    if (
      this.performanceAction &&
      !this.resultReported &&
      c.substate === 'result'
    ) {
      this.resultReported = true;
      performance.confirmContact(this.performanceAction);
      performance.confirmResult(
        this.performanceAction,
        c.score > this.scoreAtThrow,
        c.score > this.scoreAtThrow,
      );
    }
    if (this.performanceAction && performance.segmentClip === null) {
      this.performanceAction = null;
      this.liveRelease = null;
    }
    if (!this.performanceAction)
      performance.observe({
        mode: c.substate === 'waiting' ? 'prepare' : 'rest',
        elapsed: performance.time,
      });
  }
  get backend() {
    return this.rig.backend ??
      (this.rig instanceof PaperCharacterRig ? 'paper' : 'frames');
  }
  debugInfo() {
    return this.rig.debugInfo?.();
  }
  get heldObjectLayer() {
    return this.rig.heldObjectLayer;
  }
  hand() {
    const local = this.rig.socketTransform?.('throwingHand') ?? {
      ...this.rig.socket('throwingHand'),
      angle: 0,
    };
    const matrix = this.rig.root.getWorldTransformMatrix();
    const world = matrix.transformPoint(local.x, local.y);
    return { x: world.x, y: world.y, angle: local.angle };
  }
  destroy() {
    this.rig.destroy();
    this.card.destroy(true);
    this.shadow.destroy();
  }
}
