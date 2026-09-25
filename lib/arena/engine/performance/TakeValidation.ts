/** Shipped performance take contract: `arena-performance-take-v1`.
 *
 * One file per character and technique. Authored takes and future motion
 * capture both land here; see ./takes/README.md for the mapping.
 */
export const TAKE_CHANNELS = [
  'weightX',
  'compression',
  'hips',
  'lowerSpine',
  'upperSpine',
  'chest',
  'shoulder',
  'armSwing',
  'elbow',
  'wrist',
  'counterArm',
  'counterElbow',
  'gaze',
] as const;
/** Optional footwork (rig px offsets of the planted IK targets from their
 * stance). Absent = planted. Captured steps, hops and heel-to-toe transfer
 * arrive here; the adapter then checks feet against their moving targets. */
export const TAKE_FOOT_CHANNELS = [
  'frontFootX',
  'frontFootY',
  'backFootX',
  'backFootY',
] as const;
export type TakeChannel = (typeof TAKE_CHANNELS)[number];
export type TakeFootChannel = (typeof TAKE_FOOT_CHANNELS)[number];
export const TAKE_MARKERS = [
  'anticipate',
  'windup',
  'windupPeak',
  'equipmentRelease',
  'finish',
  'holdEnd',
] as const;
export type TakeMarker = (typeof TAKE_MARKERS)[number];
export interface PerformanceTake {
  schema: 'arena-performance-take-v1';
  id: string;
  character: string;
  technique: 'underhand';
  provenance: {
    kind: 'authored' | 'retargeted' | 'captured';
    source: string;
    notes?: string;
  };
  /** Human-readable unit notes carried with the data. */
  units?: Record<string, string>;
  duration: number;
  markers: Record<TakeMarker, number>;
  times: number[];
  channels: Record<TakeChannel, number[]> &
    Partial<Record<TakeFootChannel, number[]>>;
}
/** Authored pre-overlap hand intent. The compiler adds wrist and chest overlap
 * to bake the hand_L local rotation and enforces the native hand_L limit per
 * frame; this [-35, 95] bound is a channel sanity check, not the baked-bone
 * limit. */
export const TAKE_WRIST_LIMITS = [-35, 95] as const;
const FRAME = 1 / 60;

export function validateTake(input: unknown): PerformanceTake {
  const t = input as PerformanceTake;
  const fail = (message: string): never => {
    throw Error(`Invalid performance take ${t?.id ?? '?'}: ${message}`);
  };
  if (!t || typeof t !== 'object') fail('not an object');
  if (t.schema !== 'arena-performance-take-v1') fail('unknown schema');
  if (typeof t.id !== 'string' || typeof t.character !== 'string')
    fail('missing id or character');
  if (t.technique !== 'underhand') fail('unsupported technique');
  if (
    !t.provenance ||
    !['authored', 'retargeted', 'captured'].includes(t.provenance.kind) ||
    typeof t.provenance.source !== 'string'
  )
    fail('provenance must declare kind and source');
  if (!Number.isFinite(t.duration) || t.duration < 0.5 || t.duration > 6)
    fail('duration must be 0.5–6 s');
  const onFrame = (s: number) => Math.abs(s / FRAME - Math.round(s / FRAME)) < 1e-3;
  if (
    !Array.isArray(t.times) ||
    t.times.length < 4 ||
    t.times[0] !== 0 ||
    Math.abs(t.times.at(-1)! - t.duration) > 1e-6
  )
    fail('times must start at 0 and end at duration');
  for (let i = 0; i < t.times.length; i++) {
    if (!Number.isFinite(t.times[i]) || !onFrame(t.times[i]))
      fail(`time ${t.times[i]} is not on a 60 Hz frame`);
    if (i && t.times[i] - t.times[i - 1] < FRAME - 1e-6)
      fail('times must increase by at least one frame');
  }
  for (const name of TAKE_CHANNELS) {
    const values = t.channels?.[name];
    if (!Array.isArray(values) || values.length !== t.times.length)
      fail(`channel ${name} must match the time grid`);
    if (!values.every(Number.isFinite)) fail(`channel ${name} is not finite`);
  }
  for (const name of TAKE_FOOT_CHANNELS) {
    const values = t.channels[name];
    if (values === undefined) continue;
    if (!Array.isArray(values) || values.length !== t.times.length)
      fail(`foot channel ${name} must match the time grid`);
    if (!values.every(Number.isFinite)) fail(`foot channel ${name} is not finite`);
  }
  for (const w of t.channels.wrist)
    if (w < TAKE_WRIST_LIMITS[0] || w > TAKE_WRIST_LIMITS[1])
      fail(`wrist ${w} outside native hand limits`);
  let previous = 0;
  for (const name of TAKE_MARKERS) {
    const at = t.markers?.[name];
    if (!Number.isFinite(at) || at < previous || at > t.duration)
      fail(`marker ${name} must be ordered within the take`);
    previous = at;
  }
  if (!onFrame(t.markers.equipmentRelease))
    fail('release must land on a 60 Hz frame');
  return t;
}
