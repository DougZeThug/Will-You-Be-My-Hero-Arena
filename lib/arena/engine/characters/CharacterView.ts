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
 * so the two drawings are never on screen together.
 */
export function viewWidths(frontness: number) {
  const f = Math.max(0, Math.min(1, frontness)),
    ease = (u: number) => u * u * (3 - 2 * u);
  return {
    side: ease(Math.max(0, 1 - 2 * f)),
    front: ease(Math.max(0, 2 * f - 1)),
  };
}
