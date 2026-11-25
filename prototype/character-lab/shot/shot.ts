// THE SHOT: one authored 3D performance for the construction comparison.
//   "Doug takes two quick steps, plants, reaches across his body, and snaps into a turn."
// Pose-to-pose, not the procedural animator: named KEY POSES on a frame timeline, per-channel
// offsets (overlap), a step plan with WORLD-LOCKED plants, then a solve to joints and bases
// that follows core/sim.ts's conventions exactly (see segmentBases).
//
// Staging at camera yaw 0: Doug starts in the front three-quarter view facing screen-right
// (yaw -45 deg, so his RIGHT arm is the camera-side arm), travels along his facing, reaches
// with the right arm across to his left, and whips LEFT (counter-clockwise from above, away
// from the viewer) through the right profile to the back view (yaw +90 deg). Never through
// the front.
//
// Pure and deterministic: no clock, no random, no state between calls.
import { CAMERA_PITCH, yawForViewAngle } from '../core/camera';
import {
  DEG,
  UP,
  add,
  clamp,
  clamp01,
  cross,
  dot,
  fwd,
  len,
  lerp,
  madd,
  mkBasis,
  mul,
  norm,
  rgt,
  rotate,
  smooth,
  solveTwoBone,
  sub,
  v3,
  wrap,
} from '../core/math';
import type {
  Basis,
  Frame,
  HandPose,
  JointName,
  Proportions,
  SegmentName,
  Side,
  Vec3,
} from '../core/types';

export const SHOT_FPS = 60;

/** Frame numbers of the beats (60 fps). */
export const T = {
  hold: 0,
  antic: 30,
  step1: 44,
  step2: 54,
  plant: 63,
  reach: 76,
  reachHold: 90,
  wind: 100,
  turn: 105,
  settle: 113,
  finish: 132,
  end: 200,
} as const;

export interface ShotBeat {
  name: string;
  /** first frame of the beat */
  from: number;
  /** one past its last frame */
  to: number;
}

export const SHOT_BEATS: ShotBeat[] = [
  { name: 'hold', from: T.hold, to: T.antic },
  { name: 'anticipation', from: T.antic, to: T.step1 },
  { name: 'step1', from: T.step1, to: T.step2 },
  { name: 'step2', from: T.step2, to: T.plant },
  { name: 'plant', from: T.plant, to: T.reach },
  { name: 'reach', from: T.reach, to: T.reachHold },
  { name: 'reachHold', from: T.reachHold, to: T.wind },
  { name: 'turnAnticipation', from: T.wind, to: T.turn },
  { name: 'turn', from: T.turn, to: T.settle },
  { name: 'settle', from: T.settle, to: T.finish },
  { name: 'finish', from: T.finish, to: T.end },
];

export const SHOT_FRAME_COUNT = T.end;

/** View angle (core/camera viewAngle) of the first frame: front three-quarter, facing screen-right. */
export const SHOT_START_VIEW = Math.PI / 4;
/** View angle of the last frame: the back view. */
export const SHOT_END_VIEW = -Math.PI / 2;

export const SHOT_CAMERA = { camYaw: 0, pitch: CAMERA_PITCH };

/** World yaw of the first frame for the shot camera. */
export const SHOT_START_YAW = yawForViewAngle(
  SHOT_START_VIEW,
  SHOT_CAMERA.camYaw,
);

// ------------------------------------------------------------------ channels

const CHANNELS = [
  // pelvis: ground position in travel coordinates (ps along the start facing, pt to his
  // start right), both in leg-scale units; dip below the straight-leg stand, leg-scale units
  'ps',
  'pt',
  'dip',
  'fin', // 0 = pelvis at (ps, pt); 1 = pelvis over the centre of the finishing stance
  'pf', // sideways shift in the finishing stance, to his END right, leg-scale units
  // world facing of each block, DEGREES relative to the start yaw, + = to his left
  'yP',
  'yC',
  'yH',
  'rho', // pelvis roll, + drops the right hip
  'pit', // chest pitch, + forward
  'rol', // chest roll, + toward his right
  'hPi', // head nod, + chin down
  'hRo',
  'sq', // root squash
  // arms (core/sim parametrisation): phi swing (+ forward), alp abduction (+ out),
  // tw upper-arm inward rotation, eps elbow bend, bet wrist, pro forearm pronation,
  // elv / prt shoulder-girdle lift and protraction (metres at a 0.4 m shoulder width)
  'Lphi',
  'Lalp',
  'Ltw',
  'Leps',
  'Lbet',
  'Lpro',
  'Lelv',
  'Lprt',
  'Rphi',
  'Ralp',
  'Rtw',
  'Reps',
  'Rbet',
  'Rpro',
  'Relv',
  'Rprt',
] as const;
export type Channel = (typeof CHANNELS)[number];
export type ShotPose = Partial<Record<Channel, number>>;

type ArmKeys = Partial<
  Record<'phi' | 'alp' | 'tw' | 'eps' | 'bet' | 'pro' | 'elv' | 'prt', number>
>;
export const arm = (side: Side, k: ArmKeys): ShotPose => {
  const out: ShotPose = {};
  for (const [name, v] of Object.entries(k))
    out[`${side}${name}` as Channel] = v as number;
  return out;
};
export const arms = (k: ArmKeys): ShotPose => ({ ...arm('L', k), ...arm('R', k) });

const PRON_REST = 1.75; // core/sim: relaxed forearm, palm toward the thigh

/**
 * The key poses. A pose only names the channels it keys; everything else passes through
 * on its own keys, which is how a breakdown can move the chest without touching the hips.
 */
