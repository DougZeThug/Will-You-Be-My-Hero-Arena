import { REST, type Choreography, type PuppetPose } from '../../puppet-motion';
import type { Sport } from '../../model';
import type { ShotStyle } from './AnimationTypes';
import { splineMotion } from './SplineMotion';

type Pose = Partial<PuppetPose>;
const cache = new Map<string, Choreography>();
const timedCache = new Map<string, Choreography>();
export const THROW_RELEASE = .58;

export function sportRelease(sport: Sport, shot: ShotStyle = 'standard') {
  // The shooter is airborne at release, so the ball leaves above the head.
  if (sport === 'basketball') return { x: 99, y: -412 };
  if (sport === 'football') return { x: 133, y: -325 };
  if (sport === 'pong') return { x: 120, y: -282 };
  const high = ['airmail', 'highArc', 'collect', 'drag'].includes(shot);
  return { x: high ? 182 : 174, y: high ? -237 : -193 };
}

/** Sport form is shared; the actor's pace/weight-transfer remain personal.
 * These are screen-space projections of real mechanics, not a claim that a
 * single frontal drawing supplies unseen hand/finger/torso views. References
 * and reviewed limitations live in docs/review/sport-mechanics/README.md. */
export function sportThrowMotion(sport: Sport, shot: ShotStyle = 'standard', speed = .6): Choreography {
  const key = `${sport}:${shot}:${speed}`;
  const cached = cache.get(key); if (cached) return cached;
  const r = sportRelease(sport, shot), drive = 2 + speed * 3;
  let setup: Pose, load: Pose, release: Pose, follow: Pose, hold: Pose;
  // Cartoon weight transfer: load back and down, drive the hips through and
  // lean into release, hold the finish. Hands are placed in character space,
  // so release positions (and recorded contact geometry) are unchanged.
  if (sport === 'cornhole') {
    const high = r.y < -230, roll = ['roll', 'flop'].includes(shot);
    setup = { handRX: 49, handRY: -174, handLX: -35, handLY: -176, head: -4, wristR: -12, hipY: -174 };
    load = { handRX: 20 - speed * 9, handRY: -141, handLX: -41, handLY: -170, hipX: -drive * 1.6, hipY: -162, body: -6, head: -2, wristR: -23, palmR: .86 };
    release = { handRX: r.x, handRY: r.y, handLX: -61, handLY: -158, hipX: drive * 1.1, hipY: -173, body: 2.5, head: -6, wristR: roll ? -12 : -29, palmR: roll ? .88 : .68 };
    follow = { ...release, handRX: high ? 180 : 186, handRY: high ? -257 : -225, hipX: drive * 1.9, body: 9, hipY: -171, wristR: -19, palmR: .74 };
    hold = { ...follow, head: -4, body: 6 };
  } else if (sport === 'basketball') {
    // Jump shot: gather low with feet planted, leave the floor through
    // release (released on the way up, near the apex), then land with a dip.
    setup = { handRX: 35, handRY: -245, handLX: 0, handLY: -247, hipY: -160, wristR: -16, wristL: 8, head: -7 };
    load = { handRX: 80, handRY: -333, handLX: 52, handLY: -326, hipY: -157, wristR: -34, wristL: 12, body: -2, head: -8 };
    release = { handRX: r.x, handRY: r.y, handLX: 55, handLY: -345, hipY: -196, footLY: -44, footRY: -42, wristR: 46, wristL: -18, palmR: .8, head: -9 };
    follow = { ...release, handRX: 105, handRY: r.y, handLX: 30, handLY: -332, hipY: -201, footLY: -50, footRY: -47, wristR: 88, palmR: .78 };
    hold = { ...follow, handLX: -23, handLY: -225, hipY: -163, footLY: -22, footRY: -22 };
  } else if (sport === 'football') {
    setup = { handRX: 31, handRY: -249, handLX: -1, handLY: -244, head: -4, wristR: -15 };
    load = { handRX: 61, handRY: -324, handLX: -38, handLY: -232, hipX: -9, hipY: -165, body: -11, turn: .94, wristR: -24, palmR: .77 };
    release = { handRX: r.x, handRY: r.y, handLX: -26, handLY: -225, hipX: drive * 1.3, hipY: -174, body: 5, wristR: 24, palmR: .74, head: -5 };
    follow = { ...release, handRX: 111, handRY: -249, handLX: -31, handLY: -210, body: 11, hipY: -170, wristR: 51, palmR: .65 };
    hold = { ...follow, handRX: 21, handRY: -193, wristR: 18, body: 5 };
  } else {
    setup = { handRX: 58, handRY: -244, handLX: -32, handLY: -178, head: -4, wristR: -15 };
    load = { handRX: 67, handRY: -270, handLX: -32, handLY: -178, wristR: -30, palmR: .82, body: -3, hipX: -3, hipY: -168, head: -5 };
    release = { handRX: r.x, handRY: r.y, handLX: -34, handLY: -177, wristR: 20, palmR: .76, body: 4, hipX: 3, head: -5 };
    follow = { ...release, handRX: 135, handRY: -278, wristR: 49, palmR: .7, body: 5 };
    hold = { ...follow, handRX: 131, handRY: -274, wristR: 35 };
  }
  const motion: Choreography = { label: `${sport} · load, release, follow-through, recovery`, keys: [
    { at: 0, pose: REST }, { at: .18, pose: setup }, { at: .37, pose: load },
    { at: THROW_RELEASE, pose: { ...REST, ...release } }, { at: .70, pose: follow },
    { at: .80, pose: hold }, { at: 1, pose: REST },
  ] };
  cache.set(key, motion); return motion;
}

