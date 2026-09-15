import type { MotionPose, Vec2 } from './MotionTypes';
export interface CurveFrame {
  time: number;
  position: Record<string, Vec2>;
  velocity: Record<string, Vec2>;
  acceleration: Record<string, Vec2>;
  chestRotation: number;
}
const keys = [
  'pelvis',
  'chest',
  'rightShoulder',
  'rightElbow',
  'rightWrist',
  'rightHand',
  'massProxy',
  'leftElbow',
  'rightKnee',
  'leftKnee',
  'rightAnkle',
  'leftAnkle',
  'root',
];
/** Full six-second trajectory window. Fixed origin/scale preserve pelvis transfer instead of zeroing it. */
export class MotionCurves {
  private frames: CurveFrame[] = [];
  private origin?: Vec2;
  private scale = 1;
  get count() {
    return this.frames.length;
  }
  push(pose: MotionPose) {
    if (!this.origin) {
      this.origin = { ...pose.joints.pelvis };
      this.scale = Math.max(
        1,
        Math.hypot(
          pose.joints.chest.x - this.origin.x,
          pose.joints.chest.y - this.origin.y,
        ),
      );
    }
    const prev = this.frames.at(-1),
      dt = prev ? pose.time - prev.time : 0;
    if (prev && dt < 1 / 61) return;
    const frame: CurveFrame = {
      time: pose.time,
      position: {},
      velocity: {},
      acceleration: {},
      chestRotation: Math.atan2(
        pose.joints.chest.x - pose.joints.pelvis.x,
        pose.joints.pelvis.y - pose.joints.chest.y,
      ),
    };
    for (const key of keys) {
      const p = key === 'massProxy' ? pose.massProxy : pose.joints[key];
      if (!p) continue;
      frame.position[key] = {
        x: (p.x - this.origin.x) / this.scale,
        y: (p.y - this.origin.y) / this.scale,
      };
      if (prev?.position[key] && dt > 0) {
        frame.velocity[key] = {
          x: (frame.position[key].x - prev.position[key].x) / dt,
          y: (frame.position[key].y - prev.position[key].y) / dt,
        };
        if (prev.velocity[key])
          frame.acceleration[key] = {
            x: (frame.velocity[key].x - prev.velocity[key].x) / dt,
            y: (frame.velocity[key].y - prev.velocity[key].y) / dt,
          };
      }
    }
    this.frames.push(frame);
    this.frames = this.frames.slice(-360);
  }
  snapshot() {
    return {
      units: 'fixed torso lengths / seconds; chest angle radians',
      scale: this.scale,
      origin: this.origin,
      samples: structuredClone(this.frames),
    };
  }
}
