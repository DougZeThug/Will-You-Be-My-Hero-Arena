import type {
  ArenaEvent,
  XY,
  ReleaseFrame,
  PersistentObject,
} from '../ArenaEvent';
import type { Attempt, Recording } from '../../../model';
import type { DirectedAction } from '../../core/BattlePlan';
import { sampleBag, bagOutcome } from './CornholePhysics';
import { pushedBag, type PushTiming } from './ReleasedBagPhysics';
import { surfacePoint, boardDepthScale } from '../../../equipment-layout';
export class CornholeEvent implements ArenaEvent {
  readonly sport = 'cornhole' as const;
  private recording?: Recording;
  initialize(recording: Recording) {
    if (recording.setup.sport !== 'cornhole')
      throw Error('Cornhole requires a cornhole recording.');
    this.recording = recording;
  }
  playIntro() {
    return { equipment: 'board', lanes: 2 };
  }
  performAction(
    a: Attempt,
    d: DirectedAction,
    release: ReleaseFrame,
    time: number,
  ) {
    return sampleBag(a, d.shot, release, time);
  }
  resolveResult(a: Attempt) {
    return {
      points: a.score,
      outcome: a.boardResolution?.outcome ?? a.contact,
    };
  }
  /** `pushStarts` (by pushed bag id): when the presented thrown bag reaches
   * each bag it pushes and how long the shove lasts. Without it a push keeps
   * its recorded window. */
  persistentObjects(
    time: number,
    pushStarts?: ReadonlyMap<string, PushTiming>,
  ) {
    const objects = new Map<string, PersistentObject>(),
      rec = this.recording;
    if (!rec) return [];
    const frame = (id: string, actor: number, q: XY, alpha = 1) =>
      objects.set(id, {
        id,
        actor,
        frame: {
          ...q,
          angle: -0.1,
          scale: boardDepthScale(actor),
          flatten: 0.52,
          alpha,
          ground: q,
        },
      });
    for (const actor of [0, 1]) {
      const contacts = rec.attempts.filter(
          (a) => a.actor === actor && a.contactAt <= time,
        ),
        last = contacts.at(-1),
        bags =
          last?.boardResolution?.bags ??
          contacts
            .filter((a) => a.contact === 'board')
            .map((a) => ({ id: a.id, position: a.target, score: a.score }));
      for (const bag of bags)
        if (bag.score === 1)
          frame(bag.id, actor, surfacePoint('cornhole', actor, bag.position));
    }
    const active = rec.attempts.find((a) => time >= a.start && time < a.end);
    if (active?.boardResolution)
      for (const hit of active.boardResolution.interactions) {
        // A presented push rests until the thrown bag arrives, leaves at its
        // speed and holds its end until the board state takes over at
        // contactAt; otherwise the recorded window.
        const drawn = pushedBag(active, hit, time, pushStarts?.get(hit.id));
        if (drawn)
          frame(hit.id, active.actor, { x: drawn.x, y: drawn.y }, drawn.alpha);
      }
    return [...objects.values()];
  }
  describe(a: Attempt, d: DirectedAction) {
    return bagOutcome(a, d.shot);
  }
  playReaction(d: DirectedAction) {
    return d.reaction;
  }
  finish() {
    this.recording = undefined;
  }
}
