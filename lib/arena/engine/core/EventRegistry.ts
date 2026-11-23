import type { PlayableArenaEvent } from './LiveTypes';
import { PrecisionEvent } from '../events/precision/PrecisionEvent';
import { RunningEvent } from '../events/running/RunningEvent';
import { FightingEvent } from '../events/fighting/FightingEvent';
import { runningMovement } from '../events/running/RunningConstants';
/** How React words one event: nothing here is behaviour, so the Play screens
 * never compare event ids. */
export interface EventPresentation {
  /** Score-strip text for one player. */
  scoreText: (p: { score: number; health: number }) => string;
  /** The bar under the name: aria-label suffix and the value it shows. */
  meter: { label: string; value: 'health' | 'stamina' };
  /** The small line under the bar is `${energyLabel} ${ceil(stamina)}`. */
  energyLabel: string;
  /** One-line control summary under each player's touch pad. */
  help: string;
  /** Setup-screen choice stored in `LiveConfig.options`. */
  option?: {
    key: string;
    label: string;
    className: string;
    choices: readonly { value: string; label: string }[];
    /** Normalise a raw select value to a valid choice. */
    parse: (value: string) => string;
    initial: string;
  };
}
export interface EventRegistration {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  presentation: EventPresentation;
  create: () => PlayableArenaEvent;
}
const events = new Map<string, EventRegistration>();
export function registerPlayableEvent(event: EventRegistration) {
  if (events.has(event.id))
    throw Error('Event already registered: ' + event.id);
  events.set(event.id, event);
}
export const playableEvents = () => [...events.values()];
export function playableEvent(id: string) {
  const event = events.get(id);
  if (!event) throw Error('Unknown playable event: ' + id);
  return event;
}
registerPlayableEvent({
  id: 'cornhole',
  name: 'Cornhole',
  description: 'Aim, charge and release. Four bags each.',
  minPlayers: 1,
  maxPlayers: 4,
  presentation: {
    scoreText: (p) => p.score + ' PTS',
    meter: { label: ' stamina', value: 'stamina' },
    energyLabel: 'Stamina',
    help: 'Aim, hold charge, then release in the teal window. On screen: tap charge, then release.',
  },
  create: () => new PrecisionEvent(),
});
registerPlayableEvent({
  id: 'running',
  name: 'Clubhouse Dash',
  description: 'Sprint, change lanes, jump hurdles and slide under bars.',
  minPlayers: 1,
  maxPlayers: 4,
  presentation: {
    scoreText: (p) => `${p.score}%`,
    meter: { label: ' stamina', value: 'stamina' },
    energyLabel: 'Stamina',
    help: 'Sprint, jump hurdles, slide under bars. On-screen sprint toggles.',
    option: {
      key: 'movement',
      label: 'Course controls',
      className: 'movement-choice',
      choices: [
        { value: 'lanes', label: 'Auto forward / change lanes' },
        { value: 'free', label: 'Free steering / control acceleration' },
      ],
      parse: runningMovement,
      initial: 'lanes',
    },
  },
  create: () => new RunningEvent(),
});
registerPlayableEvent({
  id: 'fighting',
  name: 'Backyard Brawl',
  description: 'Move, block and dodge. Chain light, light, heavy.',
  minPlayers: 2,
  maxPlayers: 2,
  presentation: {
    scoreText: (p) => `${Math.ceil(p.health)} HP`,
    meter: { label: ' health', value: 'health' },
    energyLabel: 'Energy',
    help: 'Move into range, attack, guard or dodge. Chain light, light, heavy.',
  },
  create: () => new FightingEvent(),
});
