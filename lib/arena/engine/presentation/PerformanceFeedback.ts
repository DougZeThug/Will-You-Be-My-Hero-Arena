import * as Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import type { PerformanceEvent } from '../performance/PerformanceTypes';

/** Presentation subscribes to facts. Its cues never change the character or score.
 * All visual envelopes sample the same performance clock, including pause/speed. */
export class PerformanceFeedback {
  private audio = new AudioManager();
  private marks: { at: number; x: number; y: number; positive: boolean }[] = [];
  private graphic: Phaser.GameObjects.Graphics;
  private releaseAt = -100;
  private anticipationAt = -100;
  count = 0;
  silent = false;
  constructor(scene: Phaser.Scene) {
    this.graphic = scene.add.graphics().setDepth(70);
  }
  receive(e: PerformanceEvent, target: { x: number; y: number }) {
    if (this.silent) return;
    if (e.name === 'ANTICIPATION_STARTED') {
      this.anticipationAt = e.time;
    } else if (e.name === 'OBJECT_RELEASED') {
      this.releaseAt = e.time;
      this.count++;
      this.audio.cue({ kind: 'audio', name: 'release' });
    } else if (e.name === 'RESULT_CONFIRMED') {
      this.count++;
      this.marks.push({
        at: e.time,
        ...target,
        positive: e.detail === 'success',
      });
      if (this.marks.length > 4) this.marks.shift();
      this.audio.cue({
        kind: 'audio',
        name: e.detail === 'success' ? 'hole' : 'boardImpact',
      });
    } else if (e.name === 'CELEBRATION_CONTACT') {
      this.count++;
      this.audio.cue({ kind: 'audio', name: 'boardImpact' });
    }
  }
  draw(time: number) {
    this.graphic.clear();
    for (const mark of this.marks) {
      const age = time - mark.at;
      if (age < 0 || age > 0.45) continue;
      const alpha = (1 - age / 0.45) * 0.65;
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI + (i * Math.PI) / 4,
          travel = 9 + age * 55;
        this.graphic
          .fillStyle(mark.positive ? 0xf4c45d : 0xe39161, alpha)
          .fillCircle(
            mark.x + Math.cos(angle) * travel,
            mark.y + Math.sin(angle) * travel,
            2.5 * (1 - age),
          );
      }
    }
    const age = time - this.anticipationAt;
    const push =
      age >= 0 && age < 1.2 ? 0.005 * Math.sin((Math.PI * age) / 1.2) ** 2 : 0;
    return (
      1 + push + 0.004 * Math.exp(-Math.max(0, time - this.releaseAt) * 12)
    );
  }
  setAudio(enabled: boolean) {
    this.audio.setEnabled(enabled);
  }
  reset() {
    this.marks = [];
    this.releaseAt = -100;
    this.anticipationAt = -100;
    this.count = 0;
    this.graphic.clear();
  }
  destroy() {
    this.graphic.destroy();
    this.audio.destroy();
  }
}
