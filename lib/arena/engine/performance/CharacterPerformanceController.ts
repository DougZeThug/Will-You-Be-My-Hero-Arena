import { AnimationGraph } from '../motion/AnimationGraph';
import { AttachmentManager } from '../equipment/AttachmentManager';
import { performanceActions } from './Choreography';
import { validatePerformanceProfile } from './PerformanceProfiles';
import {
  permitsActionEntry,
  permitsPerformanceTransition,
} from './PerformanceTransitions';
import type {
  CharacterAnimationRuntime,
  PerformanceAction,
  PerformanceEvent,
  PerformanceEventName,
  PerformanceProfile,
  PerformanceRequest,
  PerformanceSegment,
  PerformanceState,
  PerformanceObservation,
} from './PerformanceTypes';

export const PERFORMANCE_SUBSTEP = 1 / 120;
/** Substep ending on the next absolute 1/120 s boundary of the performance
 * clock, so hand sampling (and the release velocity fitted from it) never
 * depends on how a caller partitions its advances: step(a) then step(b)
 * reconstructs exactly what one step(a + b) does. Always positive. */
export function alignedSubstep(time: number, left: number) {
  const next =
    (Math.floor(time / PERFORMANCE_SUBSTEP + 1e-7) + 1) * PERFORMANCE_SUBSTEP;
  return Math.min(left, next - time);
}

type Pending = {
  id: number;
  definition: PerformanceAction;
  request: PerformanceRequest;
};
type Active = Pending & {
  segments: PerformanceSegment[];
  index: number;
  segmentTime: number;
  released: boolean;
  contacted?: boolean;
  result?: { success: boolean; at: number; celebrate: boolean };
  reacted: boolean;
};

/** A bounded, deterministic action clock. Runtime sampling happens before marker dispatch.
 * Callback consumers receive facts; they alone own projectile physics and scoring. */
export class CharacterPerformanceController {
  readonly graph = new AnimationGraph();
  readonly attachments = new AttachmentManager(() => this.time);
  readonly profile: PerformanceProfile;
  readonly actions: ReadonlyMap<string, PerformanceAction>;
  state: PerformanceState = 'idle';
  time = 0;
  private serial = 0;
  private active?: Active;
  private queue: Pending[] = [];
  private listeners = new Set<(event: PerformanceEvent) => void>();
  private history: PerformanceEvent[] = [];
  private destroyed = false;
  private dispatching = false;
  private observation?: PerformanceObservation;

