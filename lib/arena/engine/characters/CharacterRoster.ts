import type { CharacterMotionSignature } from '../motion/CharacterMotionSignature';
import { motionSignatures } from '../motion/CharacterMotionSignature';
import type { MotionProfile } from '../motion/MotionTypes';
import { motionProfiles } from '../motion/MotionProfiles';
import type { PerformanceProfile } from '../performance/PerformanceTypes';
import { performanceProfiles } from '../performance/PerformanceProfiles';
import type { CharacterId } from './CharacterIds';
import type { CharacterProfile } from './CharacterProfile';
import {
  performancePersonalities,
  type PerformancePersonality,
} from './PerformancePersonality';
import { dan } from './profiles/dan';
import { doug } from './profiles/doug';
/** Everything the engine keeps per playable character, by reference to the
 * existing tables (no values live here). Kept out of CharacterRegistry so
 * resolving a profile never loads the motion and performance data. */
export interface CharacterEntry {
  /** The collectible card the character plays as. */
  cardId: string;
  /** Gameplay profile (stats, abilities, animation pools). */
  profile: CharacterProfile;
  personality: PerformancePersonality;
  signature: CharacterMotionSignature;
  motion: MotionProfile;
  performance: PerformanceProfile;
}
export const CHARACTERS: Record<CharacterId, CharacterEntry> = {
  dan: {
    cardId: dan.id,
    profile: dan,
    personality: performancePersonalities.dan,
    signature: motionSignatures.dan,
    motion: motionProfiles.dan,
    performance: performanceProfiles.dan,
  },
  doug: {
    cardId: doug.id,
    profile: doug,
    personality: performancePersonalities.doug,
    signature: motionSignatures.doug,
    motion: motionProfiles.doug,
    performance: performanceProfiles.doug,
  },
};
