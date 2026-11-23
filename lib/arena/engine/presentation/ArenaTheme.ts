import { EQUIPMENT_ASSET_DIR } from '../../sport-stage';
import type { Attempt } from '../../model';
/** Shared presentation data. It never decides scores, attempts, contacts or input. */
/** The printed palette of app/globals.css (--ink, --yellow, --teal, --orange):
 * one set of colours for the page, the canvas HUD and the effects. */
export const ARENA_THEME = {
  ink: 0x121615,
  cream: 0xffedc8,
  gold: 0xffca23,
  teal: 0x117d87,
  orange: 0xf05a24,
  shadow: 0x211d20,
  warmTint: 0xfff2df,
  /** Matches the CSS display stack; Anton is self-hosted in public/fonts/. */
  font: "Impact, 'Anton', 'Arial Narrow', sans-serif",
  background: '/assets/arena-sunset-v2.png',
} as const;
export const EVENT_PRESENTATION = {
  cornhole: {
    title: 'CORNHOLE',
    unit: 'BAGS',
    accent: 0xe7b75b,
  },
  basketball: {
    title: 'BASKETBALL',
    unit: 'SHOTS',
    accent: 0xea9b58,
  },
  football: {
    title: 'FOOTBALL',
    unit: 'THROWS',
    accent: 0x89a993,
  },
  pong: {
    title: 'BEER PONG',
    unit: 'SHOTS',
    accent: 0xdc846c,
  },
  running: { title: 'RUNNING', unit: '%', accent: 0x9cbd9a },
  fighting: {
    title: 'FIGHTING',
    unit: 'HP',
    accent: 0xd78e76,
  },
} as const;
export type ArenaEventStyle = keyof typeof EVENT_PRESENTATION;
export interface PresentationPlayer {
  /** The card's character, e.g. DAN. */
  name: string;
  /** The club member who played the card, shown only when it is someone else. */
  owner?: string;
  score: number;
  active?: boolean;
  status?: string;
  remaining?: number;
  total?: number;
  meter?: number;
  /** Extra score scale for a landing score's short pulse (0 = none). */
  pulse?: number;
}
export interface PresentationState {
  event: ArenaEventStyle;
  phase: string;
  time: number;
  protectedPoints?: { x: number; y: number; radius: number }[];
  players: PresentationPlayer[];
  action?: { label: string; value: number; target?: number; window?: number };
  /** The stamped FINAL banner ("DOUG WINS"), `age` seconds after it lands. */
  banner?: { text: string; age: number };
  /** Reduced motion: stamps appear without the scale-in. */
  reduced?: boolean;
}
export const bounded = (n: number, max = 1) =>
  Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
/** Appearance registration only; authoritative board plane/hole remain in equipment-art.ts.
 * Source hole measured by an ellipse fit to the dark interior (see presentation QA).
 */
export const BOARD_FINISH = {
  url: EQUIPMENT_ASSET_DIR + 'board-finish-v2.png',
  width: 2170,
  height: 725,
  hole: { x: 1744.4, y: 202.405 },
} as const;
/** Player-facing words for the Watch contest phases (`MatchPhase` in
 * match-timeline.ts) that reach the HUD. Presentation only: the timeline and
 * event rules keep their own phase names. */
const PHASE_LABELS: Record<string, string> = {
  entrance: 'CARDS TO COURT',
  ready: 'READY',
  anticipation: 'LINING UP',
  throw: 'WINDING UP',
  release: 'LET IT GO',
  bagFlight: 'IN THE AIR',
  boardTravel: 'ON THE BOARD',
  landing: 'LANDING',
  result: 'SCORING',
  reset: 'NEXT UP',
  complete: 'FINAL',
};
/** A HUD label for a phase name; unknown names are split at camel case. */
export const phaseLabel = (phase: string) =>
  PHASE_LABELS[phase] ??
  phase.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
/** Stamped scoring callouts by recorded contact ("+3 IN THE HOLE!"); each
 * contact name belongs to one sport, so this needs no sport switch. Contacts
 * that score nothing have no entry. Presentation only. */
export const CONTACT_CALLOUT: Partial<Record<Attempt['contact'], string>> = {
  hole: 'IN THE HOLE!',
  board: 'ON THE BOARD',
  zone3: 'BULLSEYE!',
  zone2: 'ON TARGET',
  zone1: 'ON TARGET',
  cup: 'IN THE CUP!',
  make: 'BUCKET!',
};
