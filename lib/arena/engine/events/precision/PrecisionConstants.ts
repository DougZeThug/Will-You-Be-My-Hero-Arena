import type { Intent } from '../../input/InputActions';
/** The four shots a player can select. */
export type ShotId = 'flat' | 'slide' | 'roll' | 'airmail';
export interface ShotDefinition {
  /** The action-map intent that selects the shot; its command is `select.<id>`. */
  intent: Extract<
    Intent,
    'primaryAction' | 'secondaryAction' | 'tertiaryAction' | 'specialAction'
  >;
  /** The name the controls and captions use. */
  label: string;
  /** The card rating that sets the shot's release window: a Hole runner is a slide shot. */
  skill: ShotId;
  /** Flight time in seconds. */
  duration: number;
  /** Peak height of the flight arc (stage px). */
  arc: number;
  /** Bag spin over the flight (radians; above 3 it tumbles, otherwise it wobbles). */
  spin: number;
  /** The live throw clip the thrower plays. */
  clip: string;
}
/** Every shot's values in one place, in the order the controls list them. */
export const SHOTS: Record<ShotId, ShotDefinition> = {
  flat: {
    intent: 'primaryAction',
    label: 'Hole runner',
    skill: 'slide',
    duration: 0.88,
    arc: 66,
    spin: 0.6,
    clip: 'throw.precision',
  },
  slide: {
    intent: 'secondaryAction',
    label: 'Slide',
    skill: 'slide',
    duration: 0.88,
    arc: 105,
    spin: 0.6,
    clip: 'throw.precision',
  },
  roll: {
    intent: 'tertiaryAction',
    label: 'Roll',
    skill: 'roll',
    duration: 0.88,
    arc: 105,
    spin: Math.PI * 4,
    clip: 'throw.roll.live',
  },
  airmail: {
    intent: 'specialAction',
    label: 'Airmail',
    skill: 'airmail',
    duration: 1.25,
    arc: 240,
    spin: 0.6,
    clip: 'throw.airmail.live',
  },
};
export const SHOT_IDS = Object.keys(SHOTS) as ShotId[];
export const SELECT_PREFIX = 'select.';
/** The action-map command that selects a shot. */
export const selectCommand = (shot: ShotId) => SELECT_PREFIX + shot;
/** The shot a `select.<id>` command picks, or undefined for any other command. */
export function shotOfCommand(command: string): ShotId | undefined {
  if (!command.startsWith(SELECT_PREFIX)) return undefined;
  const id = command.slice(SELECT_PREFIX.length);
  return id in SHOTS ? (id as ShotId) : undefined;
}
/** Bags each player throws in a match. */
export const BAGS_PER_PLAYER = 4;
/** After this many of a player's bags the clutch ability applies. */
export const CLUTCH_AFTER_BAGS = 3;
/** Points for a bag in the hole and a bag resting on the board. */
export const HOLE_POINTS = 3;
export const BOARD_POINTS = 1;
