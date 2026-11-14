import type { Attempt } from '../../../model';
import type { ShotStyle } from '../../animation/AnimationTypes';
import { surfacePoint } from '../../../equipment-geometry';

/** Shots that fly straight onto the board with no slide phase. */
export const isDirectShot = (shot: ShotStyle) =>
  ['airmail', 'highArc', 'collect', 'drag', 'desperation'].includes(shot);

/** Duration between first board contact and the immutable final outcome. */
export function surfaceTravelSeconds(attempt: Attempt, shot: ShotStyle) {
  const onBoard = ['board', 'hole'].includes(attempt.contact),
    direct = isDirectShot(shot);
  const target = surfacePoint('cornhole', attempt.actor, attempt.target),
    touch = attempt.boardResolution?.touch
      ? surfacePoint('cornhole', attempt.actor, attempt.boardResolution.touch)
      : target;
  return onBoard && !direct
    ? 0.28
    : Math.hypot(touch.x - target.x, touch.y - target.y) > 2
      ? 0.22
      : 0;
}

/** Pure authoritative match-clock boundary for the first physical impact.
 * Saved contactAt remains the final target/outcome boundary. */
export function firstImpactTime(attempt: Attempt, shot: ShotStyle) {
  return attempt.contactAt - surfaceTravelSeconds(attempt, shot);
}

/** The impact boundary any sport's presentation reacts to: cornhole's first
 * physical touch (once its shot is known), otherwise the saved contactAt. */
export function impactTime(attempt: Attempt, shot?: ShotStyle) {
  return attempt.sport === 'cornhole' && shot
    ? firstImpactTime(attempt, shot)
    : attempt.contactAt;
}

/** Resolve the one presentation shot shared by direction, physics, effects,
 * HUD phases, and cues. A generated historical direction takes precedence. */
export function presentationShot(
  attempt: Attempt,
  directedShot?: ShotStyle,
): ShotStyle {
  return directedShot ?? attempt.boardResolution?.shot ?? 'flat';
}
