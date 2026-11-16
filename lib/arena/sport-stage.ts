import type { Attempt, Sport } from './model';
import type { PaperPose } from './paper';
import { HOOP_TARGET_X, LANE_SPACING, boardSurfaceY } from './board-geometry';
import { EQUIPMENT_ART as ART, type XY, type Quad } from './equipment-art';

// The one per-sport stage table: which drawn equipment a sport uses, where it
// stands on the court, what the projectile looks like and which decorations
// the presentation adds. Readers index SPORT_STAGE[sport]; they never branch on
// the sport id for data. Pure data: no Phaser, simulation or timeline imports.
export const EQUIPMENT_ASSET_DIR = '/assets/equipment/';
type EquipmentName = 'board' | 'hoop' | 'target' | 'table';
// Opaque source soles, excluding the transparent padding around each image.
export const EQUIPMENT_GROUND = {
  board: 673,
  hoop: 667,
  target: 616,
  table: 528,
} as const satisfies Record<EquipmentName, number>;
// Court-plane screen pixels shared by every sport's lanes (actor 0 is the
// near lane, actor 1 the back lane). The painted lane accents sit 2px above it.
// One lane's z step in screen px (LANE_SPACING world units at 38 px per z);
// exactly 133, so lane arithmetic below stays bit-identical to the literal.
const LANE_SCREEN_STEP = LANE_SPACING * 38;
export const laneGroundY = (actor: number) => 622 - actor * LANE_SCREEN_STEP;
// Court plane under a thrown bag's shadow: simulation project() at z = lane.
export const laneShadowY = (actor: number) => 610 - actor * LANE_SCREEN_STEP;
export const LANE_ACCENT_INSET = 2;
// Painted lane guides (ArenaEnvironment): the same for every lane sport.
export const LANE_GUIDE_X = [
  { start: 200, end: 1040 },
  { start: 510, end: 1170 },
] as const;

type Contact = Attempt['contact'];
/** Cornhole scores on the board (CornholeBoard rules); the other sports score
 * by distance from a centre, the first band that contains the point winning. */
type ScoringRule =
  | { kind: 'board' }
  | {
      /** Distance in the `axis`-z plane from `at` (z is the lane). */
      kind: 'bands';
      axis: 'x' | 'y';
      at: number;
      bands: readonly { within: number; contact: Contact; score: number }[];
      /** Landing past this x is `contact` instead of `otherwise`. */
      beyond?: { x: number; contact: Contact };
      otherwise: Contact;
    }
  | {
      /** Distance from the aimed cup (cupPosition). */
      kind: 'cup';
      bands: readonly { within: number; contact: Contact; score: number }[];
      otherwise: Contact;
    };
type AimRule =
  | {
      /** Throws at a fixed wall: `jitter` axes scatter, the others do not. */
      kind: 'wall';
      sigma: number;
      centre: { x: number; y: number };
      jitter: readonly ('x' | 'y')[];
    }
  | { kind: 'cups'; sigma: number };

/** Constants mapping simulation metres onto each sport's drawn surface. */
type SurfaceMap =
  | {
      kind: 'board';
      x0: number;
      xSpan: number;
      /** Along-board metres from x0 that land on the printed hole. */
      xHole: number;
      zOffset: number;
      zSpan: number;
      zHole: number;
      lift: number;
    }
  | {
      kind: 'rings';
      centerY: number;
      inner: number;
      middle: number;
      innerSpan: number;
      outerSpan: number;
    }
  | {
      kind: 'table';
      x0: number;
      xSpan: number;
      zOffset: number;
      zSpan: number;
      y0: number;
      lift: number;
    }
  | {
      kind: 'hoop';
      x0: number;
      xScale: number;
      zToX: number;
      zToY: number;
      y0: number;
      yScale: number;
    };

