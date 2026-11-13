import type { EventActionMap } from '../../controllers/EventActionMap';
export const PrecisionActionMap: EventActionMap = {
  id: 'cornhole',
  bufferSeconds: 0.14,
  actions: [
    { intent: 'move', phase: 'analog', command: 'move', label: 'Position' },
    { intent: 'aim', phase: 'analog', command: 'aim', label: 'Aim' },
    ...(
      [
        'primaryAction',
        'secondaryAction',
        'tertiaryAction',
        'specialAction',
      ] as const
    ).map((intent, i) => ({
      intent,
      phase: 'pressed' as const,
      command: ['select.flat', 'select.slide', 'select.roll', 'select.airmail'][
        i
      ],
      label: ['Hole runner', 'Slide', 'Roll', 'Airmail'][i],
      states: ['aiming', 'charging'],
    })),
    {
      intent: 'charge',
      phase: 'pressed',
      command: 'charge',
      label: 'Hold / release',
      states: ['aiming'],
    },
    {
      intent: 'charge',
      phase: 'released',
      command: 'release',
      label: 'Release',
      states: ['charging'],
      hidden: true,
    },
    {
      intent: 'modifierRight',
      phase: 'pressed',
      command: 'precision',
      label: 'Precision mode',
      states: ['aiming', 'charging'],
    },
    {
      intent: 'primaryAction',
      phase: 'pressed',
      command: 'celebrate',
      label: 'Celebrate',
      states: ['result'],
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
