/** Anatomical semantics are explicit. Imported L is Dan/Doug's anatomical RIGHT. */
export const SIDE_RIG_BONES = {
  root: 'root',
  pelvis: 'pelvis',
  spineLower: 'spine_lower',
  spineMid: 'spine_mid',
  chest: 'chest',
  neck: 'neck',
  head: 'skull_center',
  rightClavicle: 'clavicle_L',
  rightShoulder: 'upper_arm_L',
  rightElbow: 'forearm_L',
  rightWrist: 'hand_L',
  rightHand: 'throwing_hand',
  leftClavicle: 'clavicle_R',
  leftShoulder: 'upper_arm_R',
  leftElbow: 'forearm_R',
  leftWrist: 'hand_R',
  leftHand: 'off_hand',
  rightHip: 'thigh_L',
  rightKnee: 'shin_L',
  rightAnkle: 'foot_L',
  rightHeel: 'heel_L',
  rightToe: 'toe_L',
  leftHip: 'thigh_R',
  leftKnee: 'shin_R',
  leftAnkle: 'foot_R',
  leftHeel: 'heel_R',
  leftToe: 'toe_R',
} as const;
export const HUMAN_CHAINS = [
  ['head', 'neck', 'chest', 'spineMid', 'spineLower', 'pelvis'],
  [
    'neck',
    'rightClavicle',
    'rightShoulder',
    'rightElbow',
    'rightWrist',
    'rightHand',
  ],
  [
    'neck',
    'leftClavicle',
    'leftShoulder',
    'leftElbow',
    'leftWrist',
    'leftHand',
  ],
  ['pelvis', 'rightHip', 'rightKnee', 'rightAnkle', 'rightToe'],
  ['pelvis', 'leftHip', 'leftKnee', 'leftAnkle', 'leftToe'],
];
export function validateHumanRig(
  bones: string[],
  mapping: Record<string, string> = SIDE_RIG_BONES,
) {
  const missing = Object.entries(mapping)
    .filter(([, native]) => !bones.includes(native))
    .map(([semantic, native]) => ({ semantic, native }));
  return {
    valid: !missing.length,
    missing,
    available: Object.keys(mapping).filter((key) =>
      bones.includes(mapping[key]),
    ),
  };
}
