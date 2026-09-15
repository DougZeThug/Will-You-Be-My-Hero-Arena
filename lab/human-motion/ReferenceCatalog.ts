import type { ProofEvent } from './MotionSession';

export interface ReviewReference {
  id: string;
  label: string;
  data: string;
  video: string;
  url: string;
  alignment: 'throw' | 'gait' | 'phase';
  targetDuration: number;
  sourceRange?: [number, number];
  limits: string;
}
const tracks: Record<string, string> = {
  basketball: new URL(
    '../../motion-reference/v31/basketball.json',
    import.meta.url,
  ).href,
  'basketball-jump': new URL(
    '../../motion-reference/v31/basketball-jump.json',
    import.meta.url,
  ).href,
  boxing: new URL('../../motion-reference/v31/boxing.json', import.meta.url)
    .href,
  dodge: new URL('../../motion-reference/v31/dodge.json', import.meta.url).href,
  football: new URL('../../motion-reference/v31/football.json', import.meta.url)
    .href,
  celebration: new URL(
    '../../motion-reference/v31/celebration.json',
    import.meta.url,
  ).href,
};
const measured = (name: string) => tracks[name];
// These are local development files. A missing video is reported; no remote video
// is silently substituted and no reference media enters the production build.
const videos: Record<string, string> = {
  basketball: new URL(
    '../../work/qa/v31-reference/review/basketball.mp4',
    import.meta.url,
  ).href,
  'basketball-jump': new URL(
    '../../work/qa/v31-reference/review/basketball-jump.mp4',
    import.meta.url,
  ).href,
  boxing: new URL(
    '../../work/qa/v31-reference/review/boxing.mp4',
    import.meta.url,
  ).href,
  dodge: new URL(
    '../../work/qa/v31-reference/review/dodge.mp4',
    import.meta.url,
  ).href,
  football: new URL(
    '../../work/qa/v31-reference/review/football.mp4',
    import.meta.url,
  ).href,
  celebration: new URL(
    '../../work/qa/v31-reference/review/celebration.mp4',
    import.meta.url,
  ).href,
  running: new URL(
    '../../work/qa/v31-reference/review/running.mp4',
    import.meta.url,
  ).href,
};
const local = (name: string) => videos[name];
export const referenceCatalog: ReviewReference[] = [
  {
    id: 'cornhole',
    label: 'Cornhole · right-handed flat throw',
    data: new URL(
      '../../motion-reference/cornhole/measured.json',
      import.meta.url,
    ).href,
    video: new URL(
      '../../motion-reference/cornhole/reference.mp4',
      import.meta.url,
    ).href,
    url: 'https://www.youtube.com/watch?v=MQFTtLG3Vxo&t=330s',
    alignment: 'throw',
    targetDuration: 3,
    limits:
      'Explicit hold-shortening time warp. Far-side occlusion excluded; measured wrist is not finger motion.',
  },
  {
    id: 'running',
    label: 'Running · lateral gait',
    data: new URL(
      '../../motion-reference/running/measured.json',
      import.meta.url,
    ).href,
    video: local('running'),
    url: 'https://www.youtube.com/watch?v=j8P_GLzV_3U',
    alignment: 'gait',
    targetDuration: 0.73,
    sourceRange: [3.3, 5.733],
    limits:
      'Near-side measured gait. Far-side half-cycle is authored. Source slow-motion cadence is not calibrated real-time speed.',
  },
  {
    id: 'basketball',
    label: 'Basketball · load and takeoff',
    data: measured('basketball-jump'),
    video: local('basketball-jump'),
    url: 'https://www.youtube.com/watch?v=nDMDOZW6rPs',
    alignment: 'phase',
    targetDuration: 1.15,
    limits:
      'Phase comparison of load/rise only. Broadcast camera follows the shooter; landing is not observable. Do not infer landing or calibrated root velocity.',
  },
  {
    id: 'basketball-gather',
    label: 'Basketball · coach shooting pocket',
    data: measured('basketball'),
    video: local('basketball'),
    url: 'https://www.youtube.com/watch?v=nDMDOZW6rPs',
    alignment: 'phase',
    targetDuration: 0.75,
    limits:
      'Coach demonstrates the gather without jumping. Useful for arm sequence only, not jump height or release speed.',
  },
  {
    id: 'jab',
    label: 'Boxing · jab / cross sequence',
    data: measured('boxing'),
    video: local('boxing'),
    url: 'https://www.youtube.com/watch?v=vyTaKpylOcU',
    alignment: 'phase',
    targetDuration: 0.9,
    sourceRange: [0.25, 2.1],
    limits:
      'Coach demonstration with held poses, three-quarter projection. Compare guard/hip sequence; timing is instructional rather than competition cadence.',
  },
  {
    id: 'cross',
    label: 'Boxing · cross and front-leg support',
    data: measured('boxing'),
    video: local('boxing'),
    url: 'https://www.youtube.com/watch?v=vyTaKpylOcU',
    alignment: 'phase',
    targetDuration: 1.2,
    sourceRange: [2, 7.9],
    limits:
      'Held cross demonstrates hip turn and front support. A phase comparison, not a frame-exact retarget or force measurement.',
  },
  {
    id: 'dodge',
    label: 'Boxing · supported head slip',
    data: measured('dodge'),
    video: local('dodge'),
    url: 'https://www.youtube.com/watch?v=3lawJ1dO0Mk',
    alignment: 'phase',
    targetDuration: 0.8,
    limits:
      'Correct slip segment only; earlier deliberately wrong examples excluded. Perspective limits depth inference.',
  },
  {
    id: 'football',
    label: 'Football · shoulder / elbow / wrist',
    data: measured('football'),
    video: local('football'),
    url: 'https://www.youtube.com/watch?v=-ZE7a4MpvQw',
    alignment: 'phase',
    targetDuration: 1.6,
    limits:
      'Archive slow-motion upper-body crop. Feet are absent, camera pans, and playback cadence is uncalibrated. No lower-body or release-speed claim.',
  },
  {
    id: 'celebration',
    label: 'Celebration · chest / upward gesture',
    data: measured('celebration'),
    video: local('celebration'),
    url: 'https://www.youtube.com/watch?v=N_HmZMB8NPs',
    alignment: 'phase',
    targetDuration: 1.8,
    limits:
      'Broadcast gesture reference only. Crowd/occlusion reduce tracking confidence. No copying of identity, appearance or religious meaning.',
  },
];
export function defaultReference(event: ProofEvent) {
  return referenceCatalog.find(
    (r) => r.id === (event === 'fighting' ? 'jab' : event),
  )!;
}
