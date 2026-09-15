import type { CharacterProfile } from '../CharacterProfile';
export class PersonalityComponent {
  private counts: Record<string, number> = {};
  private recent = '';
  constructor(
    readonly profile: CharacterProfile,
    private random: () => number,
  ) {}
  choose(
    channel: 'idle' | 'ritual' | 'celebration' | 'reaction' | 'entrance',
    importance = 0,
  ) {
    const fallback = {
        idle: 'idle_breathe',
        ritual: 'bag_squeeze',
        celebration: 'celebrate_nod',
        reaction: 'head_shake',
        entrance: 'enter_grounded',
      },
      pool = this.profile.pools[channel] ?? [fallback[channel]],
      turn = (this.counts[channel] = (this.counts[channel] ?? 0) + 1);
    const signature = this.profile.signatures.find(
      (s) =>
        pool.includes(s.id) &&
        turn % (s.cooldown + 1) === 0 &&
        this.random() < s.chance * (0.5 + importance),
    );
    const choices = pool.filter((id) => id !== this.recent);
    this.recent =
      signature?.id ??
      (choices.length ? choices : pool)[
        Math.floor(this.random() * (choices.length || pool.length))
      ];
    return this.recent;
  }
}
