import { buildSkeleton, type Joint } from '../authoring/skeleton';
const v = (x: number, y: number) => ({ x, y });
/** Anatomical centers inside Doug's original 255×589 ready illustration.
 * Overshirt edges do not define shoulders; left/right are image sides. */
export const origin = v(129, 585);
export const joints: Joint[] = [
  { name: 'root', point: origin },
  { name: 'pelvis', parent: 'root', point: v(126, 341), end: v(126, 295) },
  {
    name: 'spine_lower',
    parent: 'pelvis',
    point: v(126, 295),
    end: v(127, 258),
  },
  {
    name: 'spine_mid',
    parent: 'spine_lower',
    point: v(127, 258),
    end: v(129, 195),
  },
  { name: 'chest', parent: 'spine_mid', point: v(129, 195), end: v(139, 116) },
  { name: 'neck', parent: 'chest', point: v(139, 116), end: v(140, 100) },
  { name: 'head', parent: 'neck', point: v(140, 100), end: v(147, 59) },
  { name: 'skull_center', parent: 'head', point: v(147, 59) },
  { name: 'clavicle_L', parent: 'chest', point: v(120, 120), end: v(48, 160) },
  {
    name: 'upper_arm_L',
    parent: 'clavicle_L',
    point: v(48, 160),
    end: v(31, 236),
  },
  {
    name: 'forearm_L',
    parent: 'upper_arm_L',
    point: v(31, 236),
    end: v(21, 308),
  },
  { name: 'hand_L', parent: 'forearm_L', point: v(21, 308), end: v(23, 332) },
  { name: 'off_hand', parent: 'hand_L', point: v(23, 332) },
  { name: 'clavicle_R', parent: 'chest', point: v(155, 123), end: v(198, 158) },
  {
    name: 'upper_arm_R',
    parent: 'clavicle_R',
    point: v(198, 158),
    end: v(217, 233),
  },
  {
    name: 'forearm_R',
    parent: 'upper_arm_R',
    point: v(217, 233),
    end: v(226, 297),
  },
  { name: 'hand_R', parent: 'forearm_R', point: v(226, 297), end: v(220, 321) },
  { name: 'throwing_hand', parent: 'hand_R', point: v(220, 321) },
  { name: 'thigh_L', parent: 'pelvis', point: v(95, 343), end: v(84, 428) },
  { name: 'shin_L', parent: 'thigh_L', point: v(84, 428), end: v(91, 522) },
  { name: 'foot_L', parent: 'shin_L', point: v(91, 522), end: v(67, 554) },
  { name: 'heel_L', parent: 'foot_L', point: v(112, 547) },
  { name: 'toe_L', parent: 'foot_L', point: v(39, 562) },
  { name: 'thigh_R', parent: 'pelvis', point: v(158, 343), end: v(184, 437) },
  { name: 'shin_R', parent: 'thigh_R', point: v(184, 437), end: v(212, 546) },
  { name: 'foot_R', parent: 'shin_R', point: v(212, 546), end: v(231, 575) },
  { name: 'heel_R', parent: 'foot_R', point: v(199, 570) },
  { name: 'toe_R', parent: 'foot_R', point: v(241, 581) },
  { name: 'foot_target_L', parent: 'root', point: v(91, 522) },
  { name: 'foot_target_R', parent: 'root', point: v(212, 546) },
];
export const { bones, bonePose } = buildSkeleton(joints, origin);
