import { puppetJoints, type PuppetAsset } from '../lib/arena/puppet-geometry';
import type { PuppetPose } from '../lib/arena/puppet-motion';

export interface RigQAOptions {
  overlay: boolean;
  silhouette: boolean;
  mirror: boolean;
  view: 'current' | 'setup-plan' | 'idle-plan' | 'source-fit';
  scale: 'detail' | 'court';
}
export const DEFAULT_RIG_QA: RigQAOptions = {
  overlay: false,
  silhouette: false,
  mirror: false,
  view: 'current',
  scale: 'detail',
};
export function rigQAOptions(
  current: RigQAOptions,
  patch: Partial<RigQAOptions>,
  character: string,
): RigQAOptions {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    throw Error('Rig QA expects an options object.');
  for (const [key, value] of Object.entries(patch)) {
    if (['overlay', 'silhouette', 'mirror'].includes(key)) {
      if (typeof value !== 'boolean')
        throw Error(`Rig QA ${key} must be boolean.`);
    } else if (key === 'view') {
      if (
        !['current', 'setup-plan', 'idle-plan', 'source-fit'].includes(
          String(value),
        )
      )
        throw Error('Unknown rig QA view.');
    } else if (key === 'scale') {
      if (!['detail', 'court'].includes(String(value)))
        throw Error('Unknown rig QA scale.');
    } else throw Error(`Unknown rig QA option: ${key}`);
  }
  const next = { ...current, ...patch };
  if (next.view !== 'current' && character !== 'dan')
    throw Error(
      'Dan is the first anatomical proposal. Doug has not been reconstructed yet.',
    );
  return next;
}
/** Reports actual solver outputs. Missing anatomical controls stay missing. */
export function currentRigLandmarks(pose: PuppetPose, asset: PuppetAsset) {
  const j = puppetJoints(pose, asset);
  return {
    status: 'current-production-solver' as const,
    coordinates: 'character-local-y-down' as const,
    joints: {
      root: { x: 0, y: 0 },
      pelvis: j.hip,
      neck: j.neck,
      shoulder_L: j.shoulderL,
      elbow_L: j.leftArm.joint,
      palm_L: j.leftArm.end,
      shoulder_R: j.shoulderR,
      elbow_R: j.rightArm.joint,
      palm_R: j.rightArm.end,
      hip_L: j.leftLeg.root,
      knee_L: j.leftLeg.joint,
      ankle_L: j.leftLeg.end,
      hip_R: j.rightLeg.root,
      knee_R: j.rightLeg.joint,
      ankle_R: j.rightLeg.end,
    },
    chains: [
      ['pelvis', 'neck'],
      ['neck', 'shoulder_L', 'elbow_L', 'palm_L'],
      ['neck', 'shoulder_R', 'elbow_R', 'palm_R'],
      ['pelvis', 'hip_L', 'knee_L', 'ankle_L'],
      ['pelvis', 'hip_R', 'knee_R', 'ankle_R'],
    ],
    missingControls: [
      'clavicle_L',
      'clavicle_R',
      'spine_lower',
      'spine_mid',
      'chest rotation',
      'pelvis rotation',
      'wrist_L',
      'wrist_R',
      'support-leg load',
    ],
    balance: null,
    targets: {
      palm_L: { x: pose.handLX, y: pose.handLY },
      palm_R: { x: pose.handRX, y: pose.handRY },
      ankle_L: { x: pose.footLX, y: pose.footLY },
      ankle_R: { x: pose.footRX, y: pose.footRY },
    },
    note: 'Dots are evaluated solver joints. Neck–pelvis and neck–shoulder lines summarize one torso transform, not independent spine/clavicle bones. Arm endpoints are palms, not wrists. Ankle y=-22 is the registered ankle above the drawn sole at floor y=0. Targets are the actual requested palm/ankle coordinates before solving; they are not Spine IK bones. There is no center-of-mass model.',
  };
}
