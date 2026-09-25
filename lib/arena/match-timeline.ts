import {
  EVENTS,
  type Attempt,
  type Recording,
  type Sport,
  type MotionPersonality,
} from './model';
import {
  motionStyle,
  DAN_PERSONALITY,
  DOUG_PERSONALITY,
  DEFAULT_PERSONALITY,
} from './personality';
import type { ShotStyle } from './engine/animation/AnimationTypes';
import type { DirectedAction } from './engine/core/BattlePlan';
import { firstImpactTime } from './engine/events/cornhole/CornholePresentationTiming';

// Seconds on PlaybackClock, never wall-clock timers. Sampling is safe when
// paused, slowed, resumed, or sought backwards through an immutable recording.
export const TIMING = {
  entrance: 2.65,
  stagger: 0.74,
  ready: 0.12,
  anticipation: 0.22,
  throw: 0.22,
  release: 0.05,
  landing: 0.16,
  result: 0.4,
  reset: 0.26,
  finale: 2,
} as const;
export type MatchPhase =
  | 'entrance'
  | 'ready'
  | 'anticipation'
  | 'throw'
  | 'release'
  | 'bagFlight'
  | 'boardTravel'
  | 'landing'
  | 'result'
  | 'reset'
  | 'complete';
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};
export const flightDuration = (sport: Sport) =>
  sport === 'football' ? 0.78 : sport === 'basketball' ? 1.38 : 1.25;
export const releaseLead = TIMING.ready + TIMING.anticipation + TIMING.throw;
export function personalityTiming(
  sport: Sport,
  personality: MotionPersonality = DEFAULT_PERSONALITY,
  index = 0,
) {
  const p = motionStyle(personality),
    variation =
      (((index + personality.seed) % 3) - 1) * 0.018 * personality.energy;
  const lead = Math.max(
    0.43,
    Math.min(
      0.72,
      (p.ready + p.anticipation + p.throw) / personality.tempo + variation,
    ),
  );
  // Preserve enough time for a complete gesture after the score has resolved.
  const result = p.result;
  return {
    lead,
    result,
    reset: p.reset,
    length: lead + flightDuration(sport) + TIMING.landing + result + p.reset,
  };
}
export const attemptLength = (
  sport: Sport,
  personality?: MotionPersonality,
  index = 0,
) =>
  personality
    ? personalityTiming(sport, personality, index).length
    : releaseLead +
      flightDuration(sport) +
      TIMING.landing +
      TIMING.result +
      TIMING.reset;
export const matchEstimate = (sport: Sport) =>
  TIMING.entrance +
  Array.from({ length: EVENTS[sport].attempts * 2 }, (_, i) =>
    attemptLength(sport, i % 2 ? DOUG_PERSONALITY : DAN_PERSONALITY, i),
  ).reduce((a, b) => a + b, 0) +
  TIMING.finale;
export const scoreTime = (a: Attempt) =>
  a.scoreAt ?? a.contactAt + TIMING.landing;
export const completionTime = (rec: Recording) =>
  rec.attempts.at(-1)?.end ?? rec.introDuration;
export function attemptBeats(a: Attempt, shot?: ShotStyle) {
  const lead = a.releaseAt - a.start,
    p = a.personality ? motionStyle(a.personality) : TIMING,
    total = p.ready + p.anticipation + p.throw;
  return {
    ready: a.start,
    anticipation: a.start + (lead * p.ready) / total,
    throw: a.start + (lead * (p.ready + p.anticipation)) / total,
    release: a.releaseAt,
    bagFlight: a.releaseAt + TIMING.release,
    boardTravel:
      a.sport === 'cornhole' && shot ? firstImpactTime(a, shot) : a.contactAt,
    landing: a.contactAt,
    result: scoreTime(a),
    reset: Math.max(scoreTime(a), a.end - p.reset),
    end: a.end,
  };
}
export function attemptState(a: Attempt, time: number, shot?: ShotStyle) {
  const beats = attemptBeats(a, shot),
    phases = (
      a.sport === 'cornhole' && shot && beats.boardTravel < beats.landing
        ? [
            'ready',
            'anticipation',
            'throw',
            'release',
            'bagFlight',
            'boardTravel',
            'landing',
            'result',
            'reset',
          ]
        : [
            'ready',
            'anticipation',
            'throw',
            'release',
            'bagFlight',
            'landing',
            'result',
            'reset',
          ]
    ) as Exclude<keyof typeof beats, 'end'>[];
  const index = phases.findLastIndex((phase) => time >= beats[phase]),
    phase = phases[Math.max(0, index)];
  const end =
    index < phases.length - 1 ? beats[phases[Math.max(0, index) + 1]] : a.end;
  return {
    phase,
    progress: clamp01(
      (time - beats[phase]) / Math.max(0.001, end - beats[phase]),
    ),
    beats,
    held: time >= a.start && time < a.releaseAt,
    flightElapsed: time - a.releaseAt,
  };
}
/**
 * Attempts shown for one competitor so far: the regulation attempts, plus
 * extra pairs only once the first of them has begun, so the total never gives
 * away that a contest will be tied.
 */
export function shownAttempts(rec: Recording, time: number, actor: 0 | 1) {
  const regulation = EVENTS[rec.setup.sport].attempts,
    started = rec.attempts.reduce(
      (round, a) => (a.start <= time ? Math.max(round, a.round) : round),
      -1,
    );
  return rec.attempts.filter(
    (a) => a.actor === actor && (a.round < regulation || a.round <= started),
  ).length;
}
export function matchState(
  rec: Recording,
  time: number,
  actions: DirectedAction[] | undefined = rec.direction?.actions,
) {
  const contacts = rec.attempts.filter((a) => a.contactAt <= time),
    resolved = rec.attempts.filter((a) => scoreTime(a) <= time);
  const current = rec.attempts.find((a) => time >= a.start && time < a.end),
    directed = current
      ? actions?.find((d) => d.attemptId === current.id)
      : undefined,
    action = current ? attemptState(current, time, directed?.shot) : null,
    complete = time >= completionTime(rec);
  const phase: MatchPhase =
    time < rec.introDuration
      ? 'entrance'
      : complete
        ? 'complete'
        : (action?.phase ?? 'ready');
  return {
    contacts,
    resolved,
    current,
    action,
    phase,
    scores: resolved.at(-1)?.scoreAfter ?? [0, 0],
    complete,
  };
}
