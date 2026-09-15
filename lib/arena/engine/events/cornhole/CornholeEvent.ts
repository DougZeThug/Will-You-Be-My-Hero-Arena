import type {
  ArenaEvent,
  XY,
  ReleaseFrame,
  PersistentObject,
} from '../ArenaEvent';
import type { Attempt, Recording } from '../../../model';
import type { DirectedAction } from '../../core/BattlePlan';
import { sampleBag, bagOutcome } from './CornholePhysics';
import { surfacePoint, boardDepthScale } from '../../../equipment-layout';
import { clamp01 } from '../../../match-timeline';
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
  persistentObjects(time: number) {
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
    if (
      active?.boardResolution &&
      time >= active.contactAt - 0.18 &&
      time <= active.contactAt + 0.16
    )
      for (const hit of active.boardResolution.interactions) {
        const u = clamp01((time - active.contactAt + 0.18) / 0.34),
          v = u * u * (3 - 2 * u),
          from = surfacePoint('cornhole', active.actor, hit.from),
          to = surfacePoint('cornhole', active.actor, hit.to),
          q = {
            x: from.x + (to.x - from.x) * v,
            y: from.y + (to.y - from.y) * v,
          };
        frame(hit.id, active.actor, q, hit.after === 1 ? 1 : 1 - v);
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
