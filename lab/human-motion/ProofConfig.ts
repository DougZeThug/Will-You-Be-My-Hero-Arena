import { placement, boardDepthScale } from '../../lib/arena/equipment-geometry';
import type { ProofEvent } from './MotionSession';

type Point = { x: number; y: number };
export interface ProofConfig {
  /** Starting court position of each actor (Dan, then Doug). */
  placements(): Point[];
  /** Rig scale multiplier per actor index, relative to its definition. */
  actorScale(index: number): number;
  /** Foot-target stance the event gives its rigs, if any. */
  stance?: { right: number; left: number };
  /** Rigs swap between drawn angles with the facing. */
  directional: boolean;
}

const precisionPlacements = (sport: 'cornhole' | 'basketball'): Point[] => [
  { x: 250, y: 610 },
  // Match the projected throwing distance to the same depth scale
  // as the rig, board and sampled hand velocity; otherwise the far
  // lane would need invisible horizontal acceleration to reach it.
  {
    x:
      placement(sport, 1).anchor.x -
      (placement(sport, 0).anchor.x - 250) * boardDepthScale(1),
    y: 478,
  },
];
const precisionScale = (index: number) => (index ? 0.7 : 1);

/** Per-proof setup shared by MotionScene (rigs) and MotionSession (actors). */
export const proofConfig: Record<ProofEvent, ProofConfig> = {
  cornhole: {
    placements: () => precisionPlacements('cornhole'),
    actorScale: precisionScale,
    stance: { right: -140, left: 110 },
    directional: false,
  },
  basketball: {
    placements: () => precisionPlacements('basketball'),
    actorScale: precisionScale,
    stance: { right: -30, left: 35 },
    directional: false,
  },
  running: {
    placements: () => [
      { x: 210, y: 610 },
      { x: 280, y: 520 },
    ],
    actorScale: () => 0.85,
    directional: true,
  },
  fighting: {
    placements: () => [
      { x: 470, y: 610 },
      { x: 720, y: 610 },
    ],
    actorScale: () => 0.85,
    directional: true,
  },
};
