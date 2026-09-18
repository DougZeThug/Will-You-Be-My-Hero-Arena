import type { Attempt } from '../../../model';
import type { ShotStyle } from '../../animation/AnimationTypes';
import type { ReleaseFrame, ProjectileFrame } from '../ArenaEvent';
import {
  surfacePoint,
  boardDepthScale,
  BAG_FLIGHT_FLATTEN,
  placement,
} from '../../../equipment-layout';
import { clamp01, smooth } from '../../../match-timeline';
import { surfaceTravelSeconds } from './CornholePresentationTiming';
export {
  firstImpactTime,
  surfaceTravelSeconds,
} from './CornholePresentationTiming';

/** Integrate from the evaluated release velocity. Solve acceleration against
 * the immutable board contact. Horizontal acceleration accommodates the
 * compressed court projection: visual physics, never a new scoring rule. */
export function releasedBag(
  a: Attempt,
  shot: ShotStyle,
  release: ReleaseFrame,
  time: number,
): ProjectileFrame {
  const velocity = release.velocity!;
  const target = surfacePoint('cornhole', a.actor, a.target);
  const direct = [
    'airmail',
    'highArc',
    'collect',
    'drag',
    'desperation',
  ].includes(shot);
  const touch = a.boardResolution?.touch
    ? surfacePoint('cornhole', a.actor, a.boardResolution.touch)
    : target;
  const slide = surfaceTravelSeconds(a, shot);
  const air = Math.max(0.3, a.duration - slide),
    elapsed = Math.max(0, time - a.releaseAt),
    t = Math.min(air, elapsed);
  const ax = (2 * (touch.x - release.x - velocity.x * air)) / (air * air),
    gravity = (2 * (touch.y - release.y - velocity.y * air)) / (air * air);
  let x = release.x + velocity.x * t + 0.5 * ax * t * t,
    y = release.y + velocity.y * t + 0.5 * gravity * t * t;
  const rolls = ['roll', 'cut', 'flop', 'trick'].includes(shot),
    omega = rolls ? 2.5 : direct ? 0.16 : 0.08;
  let angle = (release.angle ?? 0) + omega * t,
    flatten =
      (release.flatten ?? BAG_FLIGHT_FLATTEN) +
      (rolls ? 0.09 * Math.sin(t * 5) : 0),
    alpha = 1;
  let vx = velocity.x + ax * t,
    vy = velocity.y + gravity * t;
  // Only the new performance supplies an edge-on release exposure. Ease that
  // same object toward the board plane before contact; preserve historical paths.
  if (release.flatten !== undefined) {
    const approach = smooth(clamp01((t / air - 0.55) / 0.45));
    angle += (-0.1 - angle) * approach;
    flatten += (0.52 - flatten) * approach;
  }
  if (elapsed >= air && slide) {
    const u = clamp01((elapsed - air) / slide),
      travel = 1 - (1 - u) ** 2;
    x = touch.x + (target.x - touch.x) * travel;
    y = touch.y + (target.y - touch.y) * travel;
    vx = ((target.x - touch.x) * 2 * (1 - u)) / slide;
    vy = ((target.y - touch.y) * 2 * (1 - u)) / slide;
    angle += (rolls ? 0.65 : 0) * u;
    angle += (-0.1 - angle) * smooth(u);
    flatten =
      flatten +
      (0.52 - flatten) * travel -
      0.07 * Math.sin(Math.PI * clamp01(u / 0.35));
  }
  const after = Math.max(0, elapsed - a.duration),
    fall = clamp01(after / 0.28);
  if (elapsed >= a.duration) {
    x = target.x;
    y = target.y;
    vx = 0;
    vy = 0;
    if (a.contact === 'hole') {
      y += 42 * smooth(fall) * boardDepthScale(a.actor);
      alpha = fall >= 1 ? 0 : 1;
      flatten *= 1 - 0.15 * fall;
    } else if (a.contact === 'board') {
      angle += (-0.1 - angle) * smooth(fall);
      flatten += (0.52 - flatten) * smooth(fall);
    } else {
      x += 20 * fall;
      y += 7 * fall - 5 * Math.sin(fall * Math.PI);
      angle += 0.25 * fall;
      alpha = 1 - clamp01((after - 0.4) / 0.3);
    }
  }
  const startScale = release.scale ?? 1;
  const depth =
    startScale + (boardDepthScale(a.actor) - startScale) * clamp01(t / air);
  return {
    x,
    y,
    angle,
    flatten,
    alpha,
    scale: depth * (a.contact === 'hole' ? 1 - 0.2 * fall : 1),
    ...(a.contact === 'hole' && elapsed >= a.duration
      ? {
          occlusion: {
            ...placement('cornhole', a.actor).anchor,
            y: placement('cornhole', a.actor).anchor.y + 5 * depth,
            slope: -0.1,
          },
        }
      : {}),
    ground: {
      x,
      y:
        610 -
        a.actor * 133 +
        (target.y - (610 - a.actor * 133)) * clamp01(t / air),
    },
    kinematics: {
      model: 'release-constant-acceleration',
      velocity: { x: vx, y: vy },
      initialVelocity: velocity,
      acceleration: { x: ax, y: gravity },
      airTime: air,
      phase:
        elapsed < air
          ? 'flight'
          : elapsed < a.duration
            ? 'board-slide'
            : a.contact === 'hole'
              ? 'hole-drop'
              : 'settle',
    },
  };
}
