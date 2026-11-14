import type { ReferenceTrack } from './ReferenceMotion';
import type { CurveFrame } from '../motion/MotionCurves';
/** Retains measured root travel when available. Never fills missing detections. */
export function referenceCurves(track: ReferenceTrack): CurveFrame[] {
  const scale = Number(track.source.torsoPixels),
    origin = track.samples.find((s) => s.rootPosition)?.rootPosition;
  const frames: CurveFrame[] = [];
  for (const s of track.samples) {
    const c: CurveFrame = {
      time: s.timestamp,
      position: {},
      velocity: {},
      acceleration: {},
      chestRotation: 0,
    };
    if (!s.detected) {
      frames.push(c);
      continue;
    }
    const root =
      origin && s.rootPosition && scale > 0
        ? {
            x: (s.rootPosition.x - origin.x) / scale,
            y: (s.rootPosition.y - origin.y) / scale,
          }
        : { x: 0, y: 0 };
    for (const [name, p] of Object.entries(s.normalized))
      c.position[name] = { x: p.x + root.x, y: p.y + root.y };
    const p = c.position.pelvis,
      chest = c.position.chest;
    if (p && chest) {
      c.position.massProxy = {
        x: p.x * 0.65 + chest.x * 0.35,
        y: p.y * 0.65 + chest.y * 0.35,
      };
      c.chestRotation = Math.atan2(chest.x - p.x, p.y - chest.y);
    }
    const previous = frames.at(-1),
      dt = previous ? c.time - previous.time : 0;
    if (previous && dt > 0 && dt < 0.15)
      for (const [name, point] of Object.entries(c.position)) {
        const old = previous.position[name];
        if (!old) continue;
        c.velocity[name] = {
          x: (point.x - old.x) / dt,
          y: (point.y - old.y) / dt,
        };
        const v = previous.velocity[name];
        if (v)
          c.acceleration[name] = {
            x: (c.velocity[name].x - v.x) / dt,
            y: (c.velocity[name].y - v.y) / dt,
          };
      }
    frames.push(c);
  }
  return frames;
}
