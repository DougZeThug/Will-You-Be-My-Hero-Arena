import { REST, mixPuppet, type PuppetPose } from '../../../puppet-motion';
import { handFrame } from '../../../hand-geometry';
import { puppetJoints, type PuppetAsset } from '../../../puppet-geometry';
import {
  ActionTimeline,
  type ClipMarker,
} from '../../animation/AnimationEvents';
import { semanticClip } from '../../animation/LiveClips';
import { splineMotion } from '../../animation/SplineMotion';
import { blendLayer } from '../../animation/LayerMixer';
import type { CharacterProfile } from '../CharacterProfile';
/** Ground speed (px/s) at which each gait clip plays at its authored cadence. */
const GAIT_SPEEDS: Record<string, number> = {
  'locomotion.walk': 75,
  'locomotion.run': 155,
  'locomotion.sprint': 225,
  back_step: 70,
};
export class AnimationComponent {
  timeline = new ActionTimeline();
  pose: PuppetPose = { ...REST };
  private from = { ...REST };
  private blend = 1;
  private blendTime = 0.12;
  /** Accumulated locomotion phase: speed changes alter the cadence, never the
   * current leg position (phase from absolute time jumped on every change). */
  private gaitPhase = 0;
  private lastSource = '';
  private speed = 0;
  idle = 'idle_breathe';
  locomotion = '';
  headAim = 0;
  constructor(
    private profile: CharacterProfile,
    private geometry?: PuppetAsset,
  ) {}
  resolve(id: string) {
    const alias = this.profile.gameplay?.animations?.[id] ?? id;
    try {
      return semanticClip(alias);
    } catch {
      return semanticClip(id);
    }
  }
  /** Cadence multiplier for looping locomotion: cycles per authored cycle
   * that keep planted feet travelling with the ground. Non-gait loops play at
   * their authored speed. */
  gaitRate(speed = this.speed) {
    const reference = GAIT_SPEEDS[this.locomotion];
    return reference ? Math.max(0.5, Math.min(1.7, speed / reference)) : 1;
  }
  /** `duration` overrides the authored length (e.g. a jump fitted to its
   * physical airtime); markers scale with it. */
  start(id: string, duration?: number) {
    const clip = this.resolve(id);
    this.from = { ...this.pose };
    this.blend = 0;
    this.blendTime = 0.12;
    duration ??=
      clip.duration *
      (clip.category === 'throw' &&
      this.profile.gameplay?.abilities?.includes('quickRelease')
        ? 0.9
        : 1);
    this.timeline.start(
      clip.id,
      duration,
      clip.markers
        .filter((m) => !['bagFlip', 'catch'].includes(m.name))
        .map((m) => ({
          name: m.name as ClipMarker['name'],
          at: m.at * duration,
          data: m.value,
        })),
    );
  }
  cancel() {
    this.timeline.cancel();
    this.from = { ...this.pose };
    this.blend = 0;
    this.blendTime = 0.16;
  }
  sample(time: number, _speed = this.speed): PuppetPose {
    const clip = this.timeline.clip
      ? this.resolve(this.timeline.clip)
      : this.resolve(this.locomotion || this.idle);
    let pose = splineMotion(
      this.profile.overrides?.[clip.id] ?? clip.motion,
      this.timeline.clip
        ? this.timeline.progress
        : this.locomotion
          ? this.gaitPhase
          : (time / clip.duration) % 1,
      !this.timeline.clip,
    );
    if (this.timeline.active && this.locomotion) {
      const lower = this.resolve(this.locomotion);
      pose = blendLayer(
        pose,
        splineMotion(lower.motion, this.gaitPhase, true),
        'lower',
        0.8,
      );
    }
    pose.head +=
      Math.max(-6, Math.min(6, this.headAim)) + Math.sin(time * 1.5) * 0.4;
    return this.blend < 1
      ? mixPuppet(
          this.from,
          pose,
          this.blend * this.blend * (3 - 2 * this.blend),
        )
      : pose;
  }
  update(
    dt: number,
    time: number,
    speed: number,
    emit: (marker: ClipMarker) => void,
  ) {
    this.speed = speed;
    // Every change of the sampled source (action ends, start/stop moving, gait
    // or idle change) cross-fades from the pose actually on screen.
    const source = this.timeline.clip || this.locomotion || this.idle;
    if (source !== this.lastSource) {
      if (this.lastSource) {
        this.from = { ...this.pose };
        this.blend = 0;
        this.blendTime = this.timeline.clip ? 0.12 : 0.18;
      }
      this.lastSource = source;
    }
    if (this.locomotion) {
      const clip = this.resolve(this.locomotion);
      this.gaitPhase =
        (this.gaitPhase + (dt * this.gaitRate(speed)) / clip.duration) % 1;
    }
    this.blend = Math.min(1, this.blend + dt / this.blendTime);
    this.timeline.update(dt, emit);
    this.pose = this.sample(time, speed);
  }
  handAt(time: number) {
    const pose = this.sample(time);
    return this.geometry
      ? handFrame(puppetJoints(pose, this.geometry).rightArm, pose.wristR).palm
      : { x: pose.handRX, y: pose.handRY };
  }

  /** The already sampled pose and its real mesh sockets; never advances time. */
  debugSnapshot(time = 0, speed = 0) {
    const joints = this.geometry
      ? puppetJoints(this.pose, this.geometry)
      : null;
    const id = this.timeline.clip || this.locomotion || this.idle;
    const clip = this.resolve(id);
    const duration = this.timeline.clip
      ? this.timeline.duration
      : clip.duration;
    const elapsed = this.timeline.clip
      ? this.timeline.time
      : this.locomotion
        ? this.gaitPhase * duration
        : (time * this.gaitRate(speed)) % duration;
    return structuredClone({
      clip: clip.id,
      time: elapsed,
      duration,
      progress: duration ? Math.min(1, elapsed / duration) : 0,
      active: this.timeline.active,
      canCancel: this.timeline.canCancel,
      idle: this.idle,
      locomotion: this.locomotion,
      timeline: {
        clip: this.timeline.clip,
        time: this.timeline.time,
        duration: this.timeline.duration,
        progress: this.timeline.progress,
        active: this.timeline.active,
        canCancel: this.timeline.canCancel,
      },
      poseCoordinateSpace: 'character-local' as const,
      pose: this.pose,
      sockets: joints
        ? {
            coordinateSpace: 'character-local' as const,
            throwingHand: handFrame(joints.rightArm, this.pose.wristR).palm,
            offHand: handFrame(joints.leftArm, this.pose.wristL).palm,
            footL: joints.leftLeg.end,
            footR: joints.rightLeg.end,
            head: joints.neck,
            chest: { x: joints.neck.x, y: joints.neck.y + 44 },
            waist: joints.hip,
          }
        : null,
    });
  }
}
