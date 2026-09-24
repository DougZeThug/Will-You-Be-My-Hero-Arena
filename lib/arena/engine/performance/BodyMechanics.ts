import type { PerformanceProfile } from './PerformanceTypes';
import danTake from './takes/dan-underhand';
import dougTake from './takes/doug-underhand';
import { validateTake, type PerformanceTake } from './TakeValidation';
export type BodyChannel =
  | 'weightX'
  | 'compression'
  | 'hips'
  | 'lowerSpine'
  | 'upperSpine'
  | 'chest'
  | 'shoulder'
  | 'upperArm'
  | 'elbow'
  | 'palm'
  | 'counterArm'
  | 'counterElbow'
  | 'gaze'
  | 'frontFootX'
  | 'frontFootY'
  | 'backFootX'
  | 'backFootY';
export interface BodyTake {
  seconds: number;
  times: number[];
  release: number;
  /** Normalised semantic markers from the take (0–1 of `seconds`). */
  markers: Record<string, number>;
  channels: Record<BodyChannel, number[]>;
}

const TAKES: Record<string, PerformanceTake> = {
  dan: validateTake(danTake),
  doug: validateTake(dougTake),
};

/** The shipped take for a character (authored now; captured later). */
export function performanceTake(id: string): PerformanceTake {
  const take = TAKES[id];
  if (!take) throw Error(`No underhand take for ${id}`);
  return take;
}

/** Peak backward / forward world arm swing of a take, in degrees. */
export function takeSwingPeaks(take: PerformanceTake) {
  const swing = take.channels.armSwing;
  return { back: Math.max(...swing), forward: -Math.min(...swing) };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Converts a take (world arm swing + local wrist, in seconds) into the rig's
 * local channel set, applying the character profile as gains that are exactly
 * 1 at the reviewed defaults:
 * - movementTempo scales time;
 * - backswing / followThrough are the peak world swing back / forward;
 * - weightTransfer scales normalised pelvis travel (rig px);
 * - finishRetention is the fraction of the forward finish kept at the end;
 * - releaseLift adds a small forward lift around release (degrees);
 * - posture scales chest participation.
 */
export function underhandMechanics(p: PerformanceProfile): BodyTake {
  const take = performanceTake(p.id);
  const c = take.channels,
    peaks = takeSwingPeaks(take),
    backGain = p.backswing / peaks.back,
    forwardGain = p.followThrough / peaks.forward,
    times = take.times.map((t) => t / take.duration),
    m = take.markers,
    release = m.equipmentRelease,
    holdEnd = m.holdEnd;
  const holdIndex = take.times.findIndex((t) => t >= holdEnd - 1e-6);
  const swing = c.armSwing.map((v, i) => {
    // Blend the two gains through zero so the drive keeps a smooth velocity.
    const gain =
      forwardGain + (backGain - forwardGain) * smoothstep(-12, 12, v);
    let value = v * gain;
    const t = take.times[i];
    value -=
      p.releaseLift *
      Math.sin(
        Math.PI * Math.max(0, Math.min(1, (t - (release - 0.12)) / 0.36)),
      );
    return value;
  });
  if (holdIndex > 0) {
    // Re-shape the relaxation after the held finish to the profile's retention.
    const hold = swing[holdIndex],
      authoredEnd = swing.at(-1)!,
      targetEnd = -p.followThrough * p.finishRetention;
    for (let i = holdIndex + 1; i < swing.length; i++) {
      const u = authoredEnd === hold ? 1 : (swing[i] - hold) / (authoredEnd - hold);
      swing[i] = hold + u * (targetEnd - hold);
    }
  }
  const chestGain = 0.8 + p.posture * 0.3;
  const chest = c.chest.map((v) => v * chestGain);
  const torso = c.hips.map(
    (v, i) => v + c.lowerSpine[i] + c.upperSpine[i] + chest[i],
  );
  const upperArm = swing.map((v, i) => v - torso[i] - c.shoulder[i]);
  // palm is the compiler's world hand target: wrist + every parent rotation.
  const palm = c.wrist.map((w, i) => w + swing[i] + c.elbow[i]);
  return {
    seconds: take.duration / p.movementTempo,
    times,
    release: release / take.duration,
    markers: Object.fromEntries(
      Object.entries(m).map(([name, at]) => [name, at / take.duration]),
    ),
    channels: {
      weightX: c.weightX.map((v) => v * p.weightTransfer),
      compression: [...c.compression],
      hips: [...c.hips],
      lowerSpine: [...c.lowerSpine],
      upperSpine: [...c.upperSpine],
      chest,
      shoulder: [...c.shoulder],
      upperArm,
      elbow: [...c.elbow],
      palm,
      counterArm: [...c.counterArm],
      counterElbow: [...c.counterElbow],
      gaze: [...c.gaze],
      // Planted unless the take carries footwork.
      frontFootX: [...(c.frontFootX ?? c.gaze.map(() => 0))],
      frontFootY: [...(c.frontFootY ?? c.gaze.map(() => 0))],
      backFootX: [...(c.backFootX ?? c.gaze.map(() => 0))],
      backFootY: [...(c.backFootY ?? c.gaze.map(() => 0))],
    },
  };
}
