import type { PuppetPose } from '../../puppet-motion';
import { clamp01 } from '../../math';
const POSE_LAYERS = {
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
    p[key] += (overlay[key] - p[key]) * clamp01(weight);
  return p;
}
