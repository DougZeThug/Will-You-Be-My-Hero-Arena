import type { PerformanceProfile } from './PerformanceTypes';
import doug from './profiles/doug.json';
import dan from './profiles/dan.json';

import { validatePerformanceProfile } from './ProfileValidation';

export const performanceProfiles: Record<'doug' | 'dan', PerformanceProfile> = {
  doug: validatePerformanceProfile(doug),
  dan: validatePerformanceProfile(dan),
};
