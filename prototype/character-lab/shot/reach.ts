// THE REACH, on its own: "load his weight, extend across his body, then return to ready
// without a cut", with both feet planted throughout.
//
// It starts in exactly the pose buildShot shows at its `ready` key (frame 76: left foot
// leading, front three-quarter facing screen-right) and stands on the same two plants. The
// extension reuses buildShot's own reach keys (reachLead, reachOut, reachSettle, reachHold)
// at the same spacing as buildShot frames 80 / 88 / 93 / 100 after a start at 76, so the reach
// itself is the same motion; what is new is the LOAD before it and the RECOVERY after it.
// Same solver, same conventions (see shot.ts). True 3D pose, nothing staged for a camera.
import { smooth } from '../core/math';
import type { Frame, Proportions } from '../core/types';
import {
  SHOT_POSES,
  T,
  arm,
  buildTracks,
  readyPlant,
  shotChannelsAt,
  solveShot,
} from './shot';
import type { ShotBeat, ShotPose, TimelineKey } from './shot';

/** Frame numbers of the beats (60 fps). */
export const R = {
  hold: 0,
  load: 20,
  extend: 32,
  recover: 56,
  settled: 80,
  end: 100,
} as const;

export const REACH_BEATS: ShotBeat[] = [
  { name: 'hold', from: R.hold, to: R.load },
  { name: 'load', from: R.load, to: R.extend },
  { name: 'extend', from: R.extend, to: R.recover },
  { name: 'recover', from: R.recover, to: R.settled },
  { name: 'settled', from: R.settled, to: R.end },
];

export const REACH_FRAME_COUNT = R.end;

/** A frame of the reach: core's Frame plus an optional finger curl per hand. */
export interface ReachFrame extends Frame {
  /** 0 = flat open hand, 0.5 = cupped, 1 = closed fist */
  curl?: { L: number; R: number };
}

const CURL_REST = 0.35;
const CURL_OPEN = 0.1;

const PRON_REST = 1.75;

/** The key poses that are new here (the reach keys themselves come from shot.ts). */
export const REACH_POSES: Record<string, ShotPose> = {
  // LOAD: sit back onto the right (rear) foot, away from the reach; knees soften, the chest
  // winds to his right, the reaching arm draws back with the elbow behind him, the far arm
  // comes forward to balance. The head is keyed separately so it is on the target first.
  load: {
    ps: 0.642,
    pt: 0.05,
    dip: 0.15,
    yP: -12,
    rho: -0.06,
    pit: 0.13,
    rol: 0.14,
    sq: 0.975,
    ...arm('L', { phi: 0.3, alp: 0.08, eps: 1.05 }),
  },
  // the reaching arm reaches its drawn-back extreme BEFORE the body bottoms out, so it is
  // already coming forward when the weight starts across (and the reach keeps its timing)
  loadArm: arm('R', {
    phi: -0.4,
    alp: 0.38,
    tw: 0.2,
    eps: 1.4,
    bet: -0.15,
    pro: PRON_REST,
    prt: -0.03,
    elv: 0.015,
  }),
  // RECOVER 1: the chest and shoulder let go first; the elbow folds, the hand is left behind
  unwind: {
    ps: 0.735,
    pt: -0.03,
    yC: 13,
    rho: 0.03,
    pit: 0.22,
    rol: -0.06,
    ...arm('R', {
      phi: 0.86,
      alp: -0.26,
      tw: 1.4,
      eps: 1.45,
      bet: -0.18,
      prt: 0.012,
      elv: 0.008,
    }),
    ...arm('L', { phi: -0.5, alp: 0.38 }),
  },
  // RECOVER 2: weight comes back past centre and sinks a little; the hand drops, trailing
  drop: {
    ps: 0.68,
    pt: 0.02,
    dip: 0.095,
    yP: -6,
    yC: -8,
    rho: -0.02,
    pit: 0.09,
    rol: 0.03,
    sq: 0.99,
    ...arm('R', {
      phi: 0.26,
      alp: 0.22,
      tw: 0.4,
      eps: 1.0,
      bet: -0.18,
      pro: 2.2,
      prt: 0,
      elv: 0,
    }),
    ...arm('L', { phi: 0.06, alp: 0.32, eps: 0.72 }),
  },
  // RECOVER 3: the small overshoot: up and forward again, arm swings past rest and hangs long
  over: {
    ps: 0.716,
    pt: -0.014,
    dip: 0.04,
    yP: -7.5,
    yC: -2,
    rho: 0.008,
    pit: 0.16,
    rol: -0.01,
    sq: 1.006,
    ...arm('R', {
      phi: -0.06,
      alp: 0.34,
      tw: 0,
      eps: 0.48,
      bet: 0.14,
      pro: PRON_REST,
    }),
    ...arm('L', { phi: 0.2, alp: 0.28, eps: 0.76 }),
  },
};

