import {
  at,
  blend,
  smooth,
  createWeightedMesh,
  type Influence,
} from '../authoring/weighted-mesh';
import { origin, joints, bonePose } from './anatomy';
const left = (y: number) => (y < 235 ? 58 : y < 285 ? 54 : 45);
// Traced shirt/skin boundary, including the wristwatch and thumb. A constant
// x cutoff incorrectly gave the swinging hand ownership of the overshirt hem.
const right = (y: number) => {
  const line = [
    [193, 203],
    [204, 198],
    [224, 202],
    [248, 206],
    [264, 212],
    [280, 217],
    [296, 217],
    [312, 206],
    [320, 204],
    [336, 200],
    [348, 204],
    [356, 207],
  ];
  for (let i = 1; i < line.length; i++)
    if (y < line[i][0]) {
      const [ya, xa] = line[i - 1],
        [yb, xb] = line[i];
      return xa + (xb - xa) * Math.max(0, Math.min(1, (y - ya) / (yb - ya)));
    }
  return line[line.length - 1][1];
};
const region = (x: number, y: number) =>
  y > 193 && y < 357
    ? x < left(y)
      ? 'L'
      : x > right(y)
        ? 'R'
        : 'body'
    : 'body';
export function influence(x: number, y: number, owner = 'body'): Influence {
  if (y < 99) return at('head');
  if (y < 133 && x > 106 && x < 176)
    return blend(at('head'), at('chest'), smooth(100, 134, y));
  let torso = at('chest');
  if (y > 238) torso = blend(at('chest'), at('spine_mid'), smooth(238, 269, y));
  if (y > 269)
    torso = blend(at('spine_mid'), at('spine_lower'), smooth(269, 305, y));
  if (y > 305)
    torso = blend(at('spine_lower'), at('pelvis'), smooth(305, 335, y));
  for (const side of ['L', 'R'] as const) {
    if (y < 124 || y > 360 || (owner === 'body' && y > 236)) continue;
    const edge = side === 'L' ? left(y) : right(y),
      outward = side === 'L' ? edge - x : x - edge;
    if (outward <= 0 && owner !== side) continue;
    let arm = blend(
      at('clavicle_' + side),
      at('upper_arm_' + side),
      smooth(130, 189, y),
    );
    arm = blend(arm, at('forearm_' + side), smooth(214, 254, y));
    arm = blend(
      arm,
      at('hand_' + side),
      smooth(side === 'L' ? 289 : 278, side === 'L' ? 316 : 305, y),
    );
    const edgeBlend =
      smooth(0, y < 194 ? 27 : 7, outward) * smooth(123, 164, y);
    const amount =
      owner === side
        ? edgeBlend + (1 - edgeBlend) * smooth(192, 224, y)
        : edgeBlend * (1 - smooth(193, 229, y));
    return blend(torso, arm, amount);
  }
  if (y > 335) {
    const side = x < 130 ? 'L' : 'R';
    let leg = blend(at('pelvis'), at('thigh_' + side), smooth(335, 391, y));
    leg = blend(leg, at('shin_' + side), smooth(413, 451, y));
    return blend(
      leg,
      at('foot_' + side),
      smooth(side === 'L' ? 505 : 529, side === 'L' ? 527 : 550, y),
    );
  }
  return torso;
}
export const createSkin = (
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
) =>
  createWeightedMesh(width, height, pixels, {
    name: 'doug_approved_body',
    origin,
    joints,
    bonePose,
    step: 4,
    region,
    influence,
  });
