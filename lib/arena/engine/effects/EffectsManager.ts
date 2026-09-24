import type * as Phaser from 'phaser';
import type { ArenaCue } from '../core/LiveTypes';
import { ImpactEffects } from './ImpactEffects';
/** Seconds each live effect cue stays on screen. */
const LIFE: Record<string, number> = {
  hit: 0.42,
  block: 0.3,
  dust: 0.5,
  impact: 0.5,
  hole: 0.6,
  miss: 0.45,
};
/** Live (Play) effect cues drawn as the same cartoon frames Watch uses: a star
 * and ring for a landed hit, a cool ring for a block, puffy dust where feet or
 * a bag meet the ground. Ages advance with real frame time, so effects keep
 * playing through a hit-stop. */
export class EffectsManager {
  private cues: {
    name: string;
    x: number;
    y: number;
    age: number;
    intensity: number;
  }[] = [];
  private impact: ImpactEffects;
  constructor(scene: Phaser.Scene) {
    this.impact = new ImpactEffects(scene);
  }
  cue(c: ArenaCue) {
    if (c.kind !== 'effect' || c.x === undefined || c.y === undefined) return;
    this.cues.push({
      name: c.name,
      x: c.x,
      y: c.y,
      age: 0,
      intensity: c.intensity ?? 0.3,
    });
    this.cues = this.cues.slice(-16);
  }
  update(dt: number, reduced: boolean) {
    this.impact.begin();
    this.cues = this.cues.filter((c) => c.age < (LIFE[c.name] ?? 0.3));
    for (const c of this.cues) {
      c.age += dt;
      if (reduced) continue;
      const u = c.age / (LIFE[c.name] ?? 0.3),
        i = Math.min(1, c.intensity);
      // Ground effects sort with the characters (depth = ground y); hits and
      // blocks draw in front of both fighters.
      if (c.name === 'hit') {
        this.impact.star(c.x, c.y, u, 0.45 + 0.4 * i, 1500);
        this.impact.burst(c.x, c.y, u * 1.2, 0xffd025, 1.2 + i, 1501);
      } else if (c.name === 'block')
        this.impact.burst(c.x, c.y, u, 0x18a1ad, 1.3, 1500);
      else if (c.name === 'dust')
        this.impact.puff(c.x, c.y + 4, u, 0.7 + 0.8 * i, c.y + 24);
      // Bag contacts: the puff sits under the bag (depth 1300), the ring over it.
      else if (c.name === 'hole') {
        this.impact.star(c.x, c.y - 10, u, 0.7, 1500);
        this.impact.puff(c.x, c.y + 6, u * 1.2, 0.5, 1299);
      } else if (c.name === 'impact' || c.name === 'miss') {
        this.impact.burst(c.x, c.y, u * 1.3, c.name === 'miss' ? 0xe79959 : 0xffce25, 1, 1301);
        this.impact.puff(c.x, c.y + 6, u, 0.5, 1299);
      } else this.impact.burst(c.x, c.y, u, 0xffd025, 1, 1500);
    }
  }
  destroy() {
    this.impact.destroy();
  }
}
