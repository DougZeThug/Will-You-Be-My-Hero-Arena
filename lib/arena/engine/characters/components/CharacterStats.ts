import type { CharacterProfile } from '../CharacterProfile';
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