export const SHOT_POSES: Record<string, ShotPose> = {
  // relaxed front three-quarter stance: arms hanging, feet about hip width
  stand: {
    ps: 0,
    pt: 0,
    dip: 0.02,
    fin: 0,
    pf: 0,
    yP: 0,
    yC: 0,
    yH: 0,
    rho: 0,
    pit: 0.03,
    rol: 0,
    hPi: 0,
    hRo: 0,
    sq: 1,
    ...arms({
      phi: 0.04,
      alp: 0.2,
      tw: 0,
      eps: 0.38,
      bet: 0,
      pro: PRON_REST,
      elv: 0,
      prt: 0,
    }),
  },
  // a breath up before the dip
  anticUp: { dip: 0.004, pit: 0.05, hPi: -0.04, ...arms({ elv: 0.012 }) },
  // quick dip, weight back and onto the left foot, eyes stay on the goal
  anticDown: {
    ps: -0.07,
    pt: -0.06,
    dip: 0.11,
    yP: -5,
    yC: -9,
    yH: 2,
    rho: -0.05,
    pit: -0.16,
    rol: -0.03,
    hPi: 0.14,
    sq: 0.975,
    ...arms({ phi: -0.4, alp: 0.32, eps: 0.95, elv: 0.022 }),
  },
  // step 1 (right foot): drive off the left, rise through the passing position
  pass1: {
    ps: 0.09,
    pt: -0.035,
    dip: 0.012,
    yP: 3,
    yC: -3,
    rho: 0.05,
    pit: 0.3,
    rol: 0.02,
    hPi: -0.14,
    sq: 1.015,
    ...arm('L', { phi: 0.2, alp: 0.2, eps: 1.45 }),
    ...arm('R', { phi: -0.25, alp: 0.3, eps: 1.25 }),
  },
  contact1: {
    ps: 0.2,
    pt: 0.012,
    dip: 0.035,
    yP: 12,
    yC: -16,
    rho: 0.0,
    pit: 0.28,
    hPi: -0.12,
    sq: 1,
    ...arm('L', { phi: 0.42, alp: 0.1, eps: 1.75 }),
    ...arm('R', { phi: -0.5, alp: 0.32, eps: 1.4 }),
  },
  down1: { ps: 0.27, pt: 0.04, dip: 0.062, pit: 0.31, sq: 0.985, rho: -0.03 },
  // step 2 (left foot)
  pass2: {
    ps: 0.38,
    pt: 0.045,
    dip: 0.018,
    yP: 0,
    yC: 0,
    rho: -0.06,
    pit: 0.3,
    rol: -0.02,
    sq: 1.015,
    ...arm('R', { phi: 0.0, alp: 0.2, eps: 1.5 }),
    ...arm('L', { phi: -0.05, alp: 0.3, eps: 1.3 }),
  },
  contact2: {
    ps: 0.56,
    pt: 0.01,
    dip: 0.035,
    yP: -12,
    yC: 16,
    rho: 0,
    pit: 0.3,
    rol: 0,
    hPi: -0.12,
    sq: 1,
    ...arm('R', { phi: 0.42, alp: 0.1, eps: 1.75 }),
    ...arm('L', { phi: -0.5, alp: 0.32, eps: 1.4 }),
  },
  // PLANT: knees absorb, torso overshoots forward, arms thrown forward by the stop
  stompDown: {
    ps: 0.7,
    pt: -0.03,
    dip: 0.135,
    yP: -8,
    yC: 3,
    rho: 0.05,
    pit: 0.46,
    hPi: -0.2,
    sq: 0.95,
  },
  // the arms arrive after the body has stopped: thrown forward and out by the stop
  armsThrow: arms({ phi: 0.22, alp: 0.45, eps: 0.8 }),
  stompUp: {
    ps: 0.715,
    pt: -0.02,
    dip: 0.025,
    pit: 0.06,
    hPi: 0.05,
    sq: 1.02,
    rho: 0,
  },
  // athletic ready: left foot leading, hips opened to the viewer
  ready: {
    ps: 0.71,
    pt: -0.01,
    dip: 0.055,
    yP: -7,
    yC: -3,
    yH: 0,
    rho: 0,
    pit: 0.14,
    rol: 0,
    hPi: 0,
    hRo: 0,
    sq: 1,
    ...arms({ phi: 0.1, alp: 0.3, tw: 0, eps: 0.65, bet: 0, pro: PRON_REST }),
  },
  // REACH: the shoulder goes first, elbow up and leading, hand still by the ribs
  reachLead: {
    yC: 9,
    yH: 8,
    pit: 0.17,
    ...arm('R', {
      phi: 0.45,
      alp: 0.34,
      tw: 1.0,
      eps: 1.35,
      prt: 0.05,
      elv: 0.035,
      bet: -0.3,
    }),
    ...arm('L', { phi: -0.25, alp: 0.3 }),
  },
  // extreme: arm across the chest at chest height, chest twisted with it against the hips
  reachOut: {
    ps: 0.765,
    pt: -0.065,
    dip: 0.03,
    yP: -11,
    yC: 31,
    yH: 36,
    rho: 0.06,
    pit: 0.36,
    rol: -0.2,
    hPi: 0.02,
    ...arm('R', {
      phi: 1.22,
      alp: -0.6,
      tw: 1.75,
      eps: 0.72,
      bet: 0.3,
      pro: 3.1,
      prt: 0.07,
      elv: 0.03,
    }),
    ...arm('L', { phi: -0.85, alp: 0.45, eps: 0.4, pro: 1.4 }),
  },
  reachSettle: {
    ps: 0.75,
    pt: -0.05,
    dip: 0.045,
    yP: -10,
    yC: 25,
    yH: 46,
    pit: 0.28,
    rol: -0.14,
    ...arm('R', {
      phi: 1.1,
      alp: -0.5,
      tw: 1.7,
      eps: 1.2,
      bet: 0,
      pro: 3.1,
      prt: 0.06,
      elv: 0.025,
    }),
    ...arm('L', { phi: -0.7, alp: 0.4, eps: 0.5 }),
  },
  // moving hold: keeps drifting into the reach, head looks past the hand
  reachHold: {
    ps: 0.75,
    yC: 27,
    yH: 52,
    pit: 0.3,
    hPi: -0.03,
    ...arm('R', { phi: 1.12, alp: -0.52, eps: 1.14 }),
  },
  // TURN anticipation: coil the other way and sink, head already going left
  wind: {
    ps: 0.69,
    pt: 0.035,
    dip: 0.125,
    yP: -11,
    yH: 40,
    rho: -0.04,
    pit: 0.32,
    rol: 0.09,
    hPi: 0.05,
    sq: 0.96,
    ...arm('R', {
      phi: 0.95,
      alp: -0.25,
      tw: 1.4,
      eps: 1.9,
      bet: -0.2,
      pro: 2.6,
      prt: 0,
      elv: 0.02,
    }),
    ...arm('L', { phi: 0.55, alp: 0.1, eps: 1.1, pro: PRON_REST }),
  },
  // airborne middle of the turn: long and up, right arm trailing behind, left wrapping in front
  air: {
    dip: 0.03,
    fin: 0.5,
    rho: 0,
    pit: 0.18,
    rol: -0.13,
    hPi: 0,
    sq: 1.035,
    ...arm('R', { phi: -0.3, alp: 0.26, tw: 0.5, eps: 1.6, bet: -0.3, pro: PRON_REST }),
    ...arm('L', { phi: 0.55, alp: -0.15, tw: 1.3, eps: 1.6 }),
  },
  land: { fin: 1, dip: 0.08, sq: 0.99 },
  landDown: {
    dip: 0.155,
    pit: 0.3,
    rol: 0,
    hPi: -0.1,
    sq: 0.95,
    rho: 0.03,
  },
  // arms carry on past the stop: right wraps across the front, left flings out
  armsOver: {
    ...arm('R', {
      phi: 0.6,
      alp: -0.15,
      tw: 0.6,
      eps: 1.25,
      bet: 0.3,
      pro: PRON_REST,
    }),
    ...arm('L', { phi: -0.3, alp: 0.5, tw: 0, eps: 0.9 }),
  },
  landUp: { dip: 0.02, pit: 0.04, hPi: 0.04, sq: 1.018, rho: 0 },
  armsBack: {
    ...arm('R', { phi: -0.2, alp: 0.42, tw: 0, eps: 0.5, bet: -0.1 }),
    ...arm('L', { phi: 0.2, alp: 0.14, eps: 0.6 }),
  },
  // the showman's lock-in after the landing: a little bounce onto the right leg, shoulders
  // roll, chin up, then he sits back into the stance
  lockDip: {
    pf: -0.015,
    dip: 0.075,
    pit: 0.12,
    hPi: 0.08,
    sq: 0.985,
    ...arms({ phi: -0.08, alp: 0.3, eps: 0.6, elv: -0.005 }),
  },
  lockUp: {
    pf: 0.04,
    dip: 0.012,
    rho: -0.06,
    yP: 139,
    yC: 131,
    pit: 0.02,
    rol: 0.05,
    hPi: -0.1,
    hRo: 0.05,
    sq: 1.012,
    ...arms({ phi: 0.1, alp: 0.3, eps: 0.75, elv: 0.03 }),
  },
  lockSit: {
    pf: 0.022,
    dip: 0.05,
    rho: -0.035,
    yP: 136,
    yC: 134,
    pit: 0.08,
    rol: 0.02,
    hPi: 0.02,
    hRo: 0.02,
    sq: 0.995,
    ...arms({ phi: -0.04, alp: 0.24, eps: 0.42, elv: 0 }),
  },
  // grounded back-view stance
  final: {
    fin: 1,
    pf: 0,
    dip: 0.04,
    yP: 135,
    yC: 135,
    yH: 135,
    rho: 0,
    pit: 0.07,
    rol: 0,
    hPi: 0,
    hRo: 0,
    sq: 1,
    ...arms({
      phi: 0.04,
      alp: 0.22,
      tw: 0,
      eps: 0.4,
      bet: 0,
      pro: PRON_REST,
      elv: 0,
      prt: 0,
    }),
  },
};

