import { buildSkeleton, type Joint, type Vec } from '../authoring/skeleton';
export type Person = 'dan' | 'doug';
const v = (x: number, y: number): Vec => ({ x, y });
/** Landmarks are anatomical centers inside the new near-profile source.
 * L is the NEAR anatomical right arm (legacy socket naming), not screen left.
 * Both toe vectors face the board; the opposite/left foot leads the stance. */
export function anatomy(id: Person) {
  const dan = id === 'dan';
  const origin = v(510, dan ? 1227 : 1210);
  const shoulder = v(436, dan ? 315 : 300);
  const elbow = v(447, dan ? 465 : 464);
  const wrist = v(518, dan ? 645 : 646);
  const palm = v(wrist.x + 42, wrist.y - 6);
  const kneeL = dan ? v(447, 858) : v(442, 861);
  const kneeR = dan ? v(554, 863) : v(564, 856);
  const ankleL = dan ? v(379, 1158) : v(392, 1100);
  const ankleR = dan ? v(584, 1150) : v(583, 1097);
  const joints: Joint[] = [
    { name: 'root', point: origin },
    { name: 'pelvis', parent: 'root', point: v(510, 684), end: v(510, 590) },
    {
      name: 'spine_lower',
      parent: 'pelvis',
      point: v(510, 590),
      end: v(518, 495),
    },
    {
      name: 'spine_mid',
      parent: 'spine_lower',
      point: v(518, 495),
      end: v(520, 390),
    },
    {
      name: 'chest',
      parent: 'spine_mid',
      point: v(520, 390),
      end: v(493, 244),
    },
    { name: 'neck', parent: 'chest', point: v(493, 244), end: v(497, 213) },
    { name: 'head', parent: 'neck', point: v(497, 213), end: v(503, 126) },
    { name: 'skull_center', parent: 'head', point: v(503, 126) },
    { name: 'clavicle_L', parent: 'chest', point: v(489, 257), end: shoulder },
    { name: 'upper_arm_L', parent: 'clavicle_L', point: shoulder, end: elbow },
    { name: 'forearm_L', parent: 'upper_arm_L', point: elbow, end: wrist },
    {
      name: 'hand_L',
      parent: 'forearm_L',
      point: wrist,
      end: v(wrist.x + 60, wrist.y),
    },
    { name: 'throwing_hand', parent: 'hand_L', point: palm },
    {
      name: 'clavicle_R',
      parent: 'chest',
      point: v(520, 263),
      end: v(574, 320),
    },
    {
      name: 'upper_arm_R',
      parent: 'clavicle_R',
      point: v(574, 320),
      end: v(593, 482),
    },
    {
      name: 'forearm_R',
      parent: 'upper_arm_R',
      point: v(593, 482),
      end: v(619, 610),
    },
    {
      name: 'hand_R',
      parent: 'forearm_R',
      point: v(619, 610),
      end: v(626, 678),
    },
    { name: 'off_hand', parent: 'hand_R', point: v(626, 678) },
    ...(['L', 'R'] as const).flatMap((side): Joint[] => {
      const left = side === 'L',
        hip = v(left ? 470 : 553, left ? 692 : 688),
        knee = left ? kneeL : kneeR,
        ankle = left ? ankleL : ankleR;
      return [
        { name: 'thigh_' + side, parent: 'pelvis', point: hip, end: knee },
        {
          name: 'shin_' + side,
          parent: 'thigh_' + side,
          point: knee,
          end: ankle,
        },
        {
          name: 'foot_' + side,
          parent: 'shin_' + side,
          point: ankle,
          end: v(ankle.x + 80, ankle.y + 40),
        },
        {
          name: 'heel_' + side,
          parent: 'foot_' + side,
          point: v(
            left ? 334 : 548,
            dan ? (left ? 1213 : 1193) : left ? 1198 : 1170,
          ),
        },
        {
          name: 'toe_' + side,
          parent: 'foot_' + side,
          point: v(
            left ? 494 : 734,
            dan ? (left ? 1227 : 1201) : left ? 1210 : 1174,
          ),
        },
      ];
    }),
    { name: 'foot_target_L', parent: 'root', point: ankleL },
    { name: 'foot_target_R', parent: 'root', point: ankleR },
  ];
  return {
    origin,
    joints,
    shoulder,
    elbow,
    wrist,
    ...buildSkeleton(joints, origin),
  };
}
