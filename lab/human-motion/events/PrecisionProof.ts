import type { MotionEventModule } from './contracts';
import { sharedActions } from './contracts';
import type { MotionActor } from '../MotionActor';
import type { ActionPayload } from '../../../lib/arena/engine/controllers/ControllableEntity';
import type {
  MotionEvent,
  Vec2,
} from '../../../lib/arena/engine/motion/MotionTypes';
import type { ReleaseKinematics } from '../../../lib/arena/engine/equipment/AttachmentManager';
import type { EventActionMap } from '../../../lib/arena/engine/controllers/EventActionMap';
import { placement } from '../../../lib/arena/equipment-layout';
import { advanceBasketball } from '../../../lib/arena/engine/physics/BasketballFlight';
import {
  advanceBag,
  bagContact,
  type BagContact,
} from '../../../lib/arena/engine/events/cornhole/ScreenBagDynamics';
export interface ProofProjectile {
  id: number;
  owner: string;
  position: Vec2;
  velocity: Vec2;
  release: ReleaseKinematics;
  age: number;
  air: number;
  gravity: Vec2;
  landed: boolean;
  target: Vec2;
  scored: boolean;
  angle: number;
  contact?: BagContact;
}
/** Shared hand release integration, specialized event target/rules. No recording or ledger writes. */
export class PrecisionProof implements MotionEventModule {
  controls: EventActionMap;
  actors: MotionActor[] = [];
  projectiles: ProofProjectile[] = [];
  private sequence = 0;
  private seen = new Map<string, number>();
  constructor(readonly id: 'cornhole' | 'basketball') {
    this.controls = {
      id: 'human-v2-' + id,
      bufferSeconds: 0.2,
      actions: [
        ...sharedActions,
        {
          intent: 'primaryAction',
          phase: 'pressed',
          command: 'flat',
          label: id === 'cornhole' ? 'Flat throw' : 'Jump shot',
        },
        {
          intent: 'secondaryAction',
          phase: 'pressed',
          command: 'slide',
          label: 'Slide',
        },
        {
          intent: 'tertiaryAction',
          phase: 'pressed',
          command: 'roll',
          label: 'Roll',
        },
        {
          intent: 'specialAction',
          phase: 'pressed',
          command: 'airmail',
          label: 'High arc',
        },
        {
          intent: 'modifierRight',
          phase: 'pressed',
          command: 'blocker',
          label: 'Soft blocker',
        },
        {
          intent: 'charge',
          phase: 'pressed',
          command: 'charge',
          label: 'Charge',
        },
        {
          intent: 'charge',
          phase: 'released',
          command: 'release',
          label: 'Release',
        },
      ],
    };
    // This first basketball proof authors a jump shot only. Cornhole-specific
    // slide/roll controls are not advertised as different basketball mechanics.
    if (id === 'basketball')
      this.controls.actions = this.controls.actions.filter(
        (action) =>
          !['slide', 'roll', 'airmail', 'blocker'].includes(action.command),
      );
  }
  initialize(actors: MotionActor[]) {
    this.actors = actors;
    actors.forEach((a, i) => {
      a.lookTarget = { ...placement(this.id, i).anchor };
    });
  }
  can(action: string, a: MotionActor) {
    return (
      [
        'flat',
        'slide',
        'roll',
        'airmail',
        'blocker',
        'charge',
        'release',
      ].includes(action) &&
      !a.personality.busy &&
      (action === 'release' ? a.chargeStart !== null : a.canCancel())
    );
  }
  perform(action: string, p: ActionPayload, a: MotionActor) {
    if (action === 'charge') {
      a.chargeStart = Number(p.at ?? 0);
      return true;
    }
    if (action === 'release') {
      a.power = Math.max(0.25, Math.min(1, Number(p.held ?? 0.65)));
      a.chargeStart = null;
    } else a.shot = action;
    const launch = () => {
      if (!a.start(this.id === 'cornhole' ? 'throw.' + a.shot : 'shoot'))
        return false;
      {
        const state = a.planner.graph.get('action');
        // Power changes the actual authored hand speed before launch, never the detached bag.
        if (state)
          state.rate =
            1 * Math.max(0.87, Math.min(1.12, 1 + (a.power - 0.65) * 0.28));
      }
      a.equipment.attach(
        this.id === 'cornhole' ? 'bag' : 'basketball',
        this.id === 'basketball' ? 'twoHandGrip' : 'rightHand',
      );
      return true;
    };
    const equipment = this.id === 'cornhole' ? 'bag' : 'basketball';
    a.equipment.attach(equipment);
    return a.personality.begin(launch, equipment, Number(p.at ?? 0));
  }
  marker(a: MotionActor, e: MotionEvent) {
    if (e.name !== 'equipmentRelease') return;
    const release = a.equipment.release();
    if (!release) return;
    a.releaseCount++;
    a.personality.release(e.time);
    const index = this.actors.indexOf(a),
      registered = placement(this.id, index).anchor;
    const target = {
      x: registered.x + a.aimIntent.x * 42 + (a.power - 0.65) * 30,
      y: registered.y + a.aimIntent.y * 24,
    };
    const air =
      this.id === 'cornhole' ? (a.shot === 'airmail' ? 1.42 : 1.07) : 1.2;
    const gravity =
      this.id === 'cornhole'
        ? { x: 0, y: 1100 * (index === 1 ? 0.7 : 1) }
        : { x: 0, y: 1380 * (index === 1 ? 0.7 : 1) };
    a.contacts.signal('projectileRelease', e.time, 'equipment', false, release);
    this.projectiles.push({
      id: ++this.sequence,
      owner: a.id,
      position: { x: release.x, y: release.y },
      velocity: { ...release.velocity },
      release,
      age: 0,
      air,
      gravity,
      landed: false,
      target,
      scored: false,
      angle: release.angle,
      ...(this.id === 'cornhole' ? { contact: bagContact(index, a.shot) } : {}),
    });
    this.projectiles = this.projectiles.slice(-8);
  }
  update(dt: number, _time: number) {
    this.actors.forEach((a, i) => {
      const target = placement(this.id, i).anchor;
      const flying = this.projectiles.findLast(
        (p) => p.owner === a.id && !p.landed,
      );
      a.lookTarget = flying
        ? {
            x: target.x * 0.65 + flying.position.x * 0.35,
            y: target.y * 0.65 + flying.position.y * 0.35,
          }
        : { ...target };
    });
    for (const p of this.projectiles) {
      if (p.landed) continue;
      const flightStep = Math.min(
        dt,
        Math.max(0, _time - p.release.time - p.age),
      );
      if (flightStep < 1e-10) continue;
      p.age += flightStep;
      if (p.contact) {
        advanceBag(p as typeof p & { contact: BagContact }, flightStep);
        if (p.landed) {
          const a = this.actors.find((a) => a.id === p.owner)!;
          a.score +=
            p.contact.result === 'hole'
              ? 3
              : p.contact.result === 'board'
                ? 1
                : 0;
          // The follow-through/recovery owns its full body until the cancel window.
          // Reactions are requested by the normal planner when it can accept them.
          a.personality.resolve(
            p.contact.result === 'miss'
              ? 'failure'
              : p.contact.result === 'hole'
                ? 'successMedium'
                : 'successSmall',
            _time,
          );
        }
        continue;
      }
      const a = this.actors.find((a) => a.id === p.owner)!;
      const anchor = placement(this.id, this.actors.indexOf(a)).anchor;
      const result = advanceBasketball(
        p,
        flightStep,
        anchor,
        17 * (a.id === 'doug' ? 0.7 : 1),
      );
      p.angle += flightStep * 1.6;
      if (result === 'score' || result === 'miss') {
        p.landed = true;
        p.scored = result === 'score';
        if (p.scored) a.score += 2;
        a.personality.resolve(p.scored ? 'successMedium' : 'failure', _time);
      }
    }
  }
  ai(a: MotionActor, time: number) {
    const cycle = Math.floor((time - this.actors.indexOf(a) * 1.7) / 4.8);
    if (
      cycle >= 0 &&
      this.seen.get(a.id) !== cycle &&
      a.canCancel() &&
      !a.personality.busy
    ) {
      this.seen.set(a.id, cycle);
      return { primaryAction: 1 };
    }
    return {};
  }
  pause() {
    this.actors.forEach((a) => (a.chargeStart = null));
  }
  snapshot() {
    return {
      id: this.id,
      phase: 'precision-practice',
      projectiles: structuredClone(this.projectiles),
      rules:
        this.id === 'cornhole'
          ? 'Lab practice: sampled hand launch, fixed gravity, registered board contact/friction, hole 3 / board 1. Historical recordings untouched.'
          : 'Lab basketball: two-hand grip, sampled launch velocity, fixed vertical gravity and swept descending rim contact. No target homing. Historical recordings untouched.',
    };
  }
}