interface SportStage {
  /** Drawn equipment image this sport plays on. */
  equipment: EquipmentName;
  /** Equipment is scaled so this source axis spans `px` screen pixels. */
  size: { axis: 'width' | 'height'; px: number };
  /** Registered point in source pixels that sits on the lane anchor. */
  anchor: XY | { plane: Quad; u: number; v: number };
  /** Screen x of the anchor for the near lane and the per-actor step. */
  anchorX: { origin: number; perActor: number };
  surface: SurfaceMap;
  /** Asset names (under EQUIPMENT_ASSET_DIR) the event needs, in load order. */
  art: readonly string[];
  projectile: {
    texture: string;
    /** Texture for actor !== 0 when the second team has its own colour. */
    awayTexture?: string;
    width: number;
    /** Default vertical squash of the projectile sprite. */
    flatten: number;
    /** Tumble in flight: rotation = sin(elapsed * rate) * amplitude. */
    wobble?: { rate: number; amplitude: number };
  };
  shadow: { maxWidth: number; height: number };
  /** Seconds from release to contact on the Watch timeline (match-timeline). */
  flightSeconds: number;
  /** HUD status text while the projectile is airborne. */
  flightLabel: 'BAG FLIGHT' | 'BALL FLIGHT';
  /** Prepared paper-doll frames (paper.ts) for the wind-up and the release. */
  paperPose: { windup: PaperPose; release: PaperPose };
  /** Direction cue emitted at first contact (BattleDirector). */
  impactCue: 'boardImpact' | 'impact';
  /** Screen scale of the back lane's equipment (actor 1); the near lane is 1. */
  backLaneScale: number;
  /** How the simulation scores a landing point (simulation.contactScore). */
  scoring: ScoringRule;
  /** How the simulation scatters a throw around its target, when the sport
   * does not use the shared board scatter (simulation.simulate). */
  aim?: AimRule;
  /** Target the Lab character previews throw at (metres, lane 0). */
  previewTarget: { x: number; y: number };
  /** Match narration wording (MatchNarration). */
  narration: {
    /** Said once the projectile has landed. */
    settling: string;
    /** Name the shot style after release instead of just "it". */
    sendsNamed: boolean;
    /** What the next attempt is called. */
    noun: 'shot' | 'throw';
  };
  /** Optional presentation decorations on top of the equipment. */
  scoreLabels?: readonly { text: string; ring: number }[];
  cups?: {
    textures: readonly [string, string];
    /** Image origin y for the near and back lane cup drawings. */
    originY: readonly [number, number];
    width: number;
    count: number;
  };
  frontNet?: boolean;
  /** Painted court detail beyond the lane guides (ArenaEnvironment). */
  court?: { stroke: { width: number; alpha: number } } & (
    | { kind: 'ring'; x: number; y: number; width: number; height: number }
    | {
        kind: 'yard-lines';
        from: number;
        to: number;
        step: number;
        top: number;
        bottom: number;
        lean: number;
      }
    | {
        kind: 'table';
        x: number;
        y: number;
        width: number;
        height: number;
        radius: number;
      }
  );
}