/** [frame, pose, tangent]: 'f' = the value stops there (an extreme or a hold), 'a' = it flows through. */
export type TimelineKey = [number, ShotPose | string, 'f' | 'a'];

export const SHOT_TIMELINE: TimelineKey[] = [
  [0, 'stand', 'f'],
  [T.antic, 'stand', 'f'],
  [34, 'anticUp', 'a'],
  [42, 'anticDown', 'f'],
  [48, 'pass1', 'a'],
  [53, 'contact1', 'a'],
  [55, 'down1', 'a'],
  [58, 'pass2', 'a'],
  [63, 'contact2', 'a'],
  [67, 'stompDown', 'f'],
  [72, 'armsThrow', 'f'],
  [72, 'stompUp', 'f'],
  [T.reach, 'ready', 'f'],
  [80, 'reachLead', 'a'],
  [88, 'reachOut', 'f'],
  [93, 'reachSettle', 'f'],
  [T.wind, 'reachHold', 'f'],
  [99, { dip: 0.045 }, 'f'],
  [T.turn, 'wind', 'f'],
  [T.turn, { fin: 0 }, 'f'],
  // the turn is keyed block by block: head first, then chest, then hips
  [107, { yH: 82 }, 'a'],
  [110, { yH: 141 }, 'f'],
  [114, { yH: 133 }, 'f'],
  [119, { yH: 135 }, 'f'],
  [105, { yC: -10 }, 'f'],
  [107, { yC: 20 }, 'a'],
  [110, { yC: 84 }, 'a'],
  [113, { yC: 146 }, 'f'],
  [118, { yC: 131 }, 'f'],
  [124, { yC: 135 }, 'f'],
  [108, { yP: 6 }, 'a'],
  [111, { yP: 80 }, 'a'],
  [115, { yP: 141 }, 'f'],
  [120, { yP: 133 }, 'f'],
  [126, { yP: 135 }, 'f'],
  [109, 'air', 'a'],
  [113, 'land', 'a'],
  [116, 'landDown', 'f'],
  [118, 'armsOver', 'f'],
  [122, 'landUp', 'f'],
  [127, 'armsBack', 'f'],
  [T.finish, 'final', 'f'],
  [140, 'final', 'f'],
  [147, 'lockDip', 'f'],
  [154, 'lockUp', 'f'],
  [163, 'lockSit', 'f'],
  [176, 'final', 'f'],
  [T.end, 'final', 'f'],
];