  constructor(
    readonly runtime: CharacterAnimationRuntime,
    profile: PerformanceProfile,
    actions?: ReadonlyMap<string, PerformanceAction>,
  ) {
    this.profile = validatePerformanceProfile(profile);
    this.actions = new Map(actions ?? performanceActions(this.profile));
    for (const clip of runtime.clips.values()) {
      if (
        !Number.isFinite(clip.duration) ||
        clip.duration <= 0 ||
        clip.duration > 30
      )
        throw Error('Invalid performance clip duration: ' + clip.id);
      if (
        clip.markers.some(
          (marker) =>
            !Number.isFinite(marker.at) ||
            marker.at < 0 ||
            marker.at > clip.duration,
        )
      )
        throw Error('Invalid performance marker: ' + clip.id);
      if (
        clip.markers.filter((marker) => marker.name === 'equipmentRelease')
          .length > 1
      )
        throw Error('Performance clip releases an object twice: ' + clip.id);
    }
    this.idle();
    runtime.evaluate(this.graph, 0, 0, undefined, false);
  }
  private idle() {
    const idle = this.runtime.clips.get('idle');
    if (!idle) throw Error('Performance runtime needs an idle fallback');
    this.graph.request(idle, true);
  }
  onEvent(listener: (event: PerformanceEvent) => void) {
    if (this.destroyed) throw Error('Performance controller destroyed');
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(
    name: PerformanceEventName,
    extra: Partial<PerformanceEvent> = {},
  ) {
    const event: PerformanceEvent = {
      name,
      actionId: this.active?.id ?? 0,
      action: this.active?.definition.name ?? 'idle',
      time: this.time,
      state: this.state,
      ...extra,
    };
    this.history.push(event);
    if (this.history.length > 100) this.history.shift();
    const previousDispatch = this.dispatching;
    this.dispatching = true;
    try {
      for (const listener of this.listeners) listener(structuredClone(event));
    } finally {
      this.dispatching = previousDispatch;
    }
  }
  private enter(state: PerformanceState, entry = false) {
    if (state === this.state) return;
    const permitted = entry
      ? permitsActionEntry(
          this.state,
          state,
          this.active?.definition.preparation,
        )
      : permitsPerformanceTransition(this.state, state);
    if (!permitted)
      throw Error(`Invalid performance transition ${this.state} → ${state}`);
    this.state = state;
    this.emit('STATE_CHANGED');
    const event: Partial<Record<PerformanceState, PerformanceEventName>> = {
      anticipate: 'ANTICIPATION_STARTED',
      windup: 'WINDUP_STARTED',
      followThrough: 'FOLLOW_THROUGH_STARTED',
      celebrate: 'CELEBRATION_STARTED',
      reactPositive: 'REACTION_STARTED',
      reactNegative: 'REACTION_STARTED',
    };
    if (event[state]) this.emit(event[state]!);
  }
  perform(name: string, request: PerformanceRequest = {}): number | null {
    if (this.destroyed) return null;
    const definition = this.actions.get(name);
    if (!definition) {
      this.emit('VALIDATION_WARNING', { detail: `Unknown action: ${name}` });
      return null;
    }
    if (definition.requiresObject && !request.objectId) return null;
    if (
      request.target &&
      ![request.target.x, request.target.y].every(Number.isFinite)
    )
      return null;
    if (request.priority !== undefined && !Number.isFinite(request.priority))
      return null;
    const pending = {
      id: ++this.serial,
      definition,
      request: { ...request, target: request.target && { ...request.target } },
    };
    const priority = request.priority ?? definition.priority;
    if (this.active || this.dispatching) {
      const current = this.active;
      if (
        !this.dispatching &&
        current &&
        current.segments[current.index].interruptible &&
        priority > (current.request.priority ?? current.definition.priority)
      )
        this.cancel(current.id);
      else {
        if (request.queue === false || this.queue.length >= 8) return null;
        this.queue.push(pending);
        this.queue.sort(
          (a, b) =>
            (b.request.priority ?? b.definition.priority) -
            (a.request.priority ?? a.definition.priority),
        );
        return pending.id;
      }
    }
    this.start(pending);
    return pending.id;
  }
  private start(pending: Pending) {
    this.active = {
      ...pending,
      segments: pending.definition.segments.map((s) => ({ ...s })),
      index: 0,
      segmentTime: 0,
      released: false,
      reacted: false,
    };
    this.emit('ACTION_STARTED');
    if (pending.request.objectId) {
      this.attachments.attach(pending.request.objectId);
      this.emit('OBJECT_ATTACHED', { objectId: pending.request.objectId });
    }
    this.startSegment();
  }
  private startSegment() {
    const a = this.active!;
    const segment = a.segments[a.index];
    const source = this.runtime.clips.get(segment.clip);
    if (!source) {
      this.emit('VALIDATION_WARNING', {
        detail: `Missing clip: ${segment.clip}`,
      });
      this.finish('cancelled');
      return;
    }
    a.segmentTime = 0;
    this.graph.request({ ...source, layer: 'action', priority: 10 }, true);
    this.enter(segment.state, a.index === 0);
    // Pose/hand exposure follows attachment before the next visible frame.
    this.runtime.evaluate(
      this.graph,
      0,
      this.time,
      a.request.target,
      !!this.attachments.attached,
    );
    this.sampleAttachment();
  }
  private sampleAttachment(provisional = false) {
    if (this.attachments.attached)
      this.attachments.sample(
        { ...this.runtime.attachment('rightHand'), time: this.time },
        provisional,
      );
  }
  confirmResult(id: number, success: boolean, celebrate = success) {
    const a = this.active;
    if (
      !a ||
      a.id !== id ||
      !a.released ||
      a.result ||
      typeof success !== 'boolean'
    )
      return false;
    a.result = { success, at: this.time + this.profile.perception, celebrate };
    this.emit('RESULT_CONFIRMED', { detail: success ? 'success' : 'failure' });
    return true;
  }
  confirmContact(id: number) {
    const a = this.active;
    if (!a || a.id !== id || !a.released || a.contacted) return false;
    a.contacted = true;
    this.emit('OBJECT_CONTACT');
    return true;
  }
  lookAt(target: { x: number; y: number }) {
    if (this.active && [target.x, target.y].every(Number.isFinite))
      this.active.request.target = { ...target };
  }
  /** Context only owns the existing base layer. The action layer retains every
   * committed throw, response and contact; readiness never queues behind this. */
  observe(context: PerformanceObservation) {
    const id = {
      rest: 'idle',
      prepare: 'observePrepare',
      flight: 'observeFlight',
      acknowledge: 'observeAcknowledge',
    }[context.mode];
    const clip = this.runtime.clips.get(id);
    if (!clip) return;
    if (
      this.observation?.mode !== context.mode ||
      (context.mode !== 'rest' &&
        this.observation?.attemptId !== context.attemptId)
    ) {
      const phase = clip.loop
        ? context.elapsed / clip.duration
        : Math.min(1, context.elapsed / clip.duration);
      this.graph.request(clip, true, phase);
    }
    this.observation = structuredClone(context);
  }
  cancel(id = this.active?.id): boolean {
    if (this.dispatching) return false;
    const queued = this.queue.findIndex((a) => a.id === id);
    if (queued >= 0) {
      this.notifyComplete(this.queue.splice(queued, 1)[0].request, 'cancelled');
      return true;
    }
    if (
      !this.active ||
      this.active.id !== id ||
      !this.active.segments[this.active.index].interruptible
    )
      return false;
    this.finish('cancelled');
    return true;
  }
  private finish(outcome: 'completed' | 'cancelled') {
    const a = this.active;
    if (!a) return;
    if (outcome === 'completed' && a.definition.requiresObject && !a.released)
      this.emit('VALIDATION_WARNING', {
        detail: 'Action completed without releasing its object',
      });
    this.emit(
      outcome === 'completed' ? 'ACTION_COMPLETED' : 'ACTION_CANCELLED',
      { objectId: this.attachments.attached ?? undefined },
    );
    this.attachments.attached = null;
    this.active = undefined;
    this.graph.remove('action');
    this.enter('idle');
    this.notifyComplete(a.request, outcome);
  }
  private notifyComplete(
    request: PerformanceRequest,
    outcome: 'completed' | 'cancelled',
  ) {
    const previousDispatch = this.dispatching;
    this.dispatching = true;
    try {
      request.onComplete?.(outcome);
    } finally {
      this.dispatching = previousDispatch;
    }
  }
  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30)
      throw Error('Advance accepts 0–30 finite seconds');
    if (this.destroyed) return;
    let left = seconds;
    while (left > 1e-9) {
      if (!this.active && this.queue.length) this.start(this.queue.shift()!);
      // Substeps end on the absolute clock grid, at markers and at segment
      // boundaries regardless of the caller's cadence; a caller's own partial
      // frame is evaluated for presentation but its sample stays provisional.
      let dt = alignedSubstep(this.time, 30);
      dt = this.graph.untilNextMarker(dt);
      const a = this.active;
      if (a) {
        const segment = a.segments[a.index];
        const clipDuration = this.runtime.clips.get(segment.clip)!.duration;
        const length = segment.duration ?? clipDuration;
        if (!segment.waitForResult && length - a.segmentTime > 1e-9)
          dt = Math.min(dt, length - a.segmentTime);
        for (const phase of segment.phases ?? []) {
          const until = phase.at * clipDuration - a.segmentTime;
          if (until > 1e-9) dt = Math.min(dt, until);
        }
        if (segment.waitForResult) {
          const until = a.result ? a.result.at - this.time : 8 - a.segmentTime;
          if (until > 1e-9) dt = Math.min(dt, until);
        }
      }
      const provisional = left + 1e-9 < dt;
      dt = Math.min(dt, left);
      this.time += dt;
      const markers = this.graph.advance(dt, this.time);
      if (a) a.segmentTime += dt;
      this.runtime.evaluate(
        this.graph,
        dt,
        this.time,
        a?.request.target ?? this.observation?.target,
        !!this.attachments.attached,
      );
      this.sampleAttachment(provisional);
      for (const marker of markers) {
        if (
          marker.name === 'equipmentRelease' &&
          a &&
          marker.actionId === this.graph.get('action')?.revision &&
          !a.released
        ) {
          const release = this.attachments.release();
          if (!release) {
            this.emit('VALIDATION_WARNING', {
              detail: 'Release has no sampled attachment',
            });
            this.finish('cancelled');
            break;
          }
          a.released = true;
          this.enter('release');
          this.runtime.evaluate(
            this.graph,
            0,
            this.time,
            a.request.target,
            false,
          );
          this.emit('OBJECT_RELEASED', {
            release,
            objectId: a.request.objectId,
          });
        }
        if (
          a &&
          marker.clip === 'chestTap' &&
          marker.name.startsWith('chestTapContact')
        )
          this.emit('CELEBRATION_CONTACT');
      }
      if (this.active === a && a) this.advanceSegment(a);
      left -= dt;
    }
  }
  private advanceSegment(a: Active) {
    const s = a.segments[a.index],
      clip = this.runtime.clips.get(s.clip)!;
    const phase = s.phases?.findLast(
      (p) => p.at <= a.segmentTime / clip.duration + 1e-9,
    );
    if (phase && !(this.state === 'release' && phase.state === 'drive'))
      this.enter(phase.state);
    if (s.waitForResult) {
      if (a.result && this.time >= a.result.at && !a.reacted) {
        a.reacted = true;
        const response: PerformanceSegment[] = [
          {
            state: a.result.success ? 'reactPositive' : 'reactNegative',
            clip: a.result.success ? 'positive' : 'negative',
          },
        ];
        if (a.result.success && a.result.celebrate)
          response.push({ state: 'celebrate', clip: this.profile.celebration });
        a.segments.splice(a.index + 1, 0, ...response);
      } else if (a.segmentTime < 8) return;
      else
        this.emit('VALIDATION_WARNING', {
          detail: 'Result timeout; recovering without a celebration',
        });
    } else if (a.segmentTime + 1e-8 < (s.duration ?? clip.duration)) return;
    if (s.state === 'celebrate') this.emit('CELEBRATION_COMPLETED');
    a.index++;
    if (a.index >= a.segments.length) this.finish('completed');
    else {
      const next = a.segments[a.index];
      if (next.state === 'recover')
        next.clip =
          {
            watch: 'recoverWatch',
            positive: 'recoverPositive',
            negative: 'recoverNegative',
            nod: 'recoverRest',
            chestTap: 'recoverRest',
          }[s.clip] ?? next.clip;
      this.startSegment();
    }
  }
  snapshot() {
    return structuredClone({
      time: this.time,
      state: this.state,
      profile: this.profile,
      actionId: this.active?.id ?? null,
      action: this.active?.definition.name ?? null,
      requestedAction: this.queue[0]?.definition.name ?? null,
      requestedState: this.queue[0]?.definition.segments[0]?.state ?? null,
      interruptible:
        this.active?.segments[this.active.index]?.interruptible ?? !this.active,
      segmentTime: this.active?.segmentTime ?? 0,
      released: this.active?.released ?? false,
      observation: this.observation ?? null,
      result: this.active?.result ?? null,
      queue: this.queue.map((a) => ({ id: a.id, name: a.definition.name })),
      layers: this.graph.snapshot(),
      attachment: this.attachments.snapshot(),
      events: this.history,
      listenerCount: this.listeners.size,
    });
  }
  reset() {
    if (this.destroyed) return;
    for (const a of [...(this.active ? [this.active] : []), ...this.queue])
      this.notifyComplete(a.request, 'cancelled');
    this.active = undefined;
    this.queue = [];
    this.attachments.attached = null;
    this.graph.remove('action');
    this.graph.remove('base');
    this.runtime.reset();
    this.time = 0;
    this.state = 'idle';
    this.history = [];
    this.observation = undefined;
    this.idle();
    this.runtime.evaluate(this.graph, 0, 0, undefined, false);
  }
  destroy() {
    if (this.destroyed) return;
    this.reset();
    this.destroyed = true;
    this.listeners.clear();
    this.runtime.destroy();
  }
}
