import type { MotionEvent, Vec2 } from './MotionTypes';

export type ContactName =
  | 'leftFoot'
  | 'rightFoot'
  | 'hand'
  | 'equipment'
  | 'chest'
  | 'body';
/** Semantic interaction history. FootLock remains the authoritative world-space IK lock. */
export class MotionContacts {
  private active = new Map<
    ContactName,
    { since: number; point?: Vec2; expires?: number }
  >();
  private history: {
    name: string;
    time: number;
    contact: ContactName;
    active: boolean;
  }[] = [];
  private clock = 0;
  private landingAge = Infinity;
  private landingStrength = 0;
  signal(
    name: string,
    time: number,
    contact: ContactName,
    active: boolean,
    point?: Vec2,
  ) {
    if (active)
      this.active.set(contact, {
        since: time,
        point: point && { ...point },
        ...(contact === 'body'
          ? { expires: time + (name === 'landingContact' ? 0.45 : 0.14) }
          : {}),
      });
    else this.active.delete(contact);
    this.history.push({ name, time, contact, active });
    this.history = this.history.slice(-64);
  }
  update(dt: number, events: MotionEvent[], impactSpeed = 0) {
    this.clock = events.at(-1)?.time ?? this.clock + dt;
    this.landingAge += dt;
    for (const e of events) {
      if (e.foot && ['footPlant', 'footRelease'].includes(e.name))
        this.signal(
          `${e.foot}Foot${e.name === 'footPlant' ? 'Plant' : 'Release'}`,
          e.time,
          `${e.foot}Foot`,
          e.name === 'footPlant',
        );
      if (e.name === 'land') {
        this.landingAge = 0;
        this.landingStrength = Math.min(1, impactSpeed / 360);
        this.signal('landingContact', e.time, 'body', true);
      }
      if (e.name === 'takeoff')
        this.signal('jumpTakeoff', e.time, 'body', false);
      if (e.name.startsWith('chestTapContact'))
        this.signal(e.name, e.time, 'chest', true);
      if (e.name === 'chestTapRelease')
        this.signal(e.name, e.time, 'chest', false);
    }
    for (const [name, contact] of this.active)
      if (contact.expires !== undefined && this.clock > contact.expires)
        this.active.delete(name);
  }
  /** Impact-driven knee/hip absorption in world pixels, independent of authored clip duration. */
  get compression() {
    const t = this.landingAge / 0.085;
    return Number.isFinite(t) && t < 12
      ? 11 * this.landingStrength * t * Math.exp(1 - t)
      : 0;
  }
  snapshot() {
    return structuredClone({
      active: [...this.active].map(([contact, v]) => ({ contact, ...v })),
      history: this.history,
      landingAge: Number.isFinite(this.landingAge) ? this.landingAge : null,
      compression: this.compression,
    });
  }
}
