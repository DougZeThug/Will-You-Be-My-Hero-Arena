import {
  techniqueResponse as techniques,
  responseChain as chain,
} from './KineticChains';
import { DampedMotion } from './DampedMotion';
import { bodyBalance, type BalanceState } from './BodyBalance';
import {
  clamp,
  type MotionClip,
  type MotionPose,
  type MotionProfile,
  type Vec2,
} from './MotionTypes';
export interface PerformanceState {
  clip: MotionClip;
  time: number;
  rate: number;
  revision: number;
}
export interface BoneAdjustment {
  x: number;
  y: number;
  rotation: number;
}
export const PERFORMANCE_BONES = [
  'pelvis',
  'spine_lower',
  'spine_mid',
  'chest',
  'clavicle_L',
  'upper_arm_L',
  'forearm_L',
  'hand_L',
  'clavicle_R',
  'upper_arm_R',
  'forearm_R',
  'hand_R',
  'neck',
  'head',
] as const;
const rad = Math.PI / 180;

function curve(keys: [number, number][], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys.at(-1)![0]) return keys.at(-1)![1];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [a, av] = keys[i],
    [b, bv] = keys[i + 1],
    h = b - a;
  const slope = (n: number) => {
    if (n === 0 || n === keys.length - 1) return 0;
    const s1 = (keys[n][1] - keys[n - 1][1]) / (keys[n][0] - keys[n - 1][0]);
    const s2 = (keys[n + 1][1] - keys[n][1]) / (keys[n + 1][0] - keys[n][0]);
    return s1 * s2 <= 0 ? 0 : (2 * s1 * s2) / (s1 + s2);
  };
  const u = (t - a) / h,
    u2 = u * u,
    u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * av +
    (u3 - 2 * u2 + u) * slope(i) * h +
    (-2 * u3 + 3 * u2) * bv +
    (u3 - u2) * slope(i + 1) * h
  );
}
function driveAt(s: PerformanceState, t: number) {
  const c = s.clip,
    technique = c.technique;
  if (!technique) return 0;
  if (technique === 'stride') return Math.sin((t / c.duration) * Math.PI * 2);
  if (technique === 'impact')
    return t < 0 ? 0 : Math.exp(-t / 0.2) * Math.sin(t * 18);
  const release =
    c.markers.find((m) =>
      ['equipmentRelease', 'hitboxOn', 'takeoff', 'dodgeOn'].includes(m.name),
    )?.at ?? c.duration * 0.4;
  const peak = Math.max(0.08, release - 0.07);
  return curve(
    [
      [0, 0],
      [peak * 0.47, techniques[technique].load],
      [peak, 0.82],
      [release + 0.1, 1],
      [Math.max(release + 0.16, c.duration * 0.73), 0.35],
      [c.duration, 0],
    ],
    t,
  );
}

