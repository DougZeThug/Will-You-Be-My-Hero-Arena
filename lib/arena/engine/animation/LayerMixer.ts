import type { PuppetPose } from '../../puppet-motion';
export const POSE_LAYERS = {
  lower: [
    'hipX',
    'hipY',
    'footLX',
    'footLY',
    'footRX',
    'footRY',
    'footL',
    'footR',
  ],
  upper: ['body', 'shrug', 'handLX', 'handLY', 'handRX', 'handRY', 'wristL', 'wristR', 'palmL', 'palmR', 'turn'],
  head: ['head'],
} as const;
export function blendLayer(
  base: PuppetPose,
  overlay: PuppetPose,
  layer: keyof typeof POSE_LAYERS,
  weight: number,
) {
  const p = { ...base };
  for (const key of POSE_LAYERS[layer])
    p[key] += (overlay[key] - p[key]) * Math.max(0, Math.min(1, weight));
  return p;
}
