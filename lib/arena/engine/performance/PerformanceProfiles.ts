import type { PerformanceProfile } from './PerformanceTypes';
import type { CharacterId } from '../characters/CharacterIds';
import doug from './profiles/doug.json';
import dan from './profiles/dan.json';

import { validatePerformanceProfile } from './ProfileValidation';

export const performanceProfiles: Record<CharacterId, PerformanceProfile> = {
  doug: validatePerformanceProfile(doug),
  dan: validatePerformanceProfile(dan),
};