/** Overlap: how many frames LATER than the keyed time each channel plays its keys. */
const OFFSET: Partial<Record<Channel, number>> = {
  hPi: 1,
  rol: 0.5,
  Leps: 1.5,
  Reps: 1.5,
  Lbet: 3,
  Rbet: 3,
  Lpro: 2.5,
  Rpro: 2.5,
  Lalp: 0.5,
  Ralp: 0.5,
};

export interface Track {
  t: number[];
  v: number[];
  m: number[]; // tangents (per frame)
}

export function buildTracks(
  timeline: TimelineKey[] = SHOT_TIMELINE,
  poses: Record<string, ShotPose> = SHOT_POSES,
): Record<Channel, Track> {
  const raw = {} as Record<Channel, [number, number, 'f' | 'a'][]>;
  for (const c of CHANNELS) raw[c] = [];
  for (const [f, p, mode] of timeline) {
    const pose = typeof p === 'string' ? poses[p] : p;
    for (const c of CHANNELS) {
      const v = pose[c];
      if (v !== undefined) raw[c].push([f, v, mode]);
    }
  }
  const out = {} as Record<Channel, Track>;
  for (const c of CHANNELS) {
    const keys = raw[c].slice().sort((a, b) => a[0] - b[0]);
    const t = keys.map((k) => k[0]);
    const v = keys.map((k) => k[1]);
    const m = keys.map((k, i) =>
      k[2] === 'a' && i > 0 && i < keys.length - 1
        ? (v[i + 1] - v[i - 1]) / (t[i + 1] - t[i - 1])
        : 0,
    );
    out[c] = { t, v, m };
  }
  return out;
}

export function sample(tr: Track, f: number): number {
  const n = tr.t.length;
  if (f <= tr.t[0]) return tr.v[0];
  if (f >= tr.t[n - 1]) return tr.v[n - 1];
  let i = 0;
  while (i < n - 2 && f >= tr.t[i + 1]) i++;
  const T0 = tr.t[i + 1] - tr.t[i];
  const u = (f - tr.t[i]) / T0;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * tr.v[i] +
    (u3 - 2 * u2 + u) * T0 * tr.m[i] +
    (-2 * u3 + 3 * u2) * tr.v[i + 1] +
    (u3 - u2) * T0 * tr.m[i + 1]
  );
}

// ------------------------------------------------------------------ feet

/** A foot placement in travel coordinates (leg-scale units) with a world yaw offset in degrees from the start yaw. */
export interface Plant {
  s: number;
  t: number;
  yaw: number;
}
interface Step {
  from: Plant;
  to: Plant;
  peel: number; // frame the heel starts to peel (still planted, toes locked)
  lift: number; // first airborne frame
  land: number; // first planted frame at `to`
  flat: number; // frame the foot is flat
  height: number; // leg-scale units
  peelPitch: number; // heel-up angle at lift-off
  strike: number; // pitch at touch-down: < 0 heel first, > 0 ball first, 0 flat
  /** swing AROUND the other foot's finishing plant (a step-around), not straight to the target */
  around?: boolean;
}
export interface FootState {
  x: number;
  z: number;
  yaw: number;
  lift: number;
  pitch: number;
  toeFlat: number;
  planted: boolean;
}

/** Half the stance width in leg-scale units is added to half the hip width (metres) by the solver. */
const STANCE = 0.035;
/** Scales the whole travel (pelvis `ps` and every plant's `s`): the steps are a short, sharp shuffle-up. */
const TRAVEL = 0.86;

function footPlan(side: Side): { init: Plant; steps: Step[] } {
  const g = side === 'R' ? 1 : -1;
  // t here is in units of the stance half-width (resolved in the solver)
  const init: Plant = { s: 0, t: g, yaw: -g * 10 };
  // the finish is resolved in plantWorld: the left foot pivots where it stands, the right
  // foot steps around it to the far side of the END facing
  const fin: Plant = { s: 0, t: 0, yaw: 135 - g * 10 };
  if (side === 'R') {
    const r1: Plant = { s: 0.35, t: 0.85, yaw: -5 };
    const r3: Plant = { s: 0.6, t: 1.35, yaw: -20 };
    return {
      init,
      steps: [
        {
          from: init,
          to: r1,
          peel: 41,
          lift: 44,
          land: 53,
          flat: 55,
          height: 0.085,
          peelPitch: 0.3,
          strike: -0.3,
        },
        {
          from: r1,
          to: r3,
          peel: 59,
          lift: 64,
          land: 71,
          flat: 74,
          height: 0.05,
          peelPitch: 0.75,
          strike: 0.2,
        },
        {
          from: r3,
          to: fin,
          peel: 101,
          lift: 105,
          land: 114,
          flat: 116,
          height: 0.075,
          peelPitch: 0.55,
          strike: 0.28,
          around: true,
        },
      ],
    };
  }
  const l2: Plant = { s: 0.82, t: -0.9, yaw: 6 };
  return {
    init,
    steps: [
      {
        from: init,
        to: l2,
        peel: 48,
        lift: 53,
        land: 63,
        flat: 65,
        height: 0.1,
        peelPitch: 0.7,
        strike: -0.26,
      },
      {
        from: l2,
        to: fin,
        peel: 102,
        lift: 106,
        land: 112,
        flat: 115,
        height: 0.03,
        peelPitch: 0.4,
        strike: 0.3,
      },
    ],
  };
}

