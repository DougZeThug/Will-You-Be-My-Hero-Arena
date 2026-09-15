import type { Vec2 } from '../motion/MotionTypes';
export class FootLock {
  private contacts = new Map<
    string,
    { point: Vec2; influence: number; maxSlide: number; duration: number }
  >();
  plant(side: string, point: Vec2, influence = 1) {
    if (!this.contacts.has(side))
      this.contacts.set(side, {
        point: { ...point },
        influence,
        maxSlide: 0,
        duration: 0,
      });
  }
  release(side: string) {
    this.contacts.delete(side);
  }
  setInfluence(side: string, influence: number) {
    const c = this.contacts.get(side);
    if (c) c.influence = Math.max(0, Math.min(1, influence));
  }
  clear() {
    this.contacts.clear();
  }
  target(side: string) {
    const c = this.contacts.get(side);
    return c ? { ...c.point, influence: c.influence } : undefined;
  }
  measure(side: string, point: Vec2, dt = 1 / 120) {
    const c = this.contacts.get(side);
    if (c) c.duration += dt;
    if (c && c.influence >= 0.999)
      c.maxSlide = Math.max(
        c.maxSlide,
        Math.hypot(c.point.x - point.x, c.point.y - point.y),
      );
  }
  snapshot() {
    return [...this.contacts].map(([foot, c]) => ({
      foot,
      ...structuredClone(c),
      warning: c.maxSlide > 2 ? 'foot slide exceeds 2px' : null,
    }));
  }
}
