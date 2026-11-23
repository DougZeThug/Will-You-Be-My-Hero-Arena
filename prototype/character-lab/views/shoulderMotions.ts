// The shoulder review take: SYNTHETIC 3D frames (authored here, not the
// animator) that move the shoulder girdle and the torso WITH the arm.
//   swing   walk-style pendulum, +35 deg forward to -30 back, elbow lagging,
//           the other arm opposite, chest counter-rotation, pro/retraction
//   reach   forward to chest height (~86 deg), elbow extending, the shoulder
//           protracts, the chest turns and leans into it
//   raise   forward and up to 160 deg with scapulohumeral rhythm (past 30 deg
//           the shoulder point rises and moves inward, about 1 deg of girdle
//           per 2 of arm), the torso side-bends away
//   raise (side)  the same out to the side (toward the camera in three-quarter)
// then reach and raise again for the FAR arm. Every number is hand-authored.
import type { Side } from './contract';
import type { ArmPose, Pose } from './synthetic';

export type ShoulderView = 'threeQuarterFront' | 'side';
export interface Segment {
  name: string;
  arm: 'near' | 'far';
  length: number;
  pose: (t: number, yaw: number, near: Side) => Pose;
}

const ease = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** 0 -> 1 over [a, b], hold, 1 -> 0 over [c, d]. */
const pulse = (a: number, b: number, c: number, d: number, t: number) => ease(a, b, t) - ease(c, d, t);
const other = (s: Side): Side => (s === 'R' ? 'L' : 'R');
const armKey = (s: Side) => (s === 'R' ? 'armR' : 'armL') as 'armR' | 'armL';
const shrugKey = (s: Side) => (s === 'R' ? 'shrugR' : 'shrugL') as 'shrugR' | 'shrugL';
// Chest twist that brings side `s` forward, deg (yaw is counter-clockwise from above).
const twistToward = (s: Side, deg: number) => (s === 'R' ? deg : -deg);
// Roll that side-bends AWAY from side `s` (roll + leans to the character's right).
const bendAway = (s: Side, deg: number) => (s === 'R' ? -deg : deg);
const idle: ArmPose = { forward: 0, elbow: 8 };

function swing(t: number, yaw: number, near: Side): Pose {
  // 60-frame cycle, 2.5 cycles, eased in and out.
  const envelope = pulse(0, 24, 132, 156, t),
    phase = (2 * Math.PI * t) / 60,
    s = Math.sin(phase) * envelope,
    lag = Math.sin(phase - 0.7) * envelope, // the elbow trails the shoulder
    far = other(near);
  return {
    yaw,
    twist: twistToward(near, 6 * Math.sin(phase - 0.25) * envelope),
    [armKey(near)]: { forward: 2.5 * envelope + 32.5 * s, elbow: 8 + 8 * envelope + 11 * lag },
    [armKey(far)]: { forward: 2.5 * envelope - 32.5 * s, elbow: 8 + 8 * envelope - 11 * lag },
    // Protraction with the forward swing, retraction behind (metres: [up, back]).
    [shrugKey(near)]: [0.004 * Math.abs(s), -0.018 * s],
    [shrugKey(far)]: [0.004 * Math.abs(s), 0.018 * s],
  };
}

const reach = (arm: 'near' | 'far') => (t: number, yaw: number, near: Side): Pose => {
  const s = arm === 'near' ? near : other(near),
    lead = pulse(0, 34, 70, 104, t), // the chest and the girdle go first
    go = pulse(6, 46, 76, 116, t),
    late = pulse(14, 54, 72, 110, t); // the elbow opens last
  return {
    yaw,
    twist: twistToward(s, 13 * lead),
    pitch: 6 * lead,
    [armKey(s)]: { forward: 86 * go, elbow: 8 + 34 * go * (1 - late) + -3 * late, hand: 'open', palm: 'down' },
    [armKey(other(s))]: { forward: -10 * lead, elbow: 8 + 8 * lead },
    [shrugKey(s)]: [0.012 * go, -0.05 * lead],
    [shrugKey(other(s))]: [0, 0.015 * lead],
  };
};

