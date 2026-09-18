import type { Attempt } from '../../../model';
import type { ShotStyle } from '../../animation/AnimationTypes';
import { surfacePoint } from '../../../equipment-layout';

/** Duration between first board contact and the immutable final outcome. */
export function surfaceTravelSeconds(attempt: Attempt, shot: ShotStyle) {
  const onBoard = ['board', 'hole'].includes(attempt.contact),
    direct = ['airmail', 'highArc', 'collect', 'drag', 'desperation'].includes(
      shot,
    );
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
