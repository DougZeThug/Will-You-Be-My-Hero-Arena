import * as Phaser from 'phaser';
import type { ArenaCharacter } from './ArenaCharacter';
import type { LoadedCharacter } from '../scenes/CharacterAssetLoader';
import { createCharacterRig } from './createCharacterRig';
import { PaperCharacterRig } from './PaperCharacterRig';
import type { CharacterRig } from './CharacterRig';
import type { CharacterRigProvider } from './CharacterRig';
import { clamp } from '../input/InputActions';
import { mixPuppet } from '../../puppet-motion';
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
  private releaseScale = 1;
  private scoreAtThrow = 0;
  constructor(
    scene: Phaser.Scene,
    loaded: LoadedCharacter,
    private character: ArenaCharacter,
    private index: number,
    provider?: CharacterRigProvider,
  ) {
    this.rig =
      provider?.create(scene, loaded, character.profile, { lane: index }) ??
      createCharacterRig(scene, loaded, character.profile, true);
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
  /** `alpha` is the session's fraction into the next fixed step: body and
   * pose are drawn between the previous and current step. */
  update(time: number, alpha = 1) {
    const c = this.character,
      b = presentedBody(c, alpha),
      u = clamp((time - this.index * 0.2) / 1.05),
      ease = u * u * (3 - 2 * u),
      offset = (1 - ease) * -55,
      lift = Math.sin(ease * Math.PI) * 26;
    this.rig.root
      .setPosition(b.x + offset, b.y - b.z - lift)
      .setScale(
        (this.rig.performance ? 1 : b.scale) * (0.45 + 0.55 * ease) * b.facing,
        (this.rig.performance ? 1 : b.scale) * (0.45 + 0.55 * ease),
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
      .setScale(b.scale * (1 - b.z / 600), b.scale)
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
  private updatePerformance(dt: number) {
    const performance = this.rig.performance;
    if (!performance) return;
    const timeline = this.character.animation.timeline;
    if (
      timeline.revision !== this.timelineRevision &&
      timeline.clip.startsWith('throw.')
    ) {
      this.timelineRevision = timeline.revision;
      this.resultReported = false;
      this.scoreAtThrow = this.character.score;
      this.performanceAction = performance.perform('liveCornholeThrow', {
        objectId: 'held',
        queue: false,
      });
      const marker = performance.runtime.clips
        .get('underhand')
        ?.markers.find((m) => m.name === 'equipmentRelease')?.at;
      const liveReleaseMarker = this.character.animation
        .resolve(timeline.clip)
        .markers.find((m) => m.name === 'release')?.at;
      const liveRelease =
        liveReleaseMarker === undefined
          ? undefined
          : liveReleaseMarker * timeline.duration;
      this.releaseScale = marker && liveRelease ? marker / liveRelease : 1;
    }
    const snapshot = performance.snapshot();
    performance.advance(snapshot.released ? dt : dt * this.releaseScale);
    if (
      this.performanceAction &&
      !this.resultReported &&
      this.character.substate === 'result'
    ) {
      this.resultReported = true;
      performance.confirmContact(this.performanceAction);
      performance.confirmResult(
        this.performanceAction,
        this.character.score > this.scoreAtThrow,
        this.character.score > this.scoreAtThrow,
      );
    }
    if (this.performanceAction && performance.snapshot().action === null)
      this.performanceAction = null;
    if (!this.performanceAction)
      performance.observe({
        mode: this.character.substate === 'waiting' ? 'prepare' : 'rest',
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
