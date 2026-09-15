import { registerLimbPoint } from '../../lib/arena/engine/motion/LimbRegistration';
import { anatomy } from '../loongbones/side-rig/anatomy';
import { smooth } from '../loongbones/authoring/weighted-mesh';

/** Private V3.1 bind correction. Atlas pixels, native bones and source exports stay intact. */
export function registerArmMaterial(id: string, armature: any) {
  if (id !== 'doug') return 0;
  const rig = anatomy(id);
  const mesh = armature.skin[0].slot.find(
    (s: { name: string }) => s.name === 'arm',
  )?.display[0];
  if (!mesh?.uvs || !mesh?.vertices)
    throw Error('Arm registration requires the audited weighted mesh');
  const source = [
    { x: 925, y: 225 },
    { x: 938, y: 399 },
    { x: 1002, y: 593 },
  ] as const;
  const weights: number[] = [];
  const upper = armature.bone.findIndex(
    (b: { name: string }) => b.name === 'upper_arm_L',
  );
  const lower = armature.bone.findIndex(
    (b: { name: string }) => b.name === 'forearm_L',
  );
  for (let i = 0; i < mesh.vertices.length; i += 2) {
    const p = registerLimbPoint(
      { x: mesh.uvs[i] * 1254, y: mesh.uvs[i + 1] * 1254 },
      source,
      [rig.shoulder, rig.elbow, rig.wrist],
    );
    // Retain the established hidden cap taper, inside the sleeve opening.
    const axis =
      rig.shoulder.x +
      ((rig.elbow.x - rig.shoulder.x) * (p.y - rig.shoulder.y)) /
        (rig.elbow.y - rig.shoulder.y);
    const taper =
      0.5 + 0.5 * smooth(rig.shoulder.y + 30, rig.shoulder.y + 90, p.y);
    mesh.vertices[i] = axis + (p.x - axis) * taper - rig.origin.x;
    mesh.vertices[i + 1] = p.y - rig.origin.y;
    const blend = smooth(rig.elbow.y - 34, rig.elbow.y + 34, p.y);
    if (blend <= 0) weights.push(1, upper, 1);
    else if (blend >= 1) weights.push(1, lower, 1);
    else weights.push(2, upper, 1 - blend, lower, blend);
  }
  mesh.weights = weights;
  return mesh.vertices.length / 2;
}
