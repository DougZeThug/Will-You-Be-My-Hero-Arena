import type { EventActionMap } from '../../../lib/arena/engine/controllers/EventActionMap';
import type { MotionActor, MotionMechanic } from '../MotionActor';
import type { MotionEvent } from '../../../lib/arena/engine/motion/MotionTypes';
import type { IntentValues } from '../../../lib/arena/engine/input/InputActions';
export interface MotionEventModule extends MotionMechanic {
  id: string;
  controls: EventActionMap;
  initialize(actors: MotionActor[]): void;
  update(dt: number, time: number): void;
  marker(actor: MotionActor, event: MotionEvent): void;
  ai(actor: MotionActor, time: number): IntentValues;
  snapshot(): Record<string, unknown>;
  pause(): void;
}
export const sharedActions: EventActionMap['actions'] = [
  { intent: 'move', phase: 'analog', command: 'move', label: 'Move' },
  { intent: 'aim', phase: 'analog', command: 'aim', label: 'Aim' },
  {
    intent: 'celebrate',
    phase: 'pressed',
    command: 'celebrate',
    label: 'Celebrate',
  },
];
