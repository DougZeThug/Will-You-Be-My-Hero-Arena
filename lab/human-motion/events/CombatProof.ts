import type { MotionEventModule } from './contracts';
import { sharedActions } from './contracts';
import type { MotionActor } from '../MotionActor';
import type { ActionPayload } from '../../../lib/arena/engine/controllers/ControllableEntity';
import type { MotionEvent } from '../../../lib/arena/engine/motion/MotionTypes';
import type { EventActionMap } from '../../../lib/arena/engine/controllers/EventActionMap';
import { CombatIntentRhythm } from '../../../lib/arena/engine/motion/CombatIntentRhythm';
export class CombatProof implements MotionEventModule {
  id = 'fighting';
  actors: MotionActor[] = [];
  hits: {
    time: number;
    attacker: string;
    target: string;
    blocked: boolean;
    damage: number;
  }[] = [];
  private hitRevisions = new Set<string>();
  private rhythms = new Map<string, CombatIntentRhythm>();
  private contacts: {
    id: string;
    time: number;
    attacker: string;
    target?: string;
    outcome: 'hit' | 'block' | 'miss';
    direction: { x: number; y: number };
    /** Applied damage normalized to the existing 18-damage heavy hit. Misses are zero. */
    intensity: number;
  }[] = [];
  private readonly spacing = {
    collisionRange: 98,
    grappleRange: 108,
    neutralRange: 144,
    desiredRange: 126,
    jabReach: 99,
    heavyReach: 119,
    targetRadius: 28,
  };
  controls: EventActionMap = {
    id: 'human-v2-fighting',
    bufferSeconds: 0.25,
    actions: [
      ...sharedActions,
      {
        intent: 'primaryAction',
        phase: 'pressed',
        command: 'jab',
        label: 'Jab',
      },
      {
        intent: 'secondaryAction',
        phase: 'pressed',
        command: 'heavy',
        label: 'Heavy',
      },
      {
        intent: 'tertiaryAction',
        phase: 'pressed',
        command: 'dodge',
        label: 'Dodge',
      },
      {
        intent: 'modifierLeft',
        phase: 'pressed',
        command: 'block',
        label: 'Block',
      },
      {
        intent: 'modifierLeft',
        phase: 'released',
        command: 'unblock',
        label: 'Release block',
      },
    ],
    combos: [
      {
        id: 'one-two-heavy',
        sequence: ['primaryAction', 'primaryAction', 'secondaryAction'],
        window: 1,
        command: 'heavy',
      },
    ],
  };
  initialize(actors: MotionActor[]) {
    this.actors = actors;
    actors[1].motor.facing = actors[1].motor.facingTarget = -1;
    actors.forEach((a) => {
      this.rhythms.set(
        a.id,
        new CombatIntentRhythm(
          a.id === 'doug' ? 7041 : 1702,
          a.id === 'doug' ? 0.24 : 0.63,
        ),
      );
      a.motor.steerFacing = false;
      a.planner.idle = 'combatNeutral';
      a.planner.locomotionVariants = Object.fromEntries(
        ['walk', 'jog', 'run', 'sprint'].map((id) => [id, 'combat.' + id]),
      );
      a.planner.request('combatNeutral', true);
    });
  }
  can(action: string, a: MotionActor) {
    return (
      action === 'unblock' ||
      (['jab', 'heavy', 'dodge', 'block'].includes(action) &&
        a.canCancel() &&
        a.stamina > 8)
    );
  }
  perform(action: string, _p: ActionPayload, a: MotionActor) {
    if (action === 'unblock') {
      a.blocking = false;
      if (a.planner.graph.get('action')?.clip.id === 'block')
        a.planner.graph.remove('action');
      return true;
    }
    if (!a.start(action)) return false;
    a.blocking = action === 'block';
    a.stamina = Math.max(0, a.stamina - (action === 'heavy' ? 16 : 8));
    return true;
  }
  marker(a: MotionActor, e: MotionEvent) {
    if (e.name !== 'hitboxOff') return;
    const prefix = a.id + ':' + e.actionId + ':';
    if (![...this.hitRevisions].some((k) => k.startsWith(prefix))) {
      const id = prefix + 'miss';
      if (!this.contacts.some((c) => c.id === id))
        this.contacts.push({
          id,
          time: e.time,
          attacker: a.id,
          target: this.actors.find((b) => b !== a)?.id,
          outcome: 'miss',
          direction: { x: a.motor.facing, y: 0 },
          intensity: 0,
        });
    }
    this.contacts = this.contacts.slice(-60);
  }
  update(dt: number, time: number) {
    for (const a of this.actors) {
      const opponent = this.actors.find((b) => b !== a);
      if (opponent) {
        a.lookTarget = opponent.animator.joint('chest');
        if (a.canCancel())
          a.motor.facing = a.motor.facingTarget =
            Math.sign(opponent.motor.position.x - a.motor.position.x) ||
            a.motor.facing;
      }
      a.stamina = Math.min(100, a.stamina + 7 * dt);
      if (!a.hitbox) continue;
      const action = a.planner.graph.get('action');
      if (!action) continue;
      for (const b of this.actors) {
        if (a === b || b.health <= 0 || b.dodging) continue;
        const key = a.id + ':' + action.revision + ':' + b.id;
        if (this.hitRevisions.has(key)) continue;
        const dx = b.motor.position.x - a.motor.position.x,
          dy = Math.abs(a.motor.position.y - b.motor.position.y);
        const reach =
          action.clip.id === 'heavy'
            ? this.spacing.heavyReach
            : this.spacing.jabReach;
        if (
          Math.sign(dx) !== a.motor.facing ||
          Math.abs(dx) > reach + this.spacing.targetRadius ||
          dy > 40
        )
          continue;
        this.hitRevisions.add(key);
        const blocked = b.blocking && b.motor.facing !== a.motor.facing,
          damage = blocked ? 2 : action.clip.id === 'heavy' ? 18 : 8;
        b.hit(
          damage,
          a.motor.facing *
            (blocked ? 35 : action.clip.id === 'heavy' ? 180 : 85),
          blocked ? 'block' : 'hit',
        );
        b.contacts.signal(
          'hitContact',
          time,
          'body',
          true,
          b.animator.joint('chest'),
        );
        a.score += damage;
        this.hits.push({ time, attacker: a.id, target: b.id, blocked, damage });
        this.contacts.push({
          id: key,
          time,
          attacker: a.id,
          target: b.id,
          outcome: blocked ? 'block' : 'hit',
          direction: { x: a.motor.facing, y: 0 },
          intensity: damage / 18,
        });
        this.contacts = this.contacts.slice(-60);
        this.hits = this.hits.slice(-40);
      }
    }
  }
  ai(a: MotionActor, time: number) {
    const enemy = this.actors.find((b) => b !== a)!;
    if (a.health <= 0 || enemy.health <= 0) return {};
    const distance = Math.abs(enemy.motor.position.x - a.motor.position.x),
      braking = a.motor.velocity.x ** 2 / (2 * a.motor.profile.deceleration);
    const threat = !!enemy.planner.graph.get('action') && !enemy.blocking;
    const command = this.rhythms
      .get(a.id)!
      .sample(time, distance < 150 && a.canCancel(), threat, a.stamina);
    const desired =
      command === 'primaryAction' || command === 'secondaryAction'
        ? this.spacing.desiredRange
        : this.spacing.neutralRange;
    return {
      move: {
        x:
          distance < desired - 8 && a.canCancel()
            ? -Math.sign(enemy.motor.position.x - a.motor.position.x) * 0.45
            : distance > desired + braking
              ? Math.sign(enemy.motor.position.x - a.motor.position.x) * 0.55
              : 0,
        y: 0,
      },
      ...(command ? { [command]: 1 } : {}),
    };
  }
  pause() {
    this.actors.forEach((a) => {
      a.blocking = false;
      a.motor.stopIntent();
      if (a.planner.graph.get('action')?.clip.id === 'block')
        a.planner.graph.remove('action');
    });
  }
  snapshot() {
    return {
      id: this.id,
      phase: this.actors.some((a) => a.health <= 0) ? 'finished' : 'fighting',
      hits: [...this.hits],
      contacts: [...this.contacts],
      decisions: Object.fromEntries(
        [...this.rhythms].map(([id, rhythm]) => [id, rhythm.snapshot()]),
      ),
      spacing: this.spacing,
      hitDetection:
        'directional reach and lane gate, only between hitbox markers',
      presentation:
        'Directional authored rear-garment skin keeps the near anatomical right arm and avoids reversed front branding.',
    };
  }
}