// ------------------------------------------------------------------ solve

const SEGMENT_SIDES: Side[] = ['L', 'R'];

/**
 * Segment bases from joint positions, the three block yaws and the palm normals, built the
 * way core/sim.ts builds them (same helper, same hints), so a core frame's joints give that
 * frame's bases back. Exported for the checks.
 */
export function segmentBases(
  J: Record<JointName, Vec3>,
  yaw: { pelvis: number; chest: number; head: number },
  P: Proportions,
  palmNormal: { L: Vec3; R: Vec3 },
): Record<SegmentName, Basis> {
  const B = {} as Record<SegmentName, Basis>;
  const fP = fwd(yaw.pelvis);
  const rP = rgt(yaw.pelvis);
  const fC = fwd(yaw.chest);
  const fH = fwd(yaw.head);
  const hipLine = sub(J.hipR, J.hipL);
  const rho = -hipLine.y / Math.max(1e-9, Math.hypot(hipLine.x, hipLine.z));
  B.pelvis = mkBasis(v3(rP.x * rho, 1, rP.z * rho), fP);
  const uLow = norm(sub(J.spine, J.pelvis));
  const uUp = norm(sub(J.chest, J.spine));
  B.spine = mkBasis(uLow, v3(fP.x + fC.x, 0, fP.z + fC.z), fC);
  B.chest = mkBasis(uUp, fC);
  B.head = mkBasis(norm(sub(J.headTop, J.head)), fH);
  for (const side of SEGMENT_SIDES) {
    const sgn = side === 'R' ? 1 : -1;
    // leg
    const hip = J[`hip${side}`];
    const knee = J[`knee${side}`];
    const ankle = J[`ankle${side}`];
    const heel = J[`heel${side}`];
    const toe = J[`toe${side}`];
    const sole = sub(toe, heel);
    const ff = norm(v3(sole.x, 0, sole.z), fP);
    const fr = v3(-ff.z, 0, ff.x); // rgt of the foot's yaw
    const nLeg = norm(
      v3(
        fr.x * 0.55 + rP.x * 0.6 - fP.x * sgn * 0.1,
        0,
        fr.z * 0.55 + rP.z * 0.6 - fP.z * sgn * 0.1,
      ),
      rP,
    );
    const dLeg = norm(sub(ankle, hip), v3(0, -1, 0));
    const pole = norm(cross(nLeg, dLeg), ff);
    const tDir = norm(sub(knee, hip));
    const sDir = norm(sub(ankle, knee));
    B[`thigh${side}`] = mkBasis(tDir, cross(nLeg, tDir), pole);
    B[`shin${side}`] = mkBasis(sDir, cross(nLeg, sDir), pole);
    // foot: heel -> ball. The ball is 70% along a flat sole; with the toes bent it is the
    // lower apex of the heel/ball/toe triangle.
    const L = P.footLen;
    const d = len(sole);
    let ball: Vec3;
    if (toe.y <= 1e-12 && heel.y > 0) {
      // heel up with the toes on the floor: the ball is on the floor too
      const a = 0.7 * L;
      const run = Math.sqrt(Math.max(0, a * a - (heel.y - toe.y) * (heel.y - toe.y)));
      ball = v3(heel.x + ff.x * run, toe.y, heel.z + ff.z * run);
    } else if (d >= L - 1e-12) ball = madd(heel, sole, 0.7);
    else {
      const a = 0.7 * L;
      const b = 0.3 * L;
      const dir = norm(sole);
      const along = (a * a - b * b + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, a * a - along * along));
      const perp = norm(sub(UP, mul(dir, dot(UP, dir))));
      ball = add(heel, add(mul(dir, along), mul(perp, -h)));
    }
    B[`foot${side}`] = mkBasis(sub(ball, heel), UP, ff);
    // arm
    const sh = J[`shoulder${side}`];
    const el = J[`elbow${side}`];
    const wr = J[`wrist${side}`];
    const palm = J[`hand${side}`];
    const dArm = norm(sub(palm, sh), v3(0, -1, 0));
    const toEl = sub(el, sh);
    const pole2 = norm(sub(toEl, mul(dArm, dot(toEl, dArm))), mul(fC, -1));
    const c = norm(sub(palm, el));
    const nPlane = norm(cross(dArm, pole2));
    const qp = norm(cross(c, nPlane));
    const m = palmNormal[side];
    const uDir = norm(toEl);
    const foreDir = norm(sub(wr, el));
    const handX = norm(sub(palm, wr), foreDir);
    B[`upperArm${side}`] = mkBasis(uDir, cross(nPlane, uDir), pole2);
    B[`forearm${side}`] = mkBasis(foreDir, mul(m, -1), mul(qp, -1));
    B[`hand${side}`] = mkBasis(handX, m, qp);
  }
  return B;
}

const tilt = (p: number, r: number, f: Vec3, rr: Vec3): Vec3 =>
  norm(
    v3(
      f.x * Math.sin(p) + rr.x * Math.sin(r),
      Math.cos(p) * Math.cos(r),
      f.z * Math.sin(p) + rr.z * Math.sin(r),
    ),
  );

