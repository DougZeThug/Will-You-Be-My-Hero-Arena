import type { MotionClip, MotionEvent, MotionLayer } from './MotionTypes';
export interface GraphState {
  clip: MotionClip;
  time: number;
  rate: number;
  revision: number;
  completed: boolean;
  started: boolean;
}
const order: Record<MotionLayer, number> = {
  base: 0,
  action: 1,
  gaze: 2,
  personality: 3,
  reaction: 4,
};
/** One clock and typed marker crossings. Native rendering consumes states; it never owns rules. */
export class AnimationGraph {
  private states = new Map<MotionLayer, GraphState>();
  revision = 0;
  request(clip: MotionClip, force = false, phase?: number) {
    const current = this.states.get(clip.layer);
    if (
      current &&
      !current.completed &&
      !force &&
      current.clip.id !== clip.id &&
      current.clip.priority >= clip.priority &&
      !this.canInterrupt(current)
    )
      return false;
    if (current?.clip.id === clip.id && !current.completed) {
      if (clip.loop || clip.layer === 'base' || clip.layer === 'personality')
        return true;
      if (!force && !this.canInterrupt(current)) return false;
      // A repeated command inside a cancel window starts a fresh action;
      // otherwise its buffered input would disappear without performing it.
    }
    if (clip.layer === 'reaction') this.states.delete('action');
    this.states.set(clip.layer, {
      clip,
      time: phase === undefined ? 0 : phase * clip.duration,
      rate: 1,
      revision: ++this.revision,
      completed: false,
      started: false,
    });
    return true;
  }
  get(layer: MotionLayer) {
    return this.states.get(layer);
  }
  remove(layer: MotionLayer) {
    this.states.delete(layer);
  }
  canInterrupt(
    state = this.states.get('reaction') ?? this.states.get('action'),
  ) {
    return (
      !state ||
      state.completed ||
      !!state.clip.cancel?.some(([a, b]) => state.time >= a && state.time <= b)
    );
  }
  active() {
    return [...this.states.values()].sort(
      (a, b) => order[a.clip.layer] - order[b.clip.layer],
    );
  }
  advance(dt: number, time: number): MotionEvent[] {
    if (!Number.isFinite(dt) || dt < 0)
      throw Error('Animation time must advance; seek by reset/replay');
    const events: MotionEvent[] = [];
    for (const state of this.active()) {
      if (state.completed) continue;
      const from = state.time,
        to = from + dt * state.rate,
        duration = state.clip.duration;
      for (
        let cycle = Math.max(0, Math.floor(from / duration));
        cycle <= Math.floor((to + 1e-10) / duration);
        cycle++
      ) {
        if (!state.clip.loop && cycle > 0) break;
        for (const [markerIndex, marker] of state.clip.markers.entries()) {
          const at = cycle * duration + marker.at;
          if (
            (at > from + 1e-10 || (!state.started && at === 0 && from === 0)) &&
            at <= to + 1e-10
          )
            events.push({
              ...marker,
              actionId: state.revision,
              eventId: `${state.revision}:${cycle}:${markerIndex}`,
              clip: state.clip.id,
              cycle,
              time: time - (to - at) / state.rate,
            });
        }
      }
      state.time = state.clip.loop ? to : Math.min(to, duration);
      state.started = true;
      if (!state.clip.loop && to >= duration - 1e-10) {
        state.completed = true;
        events.push({
          name: 'motionComplete',
          actionId: state.revision,
          eventId: `${state.revision}:complete`,
          at: duration,
          clip: state.clip.id,
          cycle: 0,
          time,
        });
      }
    }
    return events.sort((a, b) => a.time - b.time);
  }
  /** End a presentation interval exactly at a marker before reading sockets. */
  untilNextMarker(maximum: number) {
    let next = maximum;
    for (const s of this.active()) {
      if (s.completed || s.rate <= 0) continue;
      const completion = (s.clip.duration - s.time) / s.rate;
      if (!s.clip.loop && completion > 1e-9) next = Math.min(next, completion);
      const cycle = Math.floor(s.time / s.clip.duration);
      for (const loop of [cycle, cycle + 1]) {
        if (!s.clip.loop && loop > 0) continue;
        for (const m of s.clip.markers) {
          const delta = (loop * s.clip.duration + m.at - s.time) / s.rate;
          if (delta > 1e-9) next = Math.min(next, delta);
        }
      }
    }
    return next;
  }
  phase(
    state = this.states.get('reaction') ??
      this.states.get('action') ??
      this.states.get('base'),
  ) {
    if (!state) return 'settle';
    const t = state.clip.loop
      ? Math.max(0, state.time) % state.clip.duration
      : state.time;
    return state.clip.phases.filter((p) => p.at <= t).at(-1)?.phase ?? 'settle';
  }
  snapshot() {
    return this.active().map((s) => ({
      id: s.clip.id,
      native: s.clip.native,
      layer: s.clip.layer,
      time: s.time,
      duration: s.clip.duration,
      phase: this.phase(s),
      rate: s.rate,
      revision: s.revision,
      completed: s.completed,
      canInterrupt: this.canInterrupt(s),
    }));
  }
}
