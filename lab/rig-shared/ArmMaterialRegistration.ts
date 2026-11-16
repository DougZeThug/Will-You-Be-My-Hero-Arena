import type { CharacterId } from '../../lib/arena/engine/characters/CharacterIds';
import { applyDougArmMaterial } from './ArmMaterialRecipe.mjs';

/** Private V3.1 bind correction. Atlas pixels, native bones and source exports stay intact. */
export function registerArmMaterial(id: CharacterId, armature: any) {
  if (id !== 'doug') return 0;
  return applyDougArmMaterial(armature);
}
