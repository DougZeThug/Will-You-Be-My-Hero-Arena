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
export class AnimationComponent {
  timeline = new ActionTimeline();
  pose: PuppetPose = { ...REST };
  private from = { ...REST };
  private blend = 1;
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
  start(id: string) {
    const clip = this.resolve(id);
    this.from = { ...this.pose };
    this.blend = 0;
    const duration =
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
  }
  sample(time: number, speed = 0): PuppetPose {
    const clip = this.timeline.clip
        ? this.resolve(this.timeline.clip)
        : this.resolve(this.locomotion || this.idle),
      rate = this.locomotion
        ? Math.max(
            0.8,
            Math.min(
              1.22,
              speed /
                (this.locomotion === 'locomotion.sprint'
                  ? 225
                  : this.locomotion === 'locomotion.run'
                    ? 155
                    : 75),
            ),
          )
        : 1;
    let pose = splineMotion(
      this.profile.overrides?.[clip.id] ?? clip.motion,
      this.timeline.clip
        ? this.timeline.progress
        : ((time * rate) / clip.duration) % 1,
      !this.timeline.clip,
    );
    if (this.timeline.active && this.locomotion) {
      const lower = this.resolve(this.locomotion);
      pose = blendLayer(
        pose,
        splineMotion(lower.motion, ((time * rate) / lower.duration) % 1, true),
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
    this.blend = Math.min(1, this.blend + dt / 0.12);
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
    const rate = this.locomotion
      ? Math.max(
          0.8,
          Math.min(
            1.22,
            speed /
              (this.locomotion === 'locomotion.sprint'
                ? 225
                : this.locomotion === 'locomotion.run'
                  ? 155
                  : 75),
          ),
        )
      : 1;
    const duration = this.timeline.clip
      ? this.timeline.duration
      : clip.duration;
    const elapsed = this.timeline.clip
      ? this.timeline.time
      : (time * rate) % duration;
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