export const SPORT_STAGE: Record<Sport, SportStage> = {
  cornhole: {
    equipment: 'board',
    size: { axis: 'width', px: 360 },
    anchor: ART.board.hole,
    anchorX: { origin: 980, perActor: 165 },
    surface: {
      kind: 'board',
      x0: 8,
      xSpan: 1.9,
      xHole: 1.2,
      zOffset: 0.52,
      zSpan: 1.04,
      zHole: 0.5,
      lift: 78,
    },
    art: ['board', 'bag-yellow', 'bag-teal'],
    projectile: {
      texture: 'bag-yellow',
      awayTexture: 'bag-teal',
      width: 60,
      flatten: 0.68,
    },
    shadow: { maxWidth: 330, height: 16 },
    flightSeconds: 1.25,
    flightLabel: 'BAG FLIGHT',
    paperPose: { windup: 'underarm-backswing', release: 'underarm-release' },
    impactCue: 'boardImpact',
    backLaneScale: 0.7,
    scoring: { kind: 'board' },
    previewTarget: { x: 9.0, y: boardSurfaceY(9.0) },
    narration: {
      settling: 'waits for the bag to settle.',
      sendsNamed: true,
      noun: 'throw',
    },
  },
  football: {
    equipment: 'target',
    size: { axis: 'height', px: 310 },
    anchor: ART.target.center,
    anchorX: { origin: 925, perActor: 180 },
    surface: {
      kind: 'rings',
      centerY: 2,
      inner: 0.25,
      middle: 0.58,
      innerSpan: 0.33,
      outerSpan: 0.47,
    },
    art: ['target', 'football'],
    projectile: {
      texture: 'football',
      width: 64,
      flatten: 1,
      wobble: { rate: 18, amplitude: 0.12 },
    },
    shadow: { maxWidth: 240, height: 24 },
    flightSeconds: 0.78,
    flightLabel: 'BALL FLIGHT',
    paperPose: { windup: 'football-cocked', release: 'underarm-release' },
    impactCue: 'impact',
    backLaneScale: 0.78,
    scoring: {
      kind: 'bands',
      axis: 'y',
      at: 2.0,
      bands: [
        { within: 0.25, contact: 'zone3', score: 3 },
        { within: 0.58, contact: 'zone2', score: 2 },
        { within: 1.05, contact: 'zone1', score: 1 },
      ],
      otherwise: 'miss',
    },
    aim: {
      kind: 'wall',
      sigma: 0.6,
      centre: { x: HOOP_TARGET_X, y: 2 },
      jitter: ['y'],
    },
    previewTarget: { x: HOOP_TARGET_X, y: 2.7 },
    narration: { settling: 'watches the result.', sendsNamed: false, noun: 'throw' },
    // Distance of each ring label from the target centre, as a fraction of the
    // outer ring radius (the 3 sits on the bullseye).
    scoreLabels: [
      { text: '3', ring: 0 },
      { text: '2', ring: -0.32 },
      { text: '1', ring: 0.58 },
    ],
    court: {
      stroke: { width: 1, alpha: 0.15 },
      kind: 'yard-lines',
      from: 580,
      to: 900,
      step: 100,
      top: 520,
      bottom: 655,
      lean: 25,
    },
  },
  basketball: {
    equipment: 'hoop',
    size: { axis: 'height', px: 355 },
    anchor: ART.hoop.rim,
    anchorX: { origin: 925, perActor: 180 },
    surface: {
      kind: 'hoop',
      x0: HOOP_TARGET_X,
      xScale: 110,
      zToX: 55,
      zToY: 38,
      y0: 2.9,
      yScale: 78,
    },
    art: ['hoop', 'basketball'],
    projectile: { texture: 'basketball', width: 46, flatten: 1 },
    shadow: { maxWidth: 240, height: 24 },
    flightSeconds: 1.38,
    flightLabel: 'BALL FLIGHT',
    paperPose: { windup: 'basketball-shot', release: 'basketball-shot' },
    impactCue: 'impact',
    backLaneScale: 0.78,
    scoring: {
      kind: 'bands',
      axis: 'x',
      at: HOOP_TARGET_X,
      bands: [
        { within: 0.2, contact: 'make', score: 1 },
        { within: 0.44, contact: 'rim-out', score: 0 },
      ],
      beyond: { x: 9.08, contact: 'backboard' },
      otherwise: 'airball',
    },
    aim: {
      kind: 'wall',
      sigma: 0.26,
      centre: { x: HOOP_TARGET_X, y: 2.9 },
      jitter: ['x'],
    },
    previewTarget: { x: HOOP_TARGET_X, y: 2.9 },
    narration: { settling: 'watches the result.', sendsNamed: false, noun: 'shot' },
    frontNet: true,
    court: {
      stroke: { width: 2, alpha: 0.18 },
      kind: 'ring',
      x: 935,
      y: 604,
      width: 340,
      height: 100,
    },
  },
  pong: {
    equipment: 'table',
    size: { axis: 'width', px: 300 },
    anchor: { plane: ART.table.plane, u: 0.55, v: 0.5 },
    anchorX: { origin: 925, perActor: 180 },
    surface: {
      kind: 'table',
      x0: 7.9,
      xSpan: 1.75,
      zOffset: 0.72,
      zSpan: 1.44,
      y0: 0.8,
      lift: 120,
    },
    art: ['table', 'cup-yellow', 'cup-orange', 'ping-pong'],
    projectile: { texture: 'ping-pong', width: 20, flatten: 1 },
    shadow: { maxWidth: 240, height: 24 },
    flightSeconds: 1.25,
    flightLabel: 'BALL FLIGHT',
    paperPose: { windup: 'underarm-backswing', release: 'underarm-release' },
    impactCue: 'impact',
    backLaneScale: 0.78,
    scoring: {
      kind: 'cup',
      bands: [
        { within: 0.09, contact: 'cup', score: 1 },
        { within: 0.16, contact: 'rim-out', score: 0 },
      ],
      otherwise: 'miss',
    },
    aim: { kind: 'cups', sigma: 0.1 },
    // The first cup (cupPosition(0, 0)).
    previewTarget: { x: 8.4, y: 1.05 },
    narration: { settling: 'watches the result.', sendsNamed: false, noun: 'throw' },
    cups: {
      textures: ['cup-yellow', 'cup-orange'],
      originY: [64 / 407, 66 / 422],
      width: 32,
      count: 6,
    },
    court: {
      stroke: { width: 2, alpha: 0.15 },
      kind: 'table',
      x: 660,
      y: 493,
      width: 540,
      height: 158,
      radius: 12,
    },
  },
};
/** Every equipment/projectile image the arena queues, in load order. */
export const EQUIPMENT_FILES: readonly string[] = (
  Object.values(SPORT_STAGE) as SportStage[]
).flatMap((s) => s.art);
/** Projectile texture name (without the `equipment:` prefix) for an actor. */
export const projectileTexture = (sport: Sport, actor: number) => {
  const p = SPORT_STAGE[sport].projectile;
  return actor && p.awayTexture ? p.awayTexture : p.texture;
};