function footGeometry(
  f: FootState,
  P: Proportions,
): { ankle: Vec3; heel: Vec3; toe: Vec3 } {
  // core/sim footGeom: (x, z) is the point under the ankle; heel-up pitches pivot at the
  // ball with the toes staying down, toe-up pitches pivot at the heel.
  const L = P.footLen;
  const H = P.ankleHeight;
  const back = 0.25 * L;
  const ballF = 0.45 * L;
  const toeF = 0.75 * L;
  const fx = Math.cos(f.yaw);
  const fz = -Math.sin(f.yaw);
  const at = (px: number, pz: number, u: number, h: number, a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const along = u * c + h * s;
    return v3(px + fx * along, f.lift - u * s + h * c, pz + fz * along);
  };
  let ankle: Vec3;
  let heel: Vec3;
  let toe: Vec3;
  if (f.pitch >= 0) {
    const bx = f.x + fx * ballF;
    const bz = f.z + fz * ballF;
    ankle = at(bx, bz, -ballF, H, f.pitch);
    heel = at(bx, bz, -(back + ballF), 0, f.pitch);
    toe = at(bx, bz, toeF - ballF, 0, f.pitch * (1 - f.toeFlat));
  } else {
    const hx = f.x - fx * back;
    const hz = f.z - fz * back;
    ankle = at(hx, hz, back, H, f.pitch);
    heel = v3(hx, f.lift, hz);
    toe = at(hx, hz, L, 0, f.pitch);
  }
  if (!f.planted) {
    const low = Math.min(heel.y, toe.y);
    if (low < 0) {
      ankle.y -= low;
      heel.y -= low;
      toe.y -= low;
    }
  }
  return { ankle, heel, toe };
}

/** What the shared solver needs to turn keyed channels into frames. */
export interface ShotSpec {
  frames: number;
  tracks: Record<Channel, Track>;
  beats: ShotBeat[];
  /** -1..1, already scaled by how calm the moment is */
  breath: (f: number) => number;
  hands: (f: number) => { L: HandPose; R: HandPose };
  /** replaces the shot's step plan (for a performance that never steps) */
  feet?: (
    side: Side,
    f: number,
    plantWorld: (p: Plant, side: Side) => { x: number; z: number; yaw: number },
  ) => FootState;
  /** extra optional fields merged into each frame */
  extra?: (f: number) => Record<string, unknown>;
}

/** The plants both feet stand on in the shot's `ready` key (frame 76): left foot leading. */
export function readyPlant(side: Side): Plant {
  return side === 'L' ? footPlan('L').steps[0].to : footPlan('R').steps[1].to;
}

/** All channels exactly as buildShot plays them at a frame (overlap offsets included). */
export function shotChannelsAt(f: number): Required<ShotPose> {
  const tracks = buildTracks();
  const out = {} as Required<ShotPose>;
  for (const c of CHANNELS) out[c] = sample(tracks[c], f - (OFFSET[c] ?? 0));
  return out;
}

export function buildShot(proportions: Proportions): Frame[] {
  return solveShot(proportions, {
    frames: T.end,
    tracks: buildTracks(),
    beats: SHOT_BEATS,
    breath: (f) => {
      // full in the holds, a trace elsewhere
      const calm = Math.max(
        1 - smooth((f - (T.antic - 4)) / 6),
        smooth((f - (T.finish - 6)) / 14),
      );
      return Math.sin((f / 132) * Math.PI * 2 - 0.4) * (0.2 + 0.8 * calm);
    },
    hands: (f) => ({
      L: 'relaxed',
      R: f >= 82 && f < 108 ? 'open' : 'relaxed',
    }),
  });
}