const raise = (arm: 'near' | 'far', plane: 'forward' | 'side') => (t: number, yaw: number, near: Side): Pose => {
  const s = arm === 'near' ? near : other(near),
    go = pulse(0, 66, 84, 144, t),
    angle = 160 * go,
    // Scapulohumeral rhythm: nothing below 30 deg, then 1 deg of girdle per 2 of arm.
    girdle = Math.max(0, angle - 30) / 2 / 65, // 0..1 at 160 deg
    mid = Math.sin(Math.PI * Math.min(1, angle / 160)); // elbow softest half way
  return {
    yaw,
    roll: bendAway(s, 5 * girdle),
    twist: plane === 'forward' ? twistToward(s, 4 * Math.sin(Math.PI * go) ) : 0,
    [armKey(s)]:
      plane === 'forward'
        ? { forward: angle, elbow: 8 + 14 * mid, hand: 'open', palm: 'forward' }
        : { forward: 0, out: 4 + (150 - 4) * go, elbow: 8 + 10 * mid, hand: 'open', palm: 'forward' },
    [armKey(other(s))]: idle,
    // The shoulder point rises and moves toward the spine: [up, back, inward] metres.
    [shrugKey(s)]: [0.075 * girdle, plane === 'forward' ? 0.01 * girdle : 0.02 * girdle, 0.04 * girdle],
  };
};

export const GAP = 14; // neutral frames between motions

export function segments(view: ShoulderView): Segment[] {
  const list: Segment[] = [
    { name: 'ARM SWING (near arm; far arm opposite)', arm: 'near', length: 158, pose: swing },
    { name: 'FORWARD REACH (near arm)', arm: 'near', length: 118, pose: reach('near') },
    { name: 'ARM RAISE forward to 160 deg (near arm)', arm: 'near', length: 146, pose: raise('near', 'forward') },
  ];
  // Out to the side is toward the camera in three-quarter; in profile it is pure foreshortening.
  if (view === 'threeQuarterFront') list.push({ name: 'ARM RAISE out to the side, toward the camera (near arm)', arm: 'near', length: 146, pose: raise('near', 'side') });
  list.push(
    { name: 'FORWARD REACH (far arm)', arm: 'far', length: 118, pose: reach('far') },
    { name: 'ARM RAISE forward to 160 deg (far arm)', arm: 'far', length: 146, pose: raise('far', 'forward') },
  );
  return list;
}

export const VIEW_YAW: Record<ShoulderView, number> = { threeQuarterFront: -45, side: 0 };

export interface TakeFrame {
  view: ShoulderView;
  motion: string;
  /** Frame within the motion, or -1 in a neutral gap. */
  t: number;
  pose: Pose;
}
export interface Take {
  length: number;
  at: (n: number) => TakeFrame;
  /** [name, view, first frame, frame count] */
  index: [string, ShoulderView, number, number][];
}

/** One continuous take: every motion in three-quarter, then in profile. */
export function buildTake(views: ShoulderView[], near: Side = 'R'): Take {
  const index: Take['index'] = [],
    spans: { view: ShoulderView; segment: Segment | null; from: number; length: number }[] = [];
  let n = 0;
  for (const view of views) {
    for (const segment of segments(view)) {
      spans.push({ view, segment: null, from: n, length: GAP });
      n += GAP;
      spans.push({ view, segment, from: n, length: segment.length });
      index.push([segment.name, view, n, segment.length]);
      n += segment.length;
    }
    spans.push({ view, segment: null, from: n, length: GAP });
    n += GAP;
  }
  return {
    length: n,
    index,
    at(k: number): TakeFrame {
      const span = spans.find((s) => k >= s.from && k < s.from + s.length) ?? spans[spans.length - 1],
        yaw = VIEW_YAW[span.view];
      if (!span.segment) return { view: span.view, motion: 'neutral', t: -1, pose: { yaw } };
      return { view: span.view, motion: span.segment.name, t: k - span.from, pose: span.segment.pose(k - span.from, yaw, near) };
    },
  };
}
