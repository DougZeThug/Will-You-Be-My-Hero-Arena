export const DOUG_ARM_MATERIAL_RECIPE: 'doug-arm-material-v1';
export const DOUG_ARM_MATERIAL_MARKER: 'arenaArmMaterialCorrection';
export interface DougArmMaterialMarker {
  recipe: typeof DOUG_ARM_MATERIAL_RECIPE;
  correctedVertexCount: number;
}
export function applyDougArmMaterial(armature: any): number;
export function readDougArmMaterialMarker(
  armature: any,
): DougArmMaterialMarker | undefined;
