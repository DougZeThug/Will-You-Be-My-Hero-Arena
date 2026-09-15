import type { PlayableArenaEvent } from './LiveTypes';
import { PrecisionEvent } from '../events/precision/PrecisionEvent';
import { RunningEvent } from '../events/running/RunningEvent';
import { FightingEvent } from '../events/fighting/FightingEvent';
export interface EventRegistration {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
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
  create: () => new PrecisionEvent(),
});
registerPlayableEvent({
  id: 'running',
  name: 'Clubhouse Dash',
  description: 'Sprint, change lanes, jump hurdles and slide under bars.',
  minPlayers: 1,
  maxPlayers: 4,
  create: () => new RunningEvent(),
});
registerPlayableEvent({
  id: 'fighting',
  name: 'Backyard Brawl',
  description: 'Move, block and dodge. Chain light, light, heavy.',
  minPlayers: 2,
  maxPlayers: 2,
  create: () => new FightingEvent(),
});
