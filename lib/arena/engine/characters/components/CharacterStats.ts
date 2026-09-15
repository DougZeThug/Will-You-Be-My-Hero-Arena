import type { CharacterProfile } from '../CharacterProfile';
export interface GameplayProfile {
  core?: Record<string, number>;
  events?: Record<string, Record<string, number>>;
  abilities?: string[];
  animations?: Record<string, string>;
}
export class CharacterStats {
  constructor(private profile: CharacterProfile) {}
  core(key: string, fallback = 0.5) {
    return this.profile.gameplay?.core?.[key] ?? fallback;
  }
  event(event: string, key: string, fallback = 0.5) {
    return (
      this.profile.gameplay?.events?.[event]?.[key] ?? this.core(key, fallback)
    );
  }
}
