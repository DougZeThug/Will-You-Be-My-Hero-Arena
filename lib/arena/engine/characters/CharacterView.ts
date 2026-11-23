import { clamp01, smoothstep } from '../../math';
/**
 * Which drawn angle of a character faces the camera.
 *
 * The camera looks across the court from the side. A character travelling or
 * exchanging blows across the screen is seen in profile (`side`); one facing
 * the crowd, before the start or after the result, is seen from the front
 * (`front`). Facing left in profile shows the rear-three-quarter garment view
 * rather than a mirrored print. Three-quarter and back drawings would slot in
 * here as further views once their art exists.
 */
export type CharacterView = 'front' | 'side';

export function chooseView(c: { substate: string }): CharacterView {
  return c.substate === 'ready' || c.substate === 'finished' ? 'front' : 'side';
}

/** Seconds for a turn between views: a paper-flip through edge-on. */
export const VIEW_TURN_SECONDS = 0.22;

/**
 * Horizontal draw widths of each view during a turn, from the frontness
 * (0 = side, 1 = front). The outgoing view closes to edge-on in the first
 * half and the incoming view opens in the second, like a card turning over,
 * so the two drawings are never on screen together. Widths follow the
 * projected width of a turning card, |cos(pi * e)| of the eased progress e:
 * the turn starts and settles gently but passes edge-on quickly, instead of
 * lingering as a sliver (under 5% wide for well under one 60 Hz frame).
 */
export function viewWidths(frontness: number) {
  const e = smoothstep(clamp01(frontness)),
    width = Math.cos(Math.PI * e);
  return {
    side: e < 0.5 ? Math.max(0, width) : 0,
    front: e > 0.5 ? Math.max(0, -width) : 0,
  };
}
