import { registerLimbPoint } from '../../lib/arena/engine/motion/LimbRegistration.ts';
import { smooth } from '../performance/math.ts';

export const DOUG_ARM_MATERIAL_RECIPE = 'doug-arm-material-v1';
export const DOUG_ARM_MATERIAL_MARKER = 'arenaArmMaterialCorrection';

const DOUG_RIG = {
  origin: { x: 510, y: 1210 },
  shoulder: { x: 436, y: 300 },
  elbow: { x: 447, y: 464 },
  wrist: { x: 518, y: 646 },
};

/**
 * The audited Doug arm registration calculation. This module is shared by the
 * authoring generator and the legacy runtime fallback so their numbers cannot
 * drift independently.
 */
export function applyDougArmMaterial(armature) {
  if (armature[DOUG_ARM_MATERIAL_MARKER])
    throw Error('Doug arm material correction is already marked as applied');
  const mesh = armature.skin[0].slot.find((slot) => slot.name === 'arm')
    ?.display[0];
  if (!mesh?.uvs || !mesh?.vertices)
    throw Error('Arm registration requires the audited weighted mesh');
  const source = [
    { x: 925, y: 225 },
    { x: 938, y: 399 },
    { x: 1002, y: 593 },
  ];
  const weights = [];
  const upper = armature.bone.findIndex((bone) => bone.name === 'upper_arm_L');
  const lower = armature.bone.findIndex((bone) => bone.name === 'forearm_L');
  if (upper < 0 || lower < 0)
    throw Error('Arm registration requires upper_arm_L and forearm_L bones');
  for (let i = 0; i < mesh.vertices.length; i += 2) {
    const p = registerLimbPoint(
      { x: mesh.uvs[i] * 1254, y: mesh.uvs[i + 1] * 1254 },
      source,
      [DOUG_RIG.shoulder, DOUG_RIG.elbow, DOUG_RIG.wrist],
    );
    // Retain the established hidden cap taper, inside the sleeve opening.
    const axis =
      DOUG_RIG.shoulder.x +
      ((DOUG_RIG.elbow.x - DOUG_RIG.shoulder.x) * (p.y - DOUG_RIG.shoulder.y)) /
        (DOUG_RIG.elbow.y - DOUG_RIG.shoulder.y);
    const taper =
      0.5 +
      0.5 * smooth(DOUG_RIG.shoulder.y + 30, DOUG_RIG.shoulder.y + 90, p.y);
    mesh.vertices[i] = axis + (p.x - axis) * taper - DOUG_RIG.origin.x;
    mesh.vertices[i + 1] = p.y - DOUG_RIG.origin.y;
    const blend = smooth(DOUG_RIG.elbow.y - 34, DOUG_RIG.elbow.y + 34, p.y);
    if (blend <= 0) weights.push(1, upper, 1);
    else if (blend >= 1) weights.push(1, lower, 1);
    else weights.push(2, upper, 1 - blend, lower, blend);
  }
  mesh.weights = weights;
  return mesh.vertices.length / 2;
}

export function readDougArmMaterialMarker(armature) {
  const marker = armature[DOUG_ARM_MATERIAL_MARKER];
  if (marker === undefined) return undefined;
  if (
    marker?.recipe !== DOUG_ARM_MATERIAL_RECIPE ||
    !Number.isInteger(marker.correctedVertexCount) ||
    marker.correctedVertexCount <= 0
  )
    throw Error('Invalid Doug arm material correction marker');
  return marker;
}
