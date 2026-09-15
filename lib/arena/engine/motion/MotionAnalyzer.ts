import type { MotionPose, MotionEvent, Vec2 } from './MotionTypes';
import { MotionCurves } from './MotionCurves';
export interface MotionWarning {
  time: number;
  joint: string;
  kind: 'teleport' | 'jerk';
  value: number;
  context?: string[];
}
/** Bounded diagnostics in world pixels/seconds. Impacts are flags for review, not auto-smoothed. */
export class MotionAnalyzer {
  private poses: MotionPose[] = [];
  private warnings: MotionWarning[] = [];
  private velocity: Record<string, Vec2> = {};
  private acceleration: Record<string, Vec2> = {};
  private impactUntil = -1;
  private impactJerkSamples = 0;
  maxStep = 0;
  maxJerk = 0;
  private curves = new MotionCurves();
  private rootVelocity = { x: 0, y: 0 };
  private maxRootAcceleration = 0;
  private restLengths = new Map<string, number>();
  private lengthErrors: Record<string, number> = {};
  curveSnapshot() {
    return this.curves.snapshot();
  }
  push(pose: MotionPose, events: MotionEvent[] = []) {
    const context = events.map((e) => e.name);
    if (context.some((n) => ['land', 'hitContact'].includes(n)))
      this.impactUntil = pose.time + 0.05;
    for (const side of ['left', 'right'])
      for (const [a, b] of [
        ['Shoulder', 'Elbow'],
        ['Elbow', 'Wrist'],
        ['Hip', 'Knee'],
        ['Knee', 'Ankle'],
      ]) {
        const p = pose.joints[side + a],
          q = pose.joints[side + b];
        if (!p || !q) continue;
        const key = side + a + '-' + b,
          length = Math.hypot(p.x - q.x, p.y - q.y);
        if (!this.restLengths.has(key)) this.restLengths.set(key, length);
        this.lengthErrors[key] = Math.max(
          this.lengthErrors[key] ?? 0,
          Math.abs(length - this.restLengths.get(key)!),
        );
      }
    const prev = this.poses.at(-1);
    if (prev && pose.time <= prev.time) {
      this.reset();
    }
    if (prev && pose.time > prev.time) {
      const dt = pose.time - prev.time;
      const rv = {
        x: (pose.root.x - prev.root.x) / dt,
        y: (pose.root.y - prev.root.y) / dt,
      };
      this.maxRootAcceleration = Math.max(
        this.maxRootAcceleration,
        Math.hypot(rv.x - this.rootVelocity.x, rv.y - this.rootVelocity.y) / dt,
      );
      this.rootVelocity = rv;
      for (const [joint, p] of Object.entries(pose.joints)) {
        const old = prev.joints[joint];
        if (!old) continue;
        const step = Math.hypot(p.x - old.x, p.y - old.y),
          v = { x: (p.x - old.x) / dt, y: (p.y - old.y) / dt };
        this.maxStep = Math.max(this.maxStep, step);
        if (step > 40 && dt < 0.025)
          this.warnings.push({
            time: pose.time,
            joint,
            kind: 'teleport',
            value: step,
            context,
          });
        const oldV = this.velocity[joint];
        if (oldV) {
          const a = { x: (v.x - oldV.x) / dt, y: (v.y - oldV.y) / dt },
            oldA = this.acceleration[joint];
          if (oldA) {
            const jerk = Math.hypot(a.x - oldA.x, a.y - oldA.y) / dt;
            this.maxJerk = Math.max(this.maxJerk, jerk);
            if (jerk > 1500000 && pose.time <= this.impactUntil)
              this.impactJerkSamples++;
            if (jerk > 1500000 && pose.time > this.impactUntil)
              this.warnings.push({
                time: pose.time,
                joint,
                kind: 'jerk',
                value: jerk,
                context,
              });
          }
          this.acceleration[joint] = a;
        }
        this.velocity[joint] = v;
      }
    }
    this.poses.push(structuredClone(pose));
    this.curves.push(pose);
    this.poses = this.poses.slice(-180);
    this.warnings = this.warnings.slice(-40);
  }
  reset() {
    this.poses = [];
    this.warnings = [];
    this.velocity = {};
    this.acceleration = {};
    this.maxStep = this.maxJerk = 0;
    this.curves = new MotionCurves();
    this.rootVelocity = { x: 0, y: 0 };
    this.maxRootAcceleration = 0;
    this.impactUntil = -1;
    this.impactJerkSamples = 0;
    this.restLengths.clear();
    this.lengthErrors = {};
  }
  snapshot(includeTrails = true) {
    return structuredClone({
      units: 'world pixels / seconds',
      sampleCount: this.poses.length,
      latest: this.poses.at(-1) ?? null,
      velocities: this.velocity,
      accelerations: this.acceleration,
      warnings: this.warnings,
      maxStep: this.maxStep,
      maxJerk: this.maxJerk,
      impactJerkSamples: this.impactJerkSamples,
      rootVelocity: this.rootVelocity,
      maxRootAcceleration: this.maxRootAcceleration,
      limbLengthError: this.lengthErrors,
      curveSampleCount: this.curves.count,
        trails: (includeTrails ? this.poses : [])
        .filter((_, i) => i % 3 === 0)
        .map((p) => ({
          time: p.time,
          pelvis: p.joints.pelvis,
          rightHand: p.joints.rightHand,
          rightShoulder: p.joints.rightShoulder,
          rightElbow: p.joints.rightElbow,
          rightWrist: p.joints.rightWrist,
          rightAnkle: p.joints.rightAnkle,
          leftAnkle: p.joints.leftAnkle,
          massProxy: p.massProxy,
        })),
    });
  }
}