export function solveShot(proportions: Proportions, spec: ShotSpec): Frame[] {
  const P = proportions;
  const legLen = P.thigh + P.shin;
  const K = legLen / 0.86; // leg scale: travel, dips and step heights scale with the legs
  const sc = P.shoulderWidth / 0.4;
  const hw = P.hipWidth * 0.5;
  const hipDrop = Math.max(0, P.pelvisHeight - P.ankleHeight - legLen);
  const yaw0 = SHOT_START_YAW;
  const F0 = fwd(yaw0);
  const R0 = rgt(yaw0);
  const stance = hw + STANCE * K;
  const tracks = spec.tracks;
  const ch = (c: Channel, f: number): number =>
    sample(tracks[c], f - (OFFSET[c] ?? 0));

  // world-locked plants
  const world = (s: number, t: number): { x: number; z: number } => ({
    x: F0.x * s * TRAVEL + R0.x * t,
    z: F0.z * s * TRAVEL + R0.z * t,
  });
  const yawEnd = yaw0 + 135 * DEG;
  const plans = { L: footPlan('L'), R: footPlan('R') };
  // the pivot: the left foot's last plant before the turn
  const pivotPlant = plans.L.steps[plans.L.steps.length - 1].from;
  const pivot = world(pivotPlant.s * K, pivotPlant.t * stance);
  const finalGap = stance * 2.3;
  const finalCentre = {
    x: pivot.x + rgt(yawEnd).x * finalGap * 0.5,
    z: pivot.z + rgt(yawEnd).z * finalGap * 0.5,
  };
  const plantWorld = (
    p: Plant,
    side: Side,
  ): { x: number; z: number; yaw: number } => {
    if (p.yaw > 90) {
      const r = rgt(yawEnd);
      const k = side === 'R' ? finalGap : 0;
      return {
        x: pivot.x + r.x * k,
        z: pivot.z + r.z * k,
        yaw: yaw0 + p.yaw * DEG,
      };
    }
    const w = world(p.s * K, p.t * stance);
    return { x: w.x, z: w.z, yaw: yaw0 + p.yaw * DEG };
  };

  const footAt = (side: Side, f: number): FootState => {
    if (spec.feet) return spec.feet(side, f, plantWorld);
    const plan = plans[side];
    let st: Step | null = null;
    for (const s of plan.steps) if (f >= s.peel) st = s;
    if (!st) {
      const w = plantWorld(plan.init, side);
      return { ...w, lift: 0, pitch: 0, toeFlat: 1, planted: true };
    }
    const a = plantWorld(st.from, side);
    const b = plantWorld(st.to, side);
    if (f < st.lift) {
      const u = (f - st.peel) / (st.lift - st.peel);
      return {
        ...a,
        lift: 0,
        pitch: st.peelPitch * u * u * (3 - 2 * u) * (0.5 + 0.5 * u),
        toeFlat: 1,
        planted: true,
      };
    }
    if (f < st.land) {
      const u = (f - st.lift) / (st.land - st.lift);
      const e = 0.3 * u + 0.7 * smooth(u);
      const lift = st.height * K * Math.sin(Math.PI * Math.pow(u, 0.72));
      const mid = st.strike < 0 ? 0.55 : 0.35;
      // heel-up off the ground, then set for the strike over the last part of the swing
      const pitch =
        u < mid
          ? lerp(st.peelPitch, st.peelPitch * 0.55, smooth(u / mid))
          : lerp(st.peelPitch * 0.55, st.strike, smooth((u - mid) / (1 - mid)));
      const toeFlat =
        st.strike > 0
          ? Math.max(1 - smooth(u / 0.3), smooth((u - 0.6) / 0.4))
          : 1 - smooth(u / 0.3);
      let x = lerp(a.x, b.x, e);
      let z = lerp(a.z, b.z, e);
      if (st.around) {
        const a0 = Math.atan2(a.z - pivot.z, a.x - pivot.x);
        const a1 = Math.atan2(b.z - pivot.z, b.x - pivot.x);
        const ang = a0 + wrap(a1 - a0) * e;
        const rad = lerp(
          Math.hypot(a.x - pivot.x, a.z - pivot.z),
          Math.hypot(b.x - pivot.x, b.z - pivot.z),
          e,
        );
        x = pivot.x + Math.cos(ang) * rad;
        z = pivot.z + Math.sin(ang) * rad;
      }
      return {
        x,
        z,
        yaw: a.yaw + wrap(b.yaw - a.yaw) * smooth(u),
        lift,
        pitch,
        toeFlat,
        planted: false,
      };
    }
    const u = clamp01((f - st.land) / Math.max(1, st.flat - st.land));
    return {
      ...b,
      lift: 0,
      pitch: st.strike * (1 - smooth(u)),
      toeFlat: 1,
      planted: true,
    };
  };

  const beatOf = (f: number): string =>
    spec.beats.find((b) => f >= b.from && f < b.to)?.name ??
    spec.beats[spec.beats.length - 1].name;

  const frames: Frame[] = [];
  for (let f = 0; f < spec.frames; f++) {
    const breath = spec.breath(f);

    const yawP = yaw0 + ch('yP', f) * DEG;
    const yawC = yaw0 + ch('yC', f) * DEG;
    const yawH = yawC + clamp(wrap(yaw0 + ch('yH', f) * DEG - yawC), -1.35, 1.35);
    const fP = fwd(yawP);
    const rP = rgt(yawP);
    const fC = fwd(yawC);
    const rC = rgt(yawC);
    const fH = fwd(yawH);
    const rH = rgt(yawH);
    const rho = ch('rho', f);
    const pitch = ch('pit', f) - 0.02 * breath;
    const roll = ch('rol', f);
    const hPi = ch('hPi', f) + 0.01 * breath;
    const hRo = ch('hRo', f);

    const J = {} as Record<JointName, Vec3>;
    const feet = { L: footAt('L', f), R: footAt('R', f) };
    const geom = {
      L: footGeometry(feet.L, P),
      R: footGeometry(feet.R, P),
    };

    // pelvis: authored, then held under what the planted legs can reach
    const pt0 = world(ch('ps', f) * K, ch('pt', f) * K);
    const fin = ch('fin', f);
    const pf = ch('pf', f) * K;
    const pg = {
      x: lerp(pt0.x, finalCentre.x, fin) + rgt(yawEnd).x * pf,
      z: lerp(pt0.z, finalCentre.z, fin) + rgt(yawEnd).z * pf,
    };
    let py = P.pelvisHeight - ch('dip', f) * K + 0.006 * K * breath;
    // a rigid pelvis: the hip line rolls, it does not shear (core's pelvis basis has the same tilt)
    const rollC = 1 / Math.sqrt(1 + rho * rho);
    const hipOffset = (sgn: number): Vec3 =>
      v3(
        rP.x * sgn * hw * rollC,
        -hipDrop - sgn * rho * hw * rollC,
        rP.z * sgn * hw * rollC,
      );
    const maxLeg = legLen * 0.985;
    for (const side of SEGMENT_SIDES) {
      if (!feet[side].planted) continue;
      const o = hipOffset(side === 'R' ? 1 : -1);
      const a = geom[side].ankle;
      const h = Math.hypot(pg.x + o.x - a.x, pg.z + o.z - a.z);
      const top = a.y + Math.sqrt(Math.max(0, maxLeg * maxLeg - h * h)) - o.y;
      if (py > top) py = top;
    }
    J.pelvis = v3(pg.x, py, pg.z);

    // legs
    for (const side of SEGMENT_SIDES) {
      const sgn = side === 'R' ? 1 : -1;
      const hip = add(J.pelvis, hipOffset(sgn));
      const g = geom[side];
      if (!feet[side].planted) {
        // a foot in the air at full stretch is drawn in by the leg
        const off = sub(g.ankle, hip);
        const dA = len(off);
        const maxA = legLen * 0.99;
        if (dA > maxA) {
          const pull = mul(off, -(dA - maxA) / dA);
          g.ankle = add(g.ankle, pull);
          g.heel = add(g.heel, pull);
          g.toe = add(g.toe, pull);
        }
      }
      const ff = fwd(feet[side].yaw);
      const fr = rgt(feet[side].yaw);
      const nLeg = norm(
        v3(
          fr.x * 0.55 + rP.x * 0.6 - fP.x * sgn * 0.1,
          0,
          fr.z * 0.55 + rP.z * 0.6 - fP.z * sgn * 0.1,
        ),
        rP,
      );
      const dLeg = norm(sub(g.ankle, hip), v3(0, -1, 0));
      const pole = norm(cross(nLeg, dLeg), ff);
      const ik = solveTwoBone(hip, g.ankle, P.thigh, P.shin, pole, 0.995);
      J[`hip${side}`] = hip;
      J[`knee${side}`] = ik.mid;
      J[`ankle${side}`] = g.ankle;
      J[`heel${side}`] = g.heel;
      J[`toe${side}`] = g.toe;
    }

    // spine, chest, head
    const uLow = tilt(pitch * 0.45 - 0.07, roll * 0.4 + rho * 0.6, fC, rC);
    const uUp = tilt(pitch, roll, fC, rC);
    J.spine = madd(J.pelvis, uLow, P.spine);
    J.chest = madd(J.spine, uUp, P.chestLen);
    const uNeck = tilt(pitch * 0.55 + 0.08 + hPi * 0.4, roll * 0.5 + hRo * 0.4, fC, rC);
    J.neck = madd(J.chest, uNeck, P.neck * 0.35);
    J.head = madd(J.chest, uNeck, P.neck);
    const uHead = tilt(pitch * 0.2 + hPi, roll * 0.25 + hRo, fH, rH);
    J.headTop = madd(J.head, uHead, P.headLen);

    // arms: forward kinematics from the chest (so the elbow and wrist lag by channel offset)
    const uC = uUp;
    const rCb = norm(sub(rC, mul(uC, dot(rC, uC))));
    const fCb = cross(uC, rCb);
    const palmN = {} as { L: Vec3; R: Vec3 };
    for (const side of SEGMENT_SIDES) {
      const sgn = side === 'R' ? 1 : -1;
      const A = (k: string): number => ch(`${side}${k}` as Channel, f);
      const phi = A('phi');
      const alp = A('alp') + 0.012 * breath;
      const eps = Math.max(0.2, A('eps'));
      const beta = A('bet');
      const shoulder = add(
        J.chest,
        add(
          mul(rCb, sgn * P.shoulderWidth * 0.5),
          add(
            mul(uC, (A('elv') + 0.007 * breath) * sc),
            mul(fCb, (A('prt') - 0.02) * sc),
          ),
        ),
      );
      let dirU = add(mul(uC, -Math.cos(phi)), mul(fCb, Math.sin(phi)));
      dirU = norm(
        add(mul(dirU, Math.cos(alp)), mul(rCb, sgn * Math.sin(alp))),
      );
      const qRaw = add(fCb, add(mul(uC, 0.35), mul(rCb, -sgn * 0.22)));
      let q = norm(sub(qRaw, mul(dirU, dot(qRaw, dirU))));
      q = rotate(q, dirU, -sgn * A('tw'));
      const dirF = add(mul(dirU, Math.cos(eps)), mul(q, Math.sin(eps)));
      const q2 = norm(sub(q, mul(dirF, dot(q, dirF))));
      const hh = P.hand * 0.5;
      const handDir = add(mul(dirF, Math.cos(beta)), mul(q2, Math.sin(beta)));
      const palmT = add(
        shoulder,
        add(mul(dirU, P.upperArm), add(mul(dirF, P.forearm), mul(handDir, hh))),
      );
      const dArm = norm(sub(palmT, shoulder), mul(uC, -1));
      const nFk = norm(cross(dirU, mul(q, -1)), mul(rCb, -1));
      const pole = norm(cross(nFk, dArm), mul(q, -1));
      const l2 = Math.sqrt(
        P.forearm * P.forearm + hh * hh + 2 * P.forearm * hh * Math.cos(beta),
      );
      const delta = Math.atan2(
        hh * Math.sin(beta),
        P.forearm + hh * Math.cos(beta),
      );
      const ik = solveTwoBone(shoulder, palmT, P.upperArm, l2, pole, 0.985);
      const c = norm(sub(ik.end, ik.mid));
      const nPlane = norm(cross(dArm, pole), nFk);
      const qp = norm(cross(c, nPlane), q);
      const m = rotate(qp, c, -sgn * A('pro'));
      const foreDir = norm(
        sub(mul(c, Math.cos(delta)), mul(m, Math.sin(delta))),
      );
      J[`shoulder${side}`] = shoulder;
      J[`elbow${side}`] = ik.mid;
      J[`wrist${side}`] = madd(ik.mid, foreDir, P.forearm);
      J[`hand${side}`] = ik.end;
      palmN[side] = m;
    }

    const yaw = { pelvis: wrap(yawP), chest: wrap(yawC), head: wrap(yawH) };
    const hands = spec.hands(f);
    frames.push({
      step: f,
      joints: J,
      yaw,
      lean: { pitch, roll },
      basis: segmentBases(J, yaw, P, palmN),
      hands,
      contacts: { footL: feet.L.planted, footR: feet.R.planted },
      props: [],
      squash: ch('sq', f),
      phase: beatOf(f),
      ...(spec.extra ? spec.extra(f) : {}),
    });
  }
  return frames;
}
