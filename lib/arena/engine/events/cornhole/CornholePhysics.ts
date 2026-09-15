import type { Attempt } from '../../../model';
import {
  surfacePoint,
  boardDepthScale,
  BAG_FLIGHT_FLATTEN,
} from '../../../equipment-layout';
import { clamp01, smooth } from '../../../match-timeline';
import type { ShotStyle } from '../../animation/AnimationTypes';
import type { XY, ReleaseFrame, ProjectileFrame } from '../ArenaEvent';
import { releasedBag } from './ReleasedBagPhysics';
export type BagOutcome =
  | 'cleanHole'
  | 'frontSlide'
  | 'sideSlide'
  | 'blocker'
  | 'rollAround'
  | 'airmailHole'
  | 'collect'
  | 'collision'
  | 'push'
  | 'drag'
  | 'bounce'
  | 'hang'
  | 'kick'
  | 'slideOff'
  | 'rollOff'
  | 'missLeft'
  | 'missRight'
  | 'short'
  | 'long'
  | 'lipOut';
export const SHOT_PHYSICS: Record<
  ShotStyle,
  { arc: number; slide: number; spin: number; curve: number }
> = {
  standard: { arc: 87, slide: 0.22, spin: 0.6, curve: 0 },
  flat: { arc: 38, slide: 0.29, spin: 0.12, curve: 0 },
  airmail: { arc: 190, slide: 0, spin: 0.8, curve: 0 },
  roll: { arc: 100, slide: 0.25, spin: 6.3, curve: 12 },
  slide: { arc: 52, slide: 0.32, spin: 0.15, curve: 0 },
  blocker: { arc: 115, slide: 0.15, spin: 0.45, curve: 0 },
  push: { arc: 43, slide: 0.31, spin: 0.2, curve: 0 },
  cut: { arc: 75, slide: 0.25, spin: 1.5, curve: -22 },
  drag: { arc: 178, slide: 0.08, spin: 0.4, curve: -5 },
  collect: { arc: 169, slide: 0.12, spin: 0.5, curve: 0 },
  flop: { arc: 136, slide: 0.14, spin: 3.3, curve: 0 },
  soft: { arc: 119, slide: 0.2, spin: 0.2, curve: 0 },
  fast: { arc: 34, slide: 0.34, spin: 0.4, curve: 0 },
  desperation: { arc: 206, slide: 0.14, spin: 2.3, curve: 18 },
  trick: { arc: 150, slide: 0.22, spin: 5, curve: -16 },
  offBalance: { arc: 82, slide: 0.21, spin: 2, curve: 20 },
  clutch: { arc: 60, slide: 0.25, spin: 0.12, curve: 0 },
  casual: { arc: 88, slide: 0.25, spin: 0.2, curve: 0 },
  highArc: { arc: 155, slide: 0.17, spin: 0.6, curve: 0 },
};
export function bagOutcome(a: Attempt, shot: ShotStyle): BagOutcome {
  if (a.contact === 'hole')
    return shot === 'airmail'
      ? 'airmailHole'
      : shot === 'collect' || shot === 'drag'
        ? 'collect'
        : 'cleanHole';
  if (a.contact === 'board')
    return shot === 'blocker'
      ? 'blocker'
      : shot === 'roll'
        ? 'rollAround'
        : shot === 'push'
          ? 'push'
          : shot === 'drag'
            ? 'drag'
            : shot === 'cut'
              ? 'sideSlide'
              : 'frontSlide';
  const lane = a.actor * 3.5;
  if (a.target.x < 8) return 'short';
  if (a.target.x > 9.9) return 'long';
  return shot === 'roll'
    ? 'rollOff'
    : shot === 'slide'
      ? 'slideOff'
      : a.target.z < lane
        ? 'missLeft'
        : 'missRight';
}
/** Visual physics is kinematic and outcome constrained. It never rolls dice or
 * changes scoring in the render loop. Board depth and the printed hole are the
 * same registered surface used by the rules and equipment. */
export function sampleBag(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
  time: number,
): ProjectileFrame {
  if (release.velocity) return releasedBag(a, shot, release, time);
  const config = SHOT_PHYSICS[shot],
    elapsed = Math.max(0, time - a.releaseAt),
    onBoard = a.contact === 'board' || a.contact === 'hole',
    off = a.boardResolution?.touch;
  const slide = off?.x !== undefined ? 0.32 : onBoard ? config.slide : 0,
    air = a.duration - slide,
    t = clamp01(elapsed / air),
    target = surfacePoint('cornhole', a.actor, a.target);
  const touch = off
    ? surfacePoint('cornhole', a.actor, off)
    : {
        x: target.x - (onBoard ? slide * 210 : 0),
        y: target.y + (onBoard ? slide * 20 : 0),
      };
  const ground = {
    x: release.x + (target.x - release.x) * t,
    y: 610 - a.actor * 133 + (target.y - (610 - a.actor * 133)) * t,
  };
  const rolls = ['roll', 'flop', 'trick'].includes(shot);
  let x = release.x + (touch.x - release.x) * t,
    y = release.y + (touch.y - release.y) * t - 4 * config.arc * t * (1 - t),
    angle = rolls ? config.spin * t : Math.sin(t * config.spin * 6) * 0.075,
    flatten =
      BAG_FLIGHT_FLATTEN +
      (rolls
        ? 0.24 * Math.abs(Math.sin(t * config.spin))
        : 0.025 * Math.sin(t * 8)),
    alpha = 1;
  if (elapsed >= air && slide > 0) {
    const u = clamp01((elapsed - air) / slide),
      s = 1 - (1 - u) ** 2;
    x = touch.x + (target.x - touch.x) * s;
    y =
      touch.y + (target.y - touch.y) * s + Math.sin(u * Math.PI) * config.curve;
    const impactAngle = angle,
      impactFlatten = flatten,
      roll = shot === 'roll';
    angle = impactAngle + (roll ? u * Math.PI * 2 : 0);
    angle +=
      (-0.1 - impactAngle - (roll ? Math.PI * 2 : 0)) *
      smooth(roll ? (u - 0.55) / 0.45 : u);
    flatten =
      impactFlatten +
      (0.52 - impactFlatten) * s +
      (roll ? 0.18 * Math.sin(u * Math.PI * 2) * (1 - u) : 0);
  }
  if (elapsed >= a.duration) {
    const u = clamp01((elapsed - a.duration) / 0.28);
    x = target.x;
    y = target.y;
    if (a.contact === 'hole') {
      y += u * 17;
      alpha = 1 - u;
      flatten *= 1 - u * 0.6;
    } else if (a.contact === 'board') {
      angle += (-0.1 - angle) * smooth(u);
      flatten += (0.52 - flatten) * smooth(u);
    } else {
      x += u * 23;
      y += u * 7 - Math.sin(u * Math.PI) * 12;
      angle += u * 2;
      flatten += (0.55 - flatten) * u;
      alpha = 1 - clamp01((elapsed - a.duration - 0.45) / 0.3);
    }
  }
  const scale =
    (1 + (boardDepthScale(a.actor) - 1) * t) *
    (a.contact === 'hole' && elapsed > a.duration
      ? 1 - clamp01((elapsed - a.duration) / 0.28) * 0.65
      : 1);
  return { x, y, angle, scale, flatten, alpha, ground };
}
