import type { EventActionMap } from '../../controllers/EventActionMap';
export const FightingActionMap: EventActionMap = {
  id: 'fighting',
  bufferSeconds: 0.23,
  combos: [
    {
      id: 'one-two-finish',
      sequence: ['primaryAction', 'primaryAction', 'secondaryAction'],
      window: 1.15,
      command: 'finisher',
    },
    {
      id: 'direction-special',
      sequence: ['down', 'right', 'specialAction'],
      window: 0.65,
      command: 'chargedSpecial',
    },
  ],
  actions: [
    { intent: 'move', phase: 'analog', command: 'move', label: 'Move' },
    {
      intent: 'primaryAction',
      phase: 'pressed',
      command: 'grapple',
      label: 'Grapple',
      modifiers: ['modifierRight'],
      hidden: true,
    },
    {
      intent: 'primaryAction',
      phase: 'pressed',
      command: 'light',
      label: 'Light attack',
    },
    {
      intent: 'secondaryAction',
      phase: 'pressed',
      command: 'heavy',
      label: 'Heavy attack',
    },
    {
      intent: 'tertiaryAction',
      phase: 'pressed',
      command: 'dodge',
      label: 'Dodge',
    },
    {
      intent: 'specialAction',
      phase: 'pressed',
      command: 'special',
      label: 'Power strike',
    },
    { intent: 'modifierLeft', phase: 'held', command: 'block', label: 'Block' },
    {
      intent: 'modifierLeft',
      phase: 'released',
      command: 'stopBlock',
      label: 'Release guard',
      hidden: true,
    },
    {
      intent: 'modifierRight',
      phase: 'pressed',
      command: 'ability',
      label: 'Counter stance',
    },
    {
      intent: 'left',
      phase: 'doubleTapped',
      command: 'dodge',
      label: 'Dodge',
      hidden: true,
    },
    {
      intent: 'right',
      phase: 'doubleTapped',
      command: 'dodge',
      label: 'Dodge',
      hidden: true,
    },
    {
      intent: 'celebrate',
      phase: 'pressed',
      command: 'celebrate',
      label: 'Taunt',
    },
  ],
};