/** Bounded performance over authored motion. No limb lengths, skin weights or game results change. */
export class OrganicMotion {
  private channels = new Map<string, DampedMotion>();
  private previousState?: PerformanceState;
  private gaze = new DampedMotion();
  private impact = new DampedMotion();
  private balance?: BalanceState;
  private output: Record<string, BoneAdjustment> = {};
  private propagation: {
    bone: string;
    delay: number;
    value: number;
    velocity: number;
  }[] = [];
  private driver = 0;
  private gazeTarget = 0;
  private lastImpulse = 0;
  constructor(readonly profile: MotionProfile) {}
  impulse(strength: number) {
    this.lastImpulse = clamp(strength, -1, 1);
    this.impact.impulse(this.lastImpulse * 3);
  }
  measure(pose: MotionPose, grounded: boolean, contacts: string[]) {
    this.balance = bodyBalance(pose, grounded, contacts);
  }
  private follow(
    name: string,
    target: number,
    dt: number,
    settle: number,
    damping = 1,
  ) {
    if (!this.channels.has(name)) this.channels.set(name, new DampedMotion());
    return this.channels.get(name)!.update(target, dt, settle, damping);
  }
  update(input: {
    state?: PerformanceState;
    pose: MotionPose;
    dt: number;
    time: number;
    grounded: boolean;
    contacts: string[];
    velocity: Vec2;
    acceleration: Vec2;
    /** World-to-character horizontal projection. Balance observations remain world-space. */
    facing?: number;
    aim: Vec2;
    target?: Vec2;
    recoverySeconds: number;
  }) {
    const { dt, state, pose, time } = input,
      p = {
        ...this.profile.performance,
        looseness: this.profile.signature.looseness,
        gestureEnergy: this.profile.signature.gestureEnergy,
        recoverySpeed: this.profile.signature.recoverySpeed,
      };
    const technique = state?.clip.technique,
      cfg = technique ? techniques[technique] : undefined;
    const authoredGain = state?.clip.performanceGain ?? 1;
    const energy =
      (cfg?.energy ?? 0) * (0.65 + p.gestureEnergy * 0.55) * authoredGain;
    const raw = state ? driveAt(state, state.time) : 0;
    this.driver = raw * energy;
    this.balance = bodyBalance(pose, input.grounded, input.contacts);
    const out: Record<string, BoneAdjustment> = Object.fromEntries(
      PERFORMANCE_BONES.map((b) => [b, { x: 0, y: 0, rotation: 0 }]),
    );
    this.propagation = [];
    for (const [bone, lag, degrees] of chain) {
      const delay = lag * (cfg?.delay ?? 1) * (0.75 + p.looseness * 0.7);
      const wanted = state ? driveAt(state, state.time - delay) * energy : 0;
      const sign = ['upper_arm_L', 'forearm_L', 'hand_L'].includes(bone)
        ? (cfg?.arm ?? 1)
        : 1;
      const v = this.follow(
        bone,
        wanted,
        dt,
        cfg ? 0.065 + lag * 0.25 : input.recoverySeconds,
        0.84 + p.postureStability * 0.1,
      );
      out[bone].rotation = clamp(v * degrees * rad * sign, -0.12, 0.12);
      this.propagation.push({
        bone,
        delay,
        value: v,
        velocity: this.channels.get(bone)!.velocity,
      });
    }
    // Compression shifts hips against stationary ankle IK. Knees solve the actual new reach.
    const activeGround = input.grounded && technique !== 'stride';
    const supportCorrection = clamp(
      (clamp(
        this.balance.projection,
        this.balance.supportMin + 5,
        this.balance.supportMax - 5,
      ) -
        this.balance.projection) *
        0.5,
      -3,
      3,
    );
    const translateX = activeGround
      ? raw * energy * 14 + supportCorrection * (input.facing ?? 1)
      : 0;
    const compression = activeGround
      ? Math.max(0, -raw) * (cfg?.compression ?? 0) * authoredGain
      : 0;
    out.pelvis.x = this.follow(
      'weightTransfer',
      translateX,
      dt,
      0.16 / p.recoverySpeed,
    );
    out.pelvis.y = this.follow(
      'groundLoad',
      compression,
      dt,
      0.12 / p.recoverySpeed,
    );
    // The opposite shoulder balances both the chain and measured acceleration, then settles alone.
    const balanceArm =
      -this.driver * 3.2 * rad -
      clamp(
        input.acceleration.x * (input.facing ?? 1) * 0.000018,
        -0.018,
        0.018,
      );
    out.upper_arm_R.rotation = this.follow(
      'counterArm',
      balanceArm,
      dt,
      0.24 + p.looseness * 0.08,
      0.86,
    );
    out.forearm_R.rotation = this.follow(
      'counterElbow',
      -balanceArm * 0.6,
      dt,
      0.29,
      0.9,
    );
    out.hand_R.rotation = this.follow(
      'counterWrist',
      balanceArm * 0.22,
      dt,
      0.33,
    );
    // Quiet coherent breathing, not random independent bone noise. Personality phases never resync.
    const quiet =
      (technique ? 0.2 : 1) *
      (0.65 + this.profile.signature.idleActivity * 0.5);
    const breath = Math.sin((time / p.breathPeriod) * Math.PI * 2 + p.phase);
    const drift = Math.sin(time * 0.73 + p.phase * 1.8);
    out.chest.rotation += breath * 0.0025 * quiet;
    out.pelvis.y += breath * 0.65 * quiet;
    out.pelvis.x += drift * (1.5 - p.postureStability) * quiet;
    out.hand_R.rotation += Math.sin(time * 1.1 + p.phase) * 0.006 * quiet;
    // Target tracking competes with body stabilization; never instant-lock a head to an aim axis.
    const target = input.target ?? {
      x: pose.joints.head.x + 550,
      y: pose.joints.head.y + input.aim.y * 100,
    };
    this.gazeTarget = clamp(
      Math.atan2(
        target.y - pose.joints.head.y,
        Math.max(80, Math.abs(target.x - pose.joints.head.x)),
      ) * 0.12,
      -this.profile.gazeLimit,
      this.profile.gazeLimit,
    );
    const bodyPitch =
      out.pelvis.rotation +
      out.spine_lower.rotation +
      out.spine_mid.rotation +
      out.chest.rotation;
    out.head.rotation = this.gaze.update(
      this.gazeTarget - bodyPitch * 0.7,
      dt,
      0.24 + p.looseness * 0.08,
    );
    // Impulses are visual responses only. The motor still owns world knockback and landing.
    const impulse = clamp(this.impact.update(0, dt, 0.34, 0.82), -0.16, 0.16);
    out.chest.rotation += impulse * 0.22;
    out.head.rotation -= impulse * 0.1;
    if (input.grounded) out.pelvis.y += Math.abs(impulse) * 28;
    // Reach adaptation is angular and bounded; no mesh scaling or limb stretching.
    if (
      state &&
      ['underhand', 'overhead', 'strike'].includes(technique ?? '')
    ) {
      const shoulder = pose.joints.rightShoulder;
      const targetPitch = input.target
        ? Math.atan2(
            input.target.y - shoulder.y,
            Math.max(80, Math.abs(input.target.x - shoulder.x)),
          )
        : 0;
      out.clavicle_L.rotation +=
        clamp(input.aim.y * 0.018 + targetPitch * 0.035, -0.025, 0.025) *
        Math.min(1, Math.abs(raw));
      out.spine_mid.rotation +=
        clamp(input.aim.x * 0.012, -0.012, 0.012) * Math.min(1, Math.abs(raw));
    }
    this.previousState = state && { ...state };
    this.output = out;
    return out;
  }
  snapshot() {
    return structuredClone({
      enabled: true,
      driver: this.driver,
      technique: this.previousState?.clip.technique ?? 'idle',
      balance: this.balance,
      propagation: this.propagation,
      adjustments: this.output,
      gazeTarget: this.gazeTarget,
      gazeVelocity: this.gaze.velocity,
      signature: this.profile.signature,
      lastImpulse: this.lastImpulse,
      independentClothBones: false,
      handSurfaces: 'opaque registered grip / open / relaxed; no finger rig',
    });
  }
}