/** `holdUntil` (seconds after the throw clip starts): keep the finish held
 * — a slow, relaxing follow-through tracking the flight — until the result,
 * instead of returning to rest while the ball is still in the air. */
export function sportThrowPose(sport: Sport, shot: ShotStyle, elapsed: number, lead: number, speed: number, holdUntil?: number) {
  const held = holdUntil !== undefined, tail = held ? Math.max(.5, holdUntil - lead) : .86;
  const duration = lead + tail, key = `${sport}:${shot}:${speed}:${lead}:${held ? tail.toFixed(4) : ''}`;
  let timed = timedCache.get(key);
  if (!timed) {
    const source = sportThrowMotion(sport, shot, speed);
    const keys = held
      ? [
          ...source.keys.slice(0, 4).map(k => ({ ...k, at: k.at / THROW_RELEASE * lead / duration })),
          { ...source.keys[4], at: (lead + .16) / duration },
          { ...source.keys[5], at: (lead + Math.min(.36, tail * .45)) / duration },
          // Relaxing hold: the arm drifts down a little and the lean eases.
          { at: 1, pose: { ...source.keys[5].pose, handRY: (source.keys[5].pose.handRY ?? REST.handRY) + 12, body: (source.keys[5].pose.body ?? 0) * .6, head: (source.keys[5].pose.head ?? 0) - 2 } },
        ]
      : source.keys.map(k => ({ ...k, at: (k.at <= THROW_RELEASE ? k.at / THROW_RELEASE * lead : k.at <= .70 ? lead + (k.at - THROW_RELEASE) / .12 * .18 : k.at <= .80 ? lead + .18 + (k.at - .70) / .10 * .22 : lead + .40 + (k.at - .80) / .20 * .46) / duration }));
    timed = { ...source, keys };
    if (timedCache.size >= 128) timedCache.delete(timedCache.keys().next().value!);
    timedCache.set(key, timed);
  }
  // Fit tangents in actual seconds. A piecewise progress multiplier would
  // abruptly halve the hand velocity at release for a fast actor.
  return splineMotion(timed, Math.max(0, elapsed) / duration, false, duration);
}
