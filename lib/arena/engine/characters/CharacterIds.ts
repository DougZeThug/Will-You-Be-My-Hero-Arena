/** The two playable characters; keys per-character data tables. A keys-only
 * module so validation can use it without loading any character data. */
export const CHARACTER_IDS = ['dan', 'doug'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export function isCharacterId(id: unknown): id is CharacterId {
  return CHARACTER_IDS.includes(id as CharacterId);
}
