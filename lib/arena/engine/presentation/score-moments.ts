import { completionTime, scoreTime } from '../../match-timeline';
import { surfacePoint } from '../../equipment-geometry';
import { userById, type Attempt, type Recording } from '../../model';
import { CONTACT_CALLOUT } from './ArenaTheme';

/** How long a scoring callout stays on the court, and how long the
 * nameplate score pulses after a score lands (seconds of recording time). */
export const SCORE_CALLOUT_SECONDS = 1.3;
export const SCORE_PULSE_SECONDS = 0.35;

/** The latest revealed score change and where it happened. Presentation only:
 * a pure function of recording time, so pausing, seeking and replaying draw
 * the same frame and never award anything. */
export interface ScoreMoment {
  actor: 0 | 1;
  /** Points the attempt added to its thrower's revealed score. */
  delta: number;
  /** e.g. "+3 IN THE HOLE!" */
  text: string;
  /** Seconds since the score was revealed. */
  age: number;
  /** World point of the contact (the target on the court). */
  x: number;
  y: number;
}

const calloutText = (a: Attempt, delta: number) => {
  const label = CONTACT_CALLOUT[a.contact];
  return label ? `+${delta} ${label}` : `+${delta}`;
};

/** The score change revealed most recently at `time`, while its callout is
 * still showing; null when there is none or that attempt scored nothing. */
export function scoreMoment(rec: Recording, time: number): ScoreMoment | null {
  let index = -1;
  for (let j = 0; j < rec.attempts.length; j++)
    if (scoreTime(rec.attempts[j]) <= time) index = j;
  if (index < 0) return null;
  const a = rec.attempts[index],
    age = time - scoreTime(a);
  if (age >= SCORE_CALLOUT_SECONDS) return null;
  const before = index > 0 ? rec.attempts[index - 1].scoreAfter[a.actor] : 0,
    delta = a.scoreAfter[a.actor] - before;
  if (!(delta > 0)) return null;
  const at = surfacePoint(a.sport, a.actor, a.target);
  return { actor: a.actor, delta, text: calloutText(a, delta), age, ...at };
}

/** Extra nameplate-score scale for `actor` (0 = none): a short pulse when a
 * score lands. Reduced motion keeps the score still. */
export function scorePulse(
  moment: ScoreMoment | null,
  actor: number,
  reduced: boolean,
) {
  if (reduced || !moment || moment.actor !== actor) return 0;
  const u = moment.age / SCORE_PULSE_SECONDS;
  return u < 1 ? 0.28 * Math.sin(Math.PI * u) : 0;
}

/** The in-canvas FINAL stamp: the winning club member, as the result panel
 * names them, or DRAW; null before the match completes. */
export function finalStamp(rec: Recording, time: number) {
  const at = completionTime(rec);
  if (time < at) return null;
  const winner =
    rec.winner === null
      ? null
      : userById(rec.setup.participants[rec.winner]?.userId)?.name;
  return {
    text: winner ? `${winner.toUpperCase()} WINS` : 'DRAW',
    age: time - at,
  };
}
