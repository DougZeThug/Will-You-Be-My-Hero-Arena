import type {
  AnatomicalJoint,
  LandmarkPose,
  Point,
} from '../../lib/arena/engine/characters/anatomy/AnatomyPlan';

/** The user's 2026-09-12 full-body illustration is the proportion authority.
 * ImageGen cleaned its background; the renderer applies uniform scale only.
 * Landmarks register the authored drawing. They do not deform or animate it. */
export const DAN_SOURCE = {
  revision: 2,
  key: 'lab:dan-connected-source',
  width: 808,
  height: 1947,
  url: new URL('../assets/dan-source/full-body-v2.png', import.meta.url).href,
  sourcePath: 'lab/assets/dan-source/full-body-v2.png',
  proportionReference: 'lab/assets/dan-source/proportion-reference.png',
  // Crown -> front sole = 1,900 source pixels -> 371 arena pixels.
  scale: 371 / 1900,
  origin: { x: 404, y: 1918 },
} as const;

export function sourceToLocal(p: Point): Point {
  return {
    x: (p.x - DAN_SOURCE.origin.x) * DAN_SOURCE.scale,
    y: (p.y - DAN_SOURCE.origin.y) * DAN_SOURCE.scale,
  };
}

// Manually registered anatomical centers in the actual full-body source.
// The far foot sits slightly higher in this three-quarter ground projection.
// Preserve that authored perspective instead of stretching its shin to y=0.
const source: Record<AnatomicalJoint, [number, number]> = {
  root: [404, 1918],
  pelvis: [407, 1080],
  spine_lower: [394, 927],
  spine_mid: [391, 791],
  chest: [390, 650],
  neck: [391, 398],
  head: [389, 194],
  crown: [400, 18],
  clavicle_L: [332, 418],
  shoulder_L: [170, 493],
  elbow_L: [150, 778],
  wrist_L: [157, 1000],
  hand_L: [175, 1090],
  clavicle_R: [441, 425],
  shoulder_R: [557, 515],
  elbow_R: [593, 785],
  wrist_R: [660, 1000],
  hand_R: [670, 1090],
  hip_L: [313, 1085],
  knee_L: [296, 1338],
  ankle_L: [280, 1770],
  heel_L: [254, 1915],
  toe_L: [334, 1915],
  hip_R: [477, 1080],
  knee_R: [551, 1350],
  ankle_R: [512, 1740],
  heel_R: [466, 1847],
  toe_R: [716, 1868],
};

export const DAN_FITTED_POSE = Object.fromEntries(
  Object.entries(source).map(([joint, [x, y]]) => [
    joint,
    sourceToLocal({ x, y }),
  ]),
) as LandmarkPose;
