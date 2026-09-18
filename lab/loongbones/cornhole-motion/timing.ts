import type { Recording } from '../../../lib/arena/model';
import { hash } from '../../../lib/arena/simulation';
import { directBattle } from '../../../lib/arena/engine/core/BattleDirector';
import { shotAlias } from './throws';
import motion from '../assets/cornhole-side-v3/provenance.json';
/** Timing of NEW internal fixtures only. Scores, target physics, outcomes and
 * historical saved recordings are never changed. */
export function timeCornholeFixture(source: Recording): Recording {
  const rec = structuredClone(source);
  let cursor = rec.introDuration;
  const plan = rec.direction!;
  for (const a of rec.attempts) {
    const character = a.actor ? 'doug' : 'dan';
    const clips: Record<string, { duration: number; release: number }> =
      motion[character].clips;
    const clip =
      clips[
        `cornhole_throw_${shotAlias(plan.actions[a.index].shot)}_R_${character}`
      ];
    a.start = cursor;
    a.releaseAt = cursor + 0.12 + clip.release;
    a.contactAt = a.releaseAt + a.duration;
    a.scoreAt = a.contactAt + 0.16;
    a.end = Math.max(a.scoreAt + 0.65, a.start + 0.12 + clip.duration + 0.18);
    cursor = a.end;
  }
  rec.duration = cursor + 2.6;
  rec.direction = directBattle(rec);
  // Settle is inside each authored throw, so do not insert a second full ritual
  // that would once again squeeze the swing into the last 430 milliseconds.
  rec.direction.actions.forEach((d) => (d.ritual = null));
  rec.direction.cues = rec.direction.cues.filter(
    (c) => !c.id.includes(':ritual:'),
  );
  rec.integrity = hash(JSON.stringify({ ...rec, integrity: '' }));
  return rec;
}
