import {
  createWeightedMesh,
  at,
  blend,
  smooth,
  type Influence,
} from '../authoring/weighted-mesh';
import type { Vec } from '../authoring/skeleton';
import { anatomy, type Person } from './anatomy';
export type Rect = [number, number, number, number];
/** Source atlas stays intact. Each layer owns a cropped UV region, registered
 * into a common anatomical bind space BEFORE inverse-bind weights are parsed. */
export function layer(
  id: Person,
  name: string,
  pixels: Uint8ClampedArray,
  rect: Rect,
  map: (p: Vec) => Vec,
  influence: (p: Vec, owner: string) => Influence,
  step = 7,
  boundary?: Vec[],
  cutouts?: Vec[][],
  materials?: { name: string; boundary: Vec[] }[],
) {
  const rig = anatomy(id),
    [rx, ry, rw, rh] = rect;
  const mask = new Uint8ClampedArray(pixels.length);
  for (let y = ry; y < ry + rh; y++)
    for (let x = rx; x < rx + rw; x++)
      mask[(y * 1254 + x) * 4 + 3] = pixels[(y * 1254 + x) * 4 + 3];
  const mesh = createWeightedMesh(1254, 1254, mask, {
    name,
    ...rig,
    step,
    region: () => name,
    influence: (x, y, owner) => influence(map({ x, y }), owner),
    boundary,
    cutouts,
    materials,
  });
  const vertices = mesh.display.vertices;
  for (let i = 0; i < vertices.length; i += 2) {
    const p = map({
      x: vertices[i] + rig.origin.x,
      y: vertices[i + 1] + rig.origin.y,
    });
    vertices[i] = p.x - rig.origin.x;
    vertices[i + 1] = p.y - rig.origin.y;
  }
  mesh.display.path = 'sheet';
  return mesh;
}
export function bodyWeights(id: Person, p: Vec, owner?: string): Influence {
  const { x, y } = p;
  if (owner === 'far_arm') {
    const arm = blend(at('upper_arm_R'), at('forearm_R'), smooth(455, 510, y));
    const hand = blend(arm, at('hand_R'), smooth(592, 627, y));
    return blend(at('chest'), hand, smooth(445, 505, y));
  }
  if (y < 208) return at('head');
  if (y < 266) return blend(at('head'), at('chest'), smooth(208, 266, y));
  // The visible far hand is a separate material region; never let it pull cloth.
  if (!owner && x > (id === 'dan' ? 590 : 588) && y > 490 && y < 726)
    return blend(at('forearm_R'), at('hand_R'), smooth(592, 627, y));
  if (y < 380) return at('chest');
  if (y < 505) return blend(at('chest'), at('spine_mid'), smooth(390, 505, y));
  if (y < 605) return blend(at('spine_mid'), at('pelvis'), smooth(505, 605, y));
  if (y < 766) return at('pelvis');
  // Leg ownership follows the shorts split and projected inner-leg boundary.
  const divider = y < 910 ? 518 : 493;
  const side =
    owner === 'leg_L' ? 'L' : owner === 'leg_R' ? 'R' : x < divider ? 'L' : 'R';
  const ankle = anatomy(id).joints.find((j) => j.name === 'foot_' + side)!.point
    .y;
  if (y > ankle + 8) return at('foot_' + side);
  if (y > ankle - 40)
    return blend(
      at('shin_' + side),
      at('foot_' + side),
      smooth(ankle - 40, ankle + 8, y),
    );
  if (y > 900) return at('shin_' + side);
  if (y > 820)
    return blend(at('thigh_' + side), at('shin_' + side), smooth(820, 900, y));
  return blend(at('pelvis'), at('thigh_' + side), smooth(766, 815, y));
}
