import type { EventActionMap } from '../../controllers/EventActionMap';
export const RunningActionMap: EventActionMap = {
  id: 'running',
  bufferSeconds: 0.18,
  actions: [
    {
      intent: 'move',
      phase: 'analog',
      command: 'move',
      label: 'Steer / change lanes',
    },
    { intent: 'charge', phase: 'held', command: 'sprint', label: 'Sprint' },
    {
      intent: 'charge',
      phase: 'released',
      command: 'stopSprint',
      label: 'Recover stamina',
      hidden: true,
    },
    {
      intent: 'primaryAction',
      phase: 'pressed',
      command: 'jump',
      label: 'Jump',
    },
    {
      intent: 'tertiaryAction',
      phase: 'pressed',
      command: 'dodge',
      label: 'Dodge',
    },
    {
      intent: 'secondaryAction',
      phase: 'pressed',
      command: 'slide',
      label: 'Slide',
    },
    {
      intent: 'specialAction',
      phase: 'pressed',
      command: 'burst',
      label: 'Burst sprint',
    },
    { intent: 'modifierLeft', phase: 'held', command: 'brake', label: 'Brake' },
    {
      intent: 'modifierLeft',
      phase: 'released',
      command: 'stopBrake',
      label: 'Accelerate',
      hidden: true,
    },
    {
      intent: 'celebrate',
      phase: 'pressed',
      command: 'celebrate',
      label: 'Celebrate',
    },
  ],
};