function timeline(): TimelineKey[] {
  // the ready pose exactly as buildShot plays it at its `ready` key
  const ready = shotChannelsAt(T.reach);
  const { yH, hPi, hRo, ...body } = ready;
  const head: ShotPose = { yH, hPi, hRo };
  const E = R.extend;
  return [
    [0, ready, 'f'],
    [R.load, ready, 'f'],
    // head first: already on the target while the body is still going back
    [R.load + 7, { yH: 27, hPi: 0.06 }, 'f'],
    // the chest finishes winding before the hips finish sitting
    [E - 5, { yC: -18 }, 'f'],
    [E - 5, 'loadArm', 'f'],
    [E - 1, 'load', 'f'],
    // buildShot's reach, at buildShot's spacing from its frame 76
    [E + 4, 'reachLead', 'a'],
    [E + 12, 'reachOut', 'f'],
    [E + 17, 'reachSettle', 'f'],
    [E + 24, 'reachHold', 'f'],
    [R.recover + 4, 'unwind', 'a'],
    [R.recover + 10, 'drop', 'a'],
    [R.recover + 16, 'over', 'f'],
    [R.recover + 21, body, 'f'],
    // head last: it stays on the target while the body leaves, then comes home
    [R.recover + 6, { yH: 49, hPi: -0.02 }, 'f'],
    [R.recover + 15, { yH: 16 }, 'a'],
    [R.settled - 1, head, 'f'],
    [R.end, ready, 'f'],
  ];
}

/** Piecewise smooth scalar through [frame, value] keys (holds outside them). */
function keyed(keys: [number, number][], f: number): number {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (f <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return v0 + (v1 - v0) * smooth((f - t0) / (t1 - t0));
    }
  return keys[keys.length - 1][1];
}

export function buildReach(proportions: Proportions): ReachFrame[] {
  const E = R.extend;
  // the unloaded rear heel peels as the weight goes onto the lead foot, and comes back down
  const heel: [number, number][] = [
    [E + 6, 0],
    [E + 13, 0.34],
    [R.recover + 2, 0.3],
    [R.recover + 9, 0],
  ];
  const curl: [number, number][] = [
    [E + 2, CURL_REST],
    [E + 12, CURL_OPEN],
    [R.recover + 2, CURL_OPEN],
    [R.recover + 13, CURL_REST],
  ];
  return solveShot(proportions, {
    frames: R.end,
    tracks: buildTracks(timeline(), { ...SHOT_POSES, ...REACH_POSES }),
    beats: REACH_BEATS,
    // one breath over the loop, zero on the first and last frame so they are the same pose
    breath: (f) => {
      const calm = Math.max(
        1 - smooth((f - (R.load - 4)) / 6),
        smooth((f - (R.settled - 8)) / 10),
      );
      return (
        Math.sin((f / (R.end - 1)) * Math.PI * 2) * (0.25 + 0.75 * calm)
      );
    },
    hands: (f) => ({
      L: 'relaxed',
      R: f >= E + 6 && f < R.recover + 8 ? 'open' : 'relaxed',
    }),
    feet: (side, f, plantWorld) => ({
      ...plantWorld(readyPlant(side), side),
      lift: 0,
      pitch: side === 'R' ? keyed(heel, f) : 0,
      toeFlat: 1,
      planted: true,
    }),
    extra: (f) => ({ curl: { L: CURL_REST, R: keyed(curl, f) } }),
  }) as ReachFrame[];
}
