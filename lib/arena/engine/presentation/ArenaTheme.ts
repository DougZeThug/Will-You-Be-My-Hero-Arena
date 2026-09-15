/** Shared presentation data. It never decides scores, attempts, contacts or input. */
export const ARENA_THEME = {
  ink: 0x111b20,
  cream: 0xffedc8,
  gold: 0xe7b75b,
  teal: 0x398f9a,
  orange: 0xe58a4c,
  shadow: 0x211d20,
  warmTint: 0xfff2df,
  font: 'Impact, Arial Narrow, sans-serif',
  background: '/assets/arena-sunset-v2.png',
  panel: { width: 312, height: 94, margin: 24, radius: 7 },
} as const;
export const EVENT_PRESENTATION = {
  cornhole: {
    title: 'CORNHOLE',
    unit: 'BAGS',
    accent: 0xe7b75b,
    zone: 'TOSS COURT',
  },
  basketball: {
    title: 'BASKETBALL',
    unit: 'SHOTS',
    accent: 0xea9b58,
    zone: 'SHOOTING COURT',
  },
  football: {
    title: 'FOOTBALL',
    unit: 'THROWS',
    accent: 0x89a993,
    zone: 'TARGET RANGE',
  },
  pong: {
    title: 'BEER PONG',
    unit: 'SHOTS',
    accent: 0xdc846c,
    zone: 'TABLE COURT',
  },
  running: { title: 'RUNNING', unit: '%', accent: 0x9cbd9a, zone: 'TRACK' },
  fighting: {
    title: 'FIGHTING',
    unit: 'HP',
    accent: 0xd78e76,
    zone: 'COMBAT COURT',
  },
} as const;
export type ArenaEventStyle = keyof typeof EVENT_PRESENTATION;
export interface PresentationPlayer {
  name: string;
  score: number;
  active?: boolean;
  status?: string;
  remaining?: number;
  total?: number;
  meter?: number;
}
export interface PresentationState {
  event: ArenaEventStyle;
  phase: string;
  time: number;
  protectedPoints?: { x: number; y: number; radius: number }[];
  players: PresentationPlayer[];
  action?: { label: string; value: number; target?: number; window?: number };
}
export const bounded = (n: number, max = 1) =>
  Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
/** Appearance registration only; authoritative board plane/hole remain in equipment-art.ts.
 * Source hole measured by an ellipse fit to the dark interior (see presentation QA).
 */
export const BOARD_FINISH = {
  url: '/assets/equipment/board-finish-v2.png',
  width: 2170,
  height: 725,
  hole: { x: 1744.4, y: 202.405 },
  canonicalWidth: 2206,
  canonicalHeight: 713,
} as const;
