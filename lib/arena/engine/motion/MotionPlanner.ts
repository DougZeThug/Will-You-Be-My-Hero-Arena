import { AnimationGraph } from './AnimationGraph';
import { clamp, type MotionClip, type MotionProfile } from './MotionTypes';
import type { CharacterMotor } from '../movement/CharacterMotor';
import { matchRecovery, type RecoveryPose } from './RecoveryMatcher';
import { sampleRoot } from './RootCurve';
import { matchStride, type StrideFit } from './StrideMatcher';
import { GaitResponse } from './GaitResponse';
export class MotionPlanner {
  readonly graph = new AnimationGraph();
  readonly gaitResponse = new GaitResponse();
  readonly clips: Map<string, MotionClip>;
  strideFit?: StrideFit;
  idle = 'idle';
  /** Event-selected authored locomotion variants; input and motor remain universal. */
  locomotionVariants: Record<string, string> = {};
  recovery = matchRecovery({
    handHeight: 0,
    chestPitch: 0,
    speed: 0,
    footPhase: 0,
  });
  observePose(pose: RecoveryPose) {
    this.recovery = matchRecovery(pose, this.profile.performance.recoverySpeed);
  }
  constructor(
    clips: MotionClip[],
    readonly profile: MotionProfile,
    /** Display scale; Play updates it when a runner changes lane depth. */
    public displayScale = 1,
  ) {
    this.clips = new Map(clips.map((c) => [c.id, c]));
    for (const c of clips)
      if (
        !(c.duration > 0) ||
        c.markers.some((m) => m.at < 0 || m.at > c.duration)
      )
        throw Error('Invalid motion metadata: ' + c.id);
    this.request('idle');
  }
  request(action: string, force = false) {
    const clip = this.clips.get(action);
    if (!clip) return false;
    return this.graph.request(clip, force);
  }
  locomotion(motor: CharacterMotor) {
    const speed = Math.hypot(motor.velocity.x, motor.velocity.y);
    const action = this.graph.get('action'),
      reaction = this.graph.get('reaction');
    for (const layer of ['action', 'reaction', 'personality'] as const)
      if (this.graph.get(layer)?.completed) this.graph.remove(layer);
    if ((action && !action.completed) || (reaction && !reaction.completed))
      return;
    this.strideFit = matchStride(
      speed,
      [...this.clips.values()],
      this.displayScale * this.profile.strideScale,
      this.graph.get('base')?.clip.id,
    );
    let id = motor.grounded
      ? speed < 3
        ? this.idle
        : (this.strideFit?.clip ?? 'walk')
      : 'airborne';
    if (motor.turning && motor.grounded) id = 'pivot';
    id = this.locomotionVariants[id] ?? id;
    const incoming = this.clips.get(id),
      previous = this.graph.get('base');
    if (!incoming) return;
    if (previous?.clip.id !== id)
      this.graph.request(
        incoming,
        true,
        previous?.clip.stride && incoming.stride
          ? (previous.time / previous.clip.duration) % 1
          : 0,
      );
    const state = this.graph.get('base')!;
    if (incoming.stride && this.strideFit) state.rate = this.strideFit.rate;
  }
  rootDelta(dt: number) {
    const state = this.graph.get('reaction') ?? this.graph.get('action');
    if (!state?.clip.root || state.completed) return { x: 0, y: 0 };
    const sample = (t: number) => {
      const points = state.clip.root!;
      if (state.clip.rootInterpolation === 'continuous')
        return sampleRoot(points, t);
      let a = points[0],
        b = points.at(-1)!;
      for (let i = 1; i < points.length; i++)
        if (t <= points[i].at) {
          a = points[i - 1];
          b = points[i];
          break;
        }
      const u = clamp((t - a.at) / Math.max(0.00001, b.at - a.at), 0, 1),
        s = u * u * (3 - 2 * u);
      return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
    };
    const from = sample(Math.max(0, state.time)),
      to = sample(state.time + dt * state.rate);
    return { x: to.x - from.x, y: to.y - from.y };
  }
}
