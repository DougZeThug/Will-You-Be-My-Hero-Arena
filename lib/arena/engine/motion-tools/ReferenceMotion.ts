import type { Vec2 } from '../motion/MotionTypes';
export interface ReferenceSample {
  timestamp: number;
  detected: boolean;
  normalized: Record<string, Vec2 & { confidence?: number }>;
  rootPosition?: Vec2;
  angles?: Record<string, number>;
  velocity?: Record<string, Vec2>;
  acceleration?: Record<string, Vec2>;
}
export interface ReferenceTrack {
  schema: 'arena-motion-reference-v1';
  source: Record<string, unknown>;
  samples: ReferenceSample[];
  warnings: string[];
}
export function importReference(data: unknown): ReferenceTrack {
  const d = data as ReferenceTrack;
  if (
    !d ||
    d.schema !== 'arena-motion-reference-v1' ||
    !Array.isArray(d.samples) ||
    !d.samples.length ||
    d.samples.length > 36000
  )
    throw Error('Expected a bounded Arena motion-reference export');
  let last = -Infinity;
  for (const s of d.samples) {
    if (
      !Number.isFinite(s.timestamp) ||
      s.timestamp <= last ||
      !s.normalized ||
      Object.keys(s.normalized).length > 50
    )
      throw Error('Invalid reference timeline');
    last = s.timestamp;
    for (const p of Object.values(s.normalized))
      if (
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > 50 ||
        Math.abs(p.y) > 50
      )
        throw Error('Invalid normalized landmark');
  }
  if (!Array.isArray(d.warnings))
    throw Error('Missing reference quality report');
  return structuredClone(d);
}
/** Retarget angles into the target's lengths. This is a review proposal, never automatic production animation. */
export function retargetReference(
  sample: ReferenceSample,
  target: Record<string, Vec2>,
  amplitude = 0.85,
) {
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 1.25)
    throw Error('Retarget amplitude must be 0–1.25');
  const result: Record<string, Vec2> = { ...structuredClone(target) };
  for (const side of ['right', 'left'])
    for (const [a, b] of [
      ['Shoulder', 'Elbow'],
      ['Elbow', 'Wrist'],
      ['Hip', 'Knee'],
      ['Knee', 'Ankle'],
    ]) {
      const parent = side + a,
        child = side + b,
        p = sample.normalized[parent],
        q = sample.normalized[child],
        ta = target[parent],
        tb = target[child];
      if (
        !p ||
        !q ||
        !ta ||
        !tb ||
        (p.confidence ?? 1) < 0.6 ||
        (q.confidence ?? 1) < 0.6
      )
        continue;
      const base = Math.atan2(tb.y - ta.y, tb.x - ta.x),
        ref = Math.atan2(q.y - p.y, q.x - p.x),
        difference = Math.atan2(Math.sin(ref - base), Math.cos(ref - base));
      const angle = base + difference * amplitude,
        len = Math.hypot(tb.x - ta.x, tb.y - ta.y),
        origin = result[parent];
      result[child] = {
        x: origin.x + Math.cos(angle) * len,
        y: origin.y + Math.sin(angle) * len,
      };
    }
  return {
    kind: 'retarget-review-proposal',
    joints: result,
    requiresAuthorReview: true,
    notes: [
      'Target bone lengths preserved. Camera perspective and occluded joints require review. No artwork or runtime rig was changed.',
    ],
  };
}
/** Portable, timed authoring proposal. Source gaps remain gaps; no live rig mutation. */
export function retargetMotion(
  track: ReferenceTrack,
  target: Record<string, Vec2>,
  options: {
    speed?: number;
    amplitude?: number;
    markers?: { name: string; at: number }[];
  } = {},
) {
  const source = importReference(track),
    speed = options.speed ?? 1;
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 2)
    throw Error('Retarget speed must be .25–2');
  const start = source.samples[0].timestamp;
  const duration = (source.samples.at(-1)!.timestamp - start) / speed;
  const markers = (options.markers ?? []).map((marker) => {
    if (
      !marker.name ||
      !Number.isFinite(marker.at) ||
      marker.at < start ||
      marker.at > source.samples.at(-1)!.timestamp
    )
      throw Error('Retarget marker outside source timeline');
    return { ...marker, at: (marker.at - start) / speed };
  });
  return {
    schema: 'arena-retarget-proposal-v1',
    source: source.source,
    duration,
    markers,
    samples: source.samples.map((sample) => ({
      time: (sample.timestamp - start) / speed,
      detected: sample.detected,
      joints: sample.detected
        ? retargetReference(sample, target, options.amplitude ?? 0.85).joints
        : null,
    })),
    requiresAuthorReview: true,
    productionInstalled: false,
    warnings: [
      ...source.warnings,
      'Normalized angles and target proportions; camera perspective, occlusions and contacts require author review.',
    ],
  };
}
