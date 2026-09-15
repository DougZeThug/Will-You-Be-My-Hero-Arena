import type { AnimationCategory } from '../../../lib/arena/engine/animation/AnimationTypes';
export interface WeightedRigDefinition {
  id: string;
  armature: string;
  key: string;
  path: string;
  skeleton: string;
  atlas: string;
  texture: string;
  source: string;
  sourceOrigin: { x: number; y: number };
  layeredSource?: boolean;
  gripAngleScale?: number;
  scale: number;
  courtDepthScale?: number;
  throwClip: string;
  aliases: Record<string, string>;
  categories: Partial<Record<AnimationCategory, string>>;
  hashes: Record<string, string>;
  provenance: Record<string, unknown>;
  limitation: string;
}
