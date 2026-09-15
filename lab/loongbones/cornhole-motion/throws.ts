import { scalarTrack, type Knot } from './curves';
export const throwStyles = [
  'flat',
  'slide',
  'airmail',
  'roll',
  'blocker',
] as const;
export type CornholeStyle = (typeof throwStyles)[number];
export const motionProfiles = {
  dan: {
    scale: 371 / 1900,
    settle: 20,
    back: 40,
    load: 46,
    drive: 53,
    release: 61,
    follow: 74,
    lower: 103,
    end: 133,
    backAngle: 12,
    reach: -42,
    shift: 4.8,
  },
  doug: {
    scale: 371 / 580,
    settle: 16,
    back: 33,
    load: 39,
    drive: 46,
    release: 55,
    follow: 67,
    lower: 91,
    end: 119,
    backAngle: 18,
    reach: -60,
    shift: 5.8,
  },
};
export function cornholeThrow(
  character: keyof typeof motionProfiles,
  style: CornholeStyle,
) {
  const p = motionProfiles[character],
    high = style === 'airmail',
    roll = style === 'roll';
  const extra = high ? 7 : style === 'blocker' ? 3 : 0;
  const release = p.release + extra,
    follow = p.follow + extra,
    duration = p.end + extra;
  const r = (name: string, points: Knot[]) => ({
    name,
    rotateFrame: scalarTrack(points, duration, 'rotate'),
  });
  const reach =
    p.reach -
    (high ? 10 : 0) +
    (style === 'blocker' ? 5 : style === 'slide' ? 3 : 0);
  const body = (amount: number, lag: number): Knot[] => [
    [0, 0],
    [p.settle + lag, -amount * 0.15],
    [p.load - 5 + lag, -amount * 0.36],
    [p.drive + lag, amount * 0.18],
    [follow - 4 + lag, amount],
    [p.lower + extra + lag, amount * 0.22],
    [duration, 0],
  ];
  // L/R in the imported files mean IMAGE side. Image L is this front-facing
  // person's anatomical RIGHT arm. Never mirror the artwork/logo to fix this.
  const bones: object[] = [
    r('pelvis', body(0.45, -3)),
    r('spine_lower', body(-0.6, -1)),
    r('spine_mid', body(-0.5, 1)),
    r('chest', body(-0.65, 3)),
    r('neck', body(0.85, 3)),
    r('head', body(0.45, 4)),
    r('clavicle_L', body(-1.3, 4)),
    r('clavicle_R', body(0.6, 3)),
    r('upper_arm_L', [
      [0, 0],
      [p.settle, 2],
      [p.back, p.backAngle],
      [p.load, p.backAngle - 0.8],
      [p.drive, 0],
      [release + 3, reach + 8],
      [follow, reach],
      [p.lower + extra, -23],
      [duration, 0],
    ]),
    r('forearm_L', [
      [0, 0],
      [p.settle, 1],
      [p.back + 2, 6],
      [p.load + 2, 7],
      [p.drive + 3, 5],
      [release + 5, high ? -4 : 1],
      [follow + 3, high ? -6 : -2],
      [p.lower + extra + 3, 3],
      [duration, 0],
    ]),
    r('hand_L', [
      [0, 0],
      [p.settle, 0],
      [p.back + 3, -4],
      [p.drive + 4, -3],
      [release + 2, roll ? -21 : high ? -9 : -6],
      [follow + 4, roll ? -26 : -11],
      [p.lower + extra + 5, -3],
      [duration, 0],
    ]),
    r('upper_arm_R', body(3.4, 1)),
    r('forearm_R', body(-3, 4)),
    r('hand_R', body(1.3, 5)),
  ];
  // Planted two-bone leg IK absorbs the pelvis shift. Translate each axis
  // independently so horizontal transfer does not force identical knee timing.
  const x: Knot[] = [
    [0, 0],
    [p.settle, -0.6 / p.scale],
    [p.load - 6, -1.6 / p.scale],
    [p.drive, 1.8 / p.scale],
    [follow - 5, p.shift / p.scale],
    [p.lower + extra, 1.2 / p.scale],
    [duration, 0],
  ];
  const y: Knot[] = [
    [0, 0],
    [p.settle, 1.1 / p.scale],
    [p.load, 1.8 / p.scale],
    [release - 2, 0.45 / p.scale],
    [follow, 1.0 / p.scale],
    [p.lower + extra, 0.4 / p.scale],
    [duration, 0],
  ];
  // Separate additive helper bones are unnecessary: translateFrame carries x/y
  // with the same horizontal transfer curve and a restrained vertical settle.
  const translateFrame = scalarTrack(x, duration, 'x').map((f, i) => ({
    ...f,
    y: y[Math.min(i, y.length - 1)][1],
  }));
  (bones[0] as Record<string, unknown>).translateFrame = translateFrame;
  const events = [
    { at: 0, name: 'grab' },
    { at: p.settle, name: 'backswing' },
    { at: p.load, name: 'load' },
    { at: p.drive, name: 'forwardSwing' },
    { at: release, name: 'bagRelease' },
    { at: follow, name: 'followThrough' },
    { at: p.lower + extra, name: 'recovery' },
    { at: duration, name: 'animationComplete' },
  ];
  return {
    name: `cornhole_throw_${style}_R_${character}`,
    duration,
    playTimes: 1,
    frame: events.map((e, i) => ({
      duration: (events[i + 1]?.at ?? duration) - e.at,
      events: [
        {
          name: e.name,
          ...(e.name === 'bagRelease' ? { bone: 'throwing_hand' } : {}),
        },
        ...(e.name === 'bagRelease'
          ? [{ name: 'release', bone: 'throwing_hand' }]
          : []),
      ],
    })),
    bone: bones,
  };
}
export function shotAlias(shot: string): CornholeStyle {
  if (['airmail', 'highArc', 'desperation', 'collect', 'drag'].includes(shot))
    return 'airmail';
  if (['roll', 'cut', 'flop', 'trick'].includes(shot)) return 'roll';
  if (['slide', 'push', 'fast'].includes(shot)) return 'slide';
  if (['blocker', 'soft'].includes(shot)) return 'blocker';
  return 'flat';
}
