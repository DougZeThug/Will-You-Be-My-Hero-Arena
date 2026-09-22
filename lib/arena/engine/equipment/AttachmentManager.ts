import type { Vec2 } from '../motion/MotionTypes';
export interface AnchorSample extends Vec2 {
  time: number;
  angle: number;
  scale?: number;
  flatten?: number;
}
export interface ReleaseKinematics extends AnchorSample {
  velocity: Vec2;
  acceleration: Vec2;
  angularVelocity: number;
  samples: number;
}
export interface EquipmentInteraction {
  name: 'grab' | 'transfer' | 'release';
  anchor: string;
  time: number;
}
export class AttachmentManager {
  constructor(
    private now: () => number = () => 0,
    private onInteraction?: (event: EquipmentInteraction) => void,
  ) {}
  private emit(name: EquipmentInteraction['name'], time = this.now()) {
    const event = { name, anchor: this.anchor, time };
    this.interactions = [...this.interactions, event].slice(-24);
    this.onInteraction?.(event);
  }
  private history: (AnchorSample & { provisional?: boolean })[] = [];
  attached: string | null = null;
  anchor = 'rightHand';
  private interactions: { name: string; anchor: string; time: number }[] = [];
  attach(id: string, anchor = 'rightHand') {
    this.attached = id;
    this.anchor = anchor;
    this.history = [];
    this.emit('grab');
  }
  sampleAnchors(
    anchors: Record<string, Omit<AnchorSample, 'time'>>,
    time: number,
  ) {
    if (!this.attached) return;
    const selected = anchors[this.anchor];
    if (!selected) throw Error('Missing equipment anchor: ' + this.anchor);
    this.sample({ ...selected, time });
  }
  transfer(anchor: string) {
    if (!this.attached)
      throw Error('Cannot transfer equipment without possession');
    this.anchor = anchor;
    this.history = [];
    this.emit('transfer');
  }
  /** A provisional sample presents the evaluated hand at a caller's partial
   * substep (a frame ending between clock boundaries). It is the current
   * sample until the next one arrives, which replaces it, so the release fit
   * only ever sees clock-grid and marker samples and cannot depend on how the
   * caller partitioned its advances. */
  sample(s: AnchorSample, provisional = false) {
    if (!this.attached) return;
    if (!Object.values(s).every(Number.isFinite))
      throw Error('Non-finite attachment sample');
    if (this.history.at(-1)?.provisional) this.history.pop();
    if (this.history.length && s.time <= this.history.at(-1)!.time) {
      if (s.time === this.history.at(-1)!.time) this.history.pop();
      else this.history = [];
    }
    this.history.push(provisional ? { ...s, provisional } : { ...s });
    this.history = this.history
      .filter((p) => s.time - p.time <= 0.085)
      .slice(-10);
  }
  current() {
    return this.history.at(-1);
  }
  release(): ReleaseKinematics | null {
    if (!this.attached || this.history.length < 2) return null;
    const last = this.history.at(-1)!,
      prev = this.history.at(-2)!,
      dt = last.time - prev.time;
    // Recent least-squares slope rejects sampling cadence noise without an unrelated launch velocity.
    const points = this.history.slice(-4),
      mean = points.reduce((s, p) => s + p.time, 0) / points.length;
    const denom = points.reduce((s, p) => s + (p.time - mean) ** 2, 0);
    const slope = (axis: 'x' | 'y') =>
      points.reduce((s, p) => s + (p.time - mean) * p[axis], 0) /
      Math.max(denom, 1e-12);
    // A linear fit describes the middle of the history window. During fast
    // release deceleration it visibly overestimates the outgoing hand speed.
    // Fit a local quadratic and evaluate its derivative at the newest sample.
    const derivative = (axis: 'x' | 'y') => {
      if (points.length < 4) return slope(axis);
      const times = points.map((p) => (p.time - last.time) / dt);
      const sum = (power: number) => times.reduce((n, t) => n + t ** power, 0);
      const matrix = [
        [sum(0), sum(1), sum(2)],
        [sum(1), sum(2), sum(3)],
        [sum(2), sum(3), sum(4)],
      ];
      const rhs = [0, 1, 2].map((power) =>
        points.reduce(
          (n, p, i) => n + times[i] ** power * (p[axis] - last[axis]),
          0,
        ),
      );
      for (let i = 0; i < 3; i++) {
        const pivot = matrix[i][i];
        if (Math.abs(pivot) < 1e-8) return slope(axis);
        for (let j = i; j < 3; j++) matrix[i][j] /= pivot;
        rhs[i] /= pivot;
        for (let k = 0; k < 3; k++)
          if (k !== i) {
            const f = matrix[k][i];
            for (let j = i; j < 3; j++) matrix[k][j] -= f * matrix[i][j];
            rhs[k] -= f * rhs[i];
          }
      }
      return rhs[1] / dt;
    };
    const velocity = { x: derivative('x'), y: derivative('y') };
    const older = this.history.at(-3),
      acceleration = { x: 0, y: 0 };
    if (older)
      for (const axis of ['x', 'y'] as const)
        acceleration[axis] =
          ((last[axis] - prev[axis]) / dt -
            (prev[axis] - older[axis]) / (prev.time - older.time)) /
          ((last.time - older.time) / 2);
    const angle = Math.atan2(
      Math.sin(last.angle - prev.angle),
      Math.cos(last.angle - prev.angle),
    );
    this.attached = null;
    this.emit('release', last.time);
    return {
      ...last,
      velocity,
      acceleration,
      angularVelocity: angle / dt,
      samples: this.history.length,
    };
  }
  snapshot() {
    return structuredClone({
      attached: this.attached,
      anchor: this.anchor,
      history: this.history,
      interactions: this.interactions,
    });
  }
}
