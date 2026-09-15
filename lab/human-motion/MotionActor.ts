import {
  CharacterMotor,
  type MovementCollision,
} from '../../lib/arena/engine/movement/CharacterMotor';
import { MotionPlanner } from '../../lib/arena/engine/motion/MotionPlanner';
import { MotionAnalyzer } from '../../lib/arena/engine/motion/MotionAnalyzer';
import { MotionContacts } from '../../lib/arena/engine/motion/MotionContacts';
import { gaitSupport } from '../../lib/arena/engine/motion/StrideMatcher';
import {
  motionProfiles,
  type Vec2,
} from '../../lib/arena/engine/motion/MotionTypes';
import { AttachmentManager } from '../../lib/arena/engine/equipment/AttachmentManager';
import { PropPerformance } from '../../lib/arena/engine/equipment/PropPerformance';
import { PerformanceTimeline } from '../../lib/arena/engine/motion/PerformanceTimeline';
import { performancePersonalities } from '../../lib/arena/engine/characters/PerformancePersonality';
import { motionSignatures } from '../../lib/arena/engine/motion/CharacterMotionSignature';
import type {
  ControllableEntity,
  ActionPayload,
  EntityState,
} from '../../lib/arena/engine/controllers/ControllableEntity';
import type { NativeAnimator } from './NativeAnimator';
export interface MotionMechanic {
  can(action: string, actor: MotionActor): boolean;
  perform(action: string, payload: ActionPayload, actor: MotionActor): boolean;
}
/** Composition boundary shared by all four proofs; raw buttons never reach this class. */
export class MotionActor implements ControllableEntity {
  readonly motor: CharacterMotor;
  readonly planner: MotionPlanner;
  readonly analyzer = new MotionAnalyzer();
  readonly contacts = new MotionContacts();
  private time = 0;
  readonly equipment = new AttachmentManager(
    () => this.time,
    (event) => {
      const held = event.name !== 'release';
      this.contacts.signal(
        held ? 'handGrab' : 'handRelease',
        event.time,
        'hand',
        held,
      );
      this.contacts.signal(
        'equipment.' + event.name,
        event.time,
        'equipment',
        held,
      );
    },
  );
  readonly prop = new PropPerformance();
  readonly personality: PerformanceTimeline;
  aimIntent: Vec2 = { x: 0, y: 0 };
  lookTarget?: Vec2;
  health = 100;
  stamina = 100;
  score = 0;
  blocking = false;
  dodging = false;
  hitbox = false;
  chargeStart: number | null = null;
  power = 0.65;
  shot = 'flat';
  releaseCount = 0;
  private activeRevision = -1;
  private activeClip = '';
  private hitContactPending = false;
  constructor(
    readonly id: 'dan' | 'doug',
    readonly animator: NativeAnimator,
    position: Vec2,
    readonly mechanic: MotionMechanic,
    collision: MovementCollision,
  ) {
    this.motor = new CharacterMotor(motionProfiles[id], position, collision);
    this.motor.verticalScale =
      animator.definition.scale / (371 / (id === 'dan' ? 1215 : 1191));
    this.planner = new MotionPlanner(
      animator.library.metadata,
      this.motor.profile,
      animator.definition.scale / (371 / (id === 'dan' ? 1215 : 1191)),
    );
    this.personality = new PerformanceTimeline(
      performancePersonalities[id],
      {
        play: (semantic) => this.planner.request(semantic, true),
        complete: () =>
          ['action', 'reaction'].every((layer) => {
            const s = this.planner.graph.get(layer as 'action' | 'reaction');
            return !s || s.completed;
          }),
        canTransition: () => this.canCancel(),
        has: (semantic) => this.planner.clips.has(semantic),
      },
      id === 'doug' ? 7041 : 1702,
    );
    this.animator.advance(this.planner, this.motor, 0, [], 0, this.aimIntent);
  }
  move(v: Vec2) {
    this.motor.move(v);
  }
  aim(v: Vec2) {
    this.aimIntent = { ...v };
  }
  canPerform(action: string) {
    return (
      this.health > 0 &&
      (['move', 'aim', 'celebrate'].includes(action) ||
        this.mechanic.can(action, this))
    );
  }
  performAction(action: string, payload: ActionPayload = {}) {
    if (!this.canPerform(action)) return false;
    if (action === 'move' || action === 'aim') {
      if (payload.value && typeof payload.value !== 'number')
        this[action](payload.value);
      return true;
    }
    if (action === 'celebrate') return this.planner.request('success');
    return this.mechanic.perform(action, payload, this);
  }
  getState(): EntityState {
    return this.health <= 0
      ? 'disabled'
      : this.planner.graph.get('reaction')
        ? 'reaction'
        : this.planner.graph.get('action')
          ? 'action'
          : Math.abs(this.motor.velocity.x) > 3
            ? 'moving'
            : 'idle';
  }
  controlState() {
    return this.chargeStart !== null ? 'charging' : this.planner.graph.phase();
  }
  canCancel() {
    return this.planner.graph.canInterrupt();
  }
  getFacing() {
    return this.motor.facing;
  }
  start(action: string) {
    const accepted = this.planner.request(action);
    if (accepted) this.hitbox = false;
    return accepted;
  }
  hit(damage: number, impulse: number, presentation: 'hit' | 'block' = 'hit') {
    this.hitContactPending = true;
    this.health = Math.max(0, this.health - damage);
    this.motor.impulse({ x: impulse, y: 0 });
    this.animator.performance.impulse(-Math.min(1, damage / 20));
    this.hitbox = false;
    this.blocking = false;
    // Guard interruption, damage and impulse remain unchanged. Only the reaction pose differs.
    this.planner.request(
      presentation === 'block' ? 'blockImpact' : 'hit',
      true,
    );
  }
  update(dt: number, time: number) {
    this.time = time;
    this.prop.update(dt);
    this.personality.update(time);
    const oldGait = this.planner.graph.get('base')?.revision;
    this.planner.locomotion(this.motor);
    const delta = this.planner.rootDelta(dt);
    delta.x *= this.motor.facing;
    const active =
      this.planner.graph.get('reaction') ?? this.planner.graph.get('action');
    const resumeMoving =
      this.activeRevision >= 0 &&
      !active &&
      Math.hypot(this.motor.velocity.x, this.motor.velocity.y) > 6;
    if (this.activeRevision !== (active?.revision ?? -1)) {
      if (this.activeClip === 'gesture.bagFlip') this.prop.cancel();
      if (this.activeClip === 'gesture.chestTap')
        this.contacts.signal('chestTapRelease', time, 'chest', false);
      this.activeClip = active?.clip.id ?? '';
      this.activeRevision = active?.revision ?? -1;
      this.hitbox = false;
      this.dodging = false;
    }
    const result = this.motor.update(dt, delta, active?.clip.moveControl ?? 1);
    // Full-body actions own contacts. The underlying gait keeps its phase for
    // recovery, but cannot replant a foot during an action's swing or takeoff.
    const events = this.planner.graph
      .advance(dt, time)
      .filter(
        (event) => !event.foot || !active || event.clip === active.clip.id,
      );
    const gait = this.planner.graph.get('base');
    if (!active && gait?.clip.gait && oldGait !== gait.revision) {
      const support = gaitSupport(
        gait.time / gait.clip.duration,
        gait.clip.gait.stance,
      );
      for (const foot of ['right', 'left'] as const)
        events.push({
          name: support.includes(foot) ? 'footPlant' : 'footRelease',
          foot,
          at: 0,
          clip: gait.clip.id,
          time,
          cycle: Math.floor(gait.time / gait.clip.duration),
        });
    }
    // A resumed gait may already be past its release marker. Landing contacts
    // cannot remain fixed until that marker comes around in another cycle.
    if (resumeMoving)
      events.unshift(
        ...(['right', 'left'] as const).map((foot) => ({
          name: 'footRelease',
          foot,
          at: 0,
          clip: 'locomotionResume',
          time,
          cycle: 0,
        })),
      );
    if (result.landed)
      events.push(
        {
          name: 'land',
          at: 0,
          clip: active?.clip.id ?? 'airborne',
          time,
          cycle: 0,
        },
        ...(['left', 'right'] as const).map((foot) => ({
          name: 'footPlant',
          foot,
          at: 0,
          clip: 'land',
          time,
          cycle: 0,
        })),
      );
    for (const event of events) {
      if (event.name === 'takeoff')
        this.motor.jump(active?.clip.id === 'shoot' ? 330 : 310);
      if (event.name === 'hitboxOn') this.hitbox = true;
      if (
        event.name === 'hitboxOff' ||
        (event.name === 'motionComplete' && event.clip === active?.clip.id)
      )
        this.hitbox = false;
      if (event.name === 'dodgeOn') this.dodging = true;
      if (event.name === 'dodgeOff') this.dodging = false;
    }
    if (this.hitContactPending) {
      events.push({ name: 'hitContact', at: 0, time, cycle: 0, clip: 'hit' });
      this.hitContactPending = false;
    }
    this.contacts.update(dt, events, result.impactSpeed);
    this.planner.gaitResponse.update(this.motor, events, dt);
    const pose = this.animator.advance(
      this.planner,
      this.motor,
      dt,
      events,
      time,
      this.aimIntent,
      active?.clip.id === 'shoot' && !!this.equipment.attached,
      this.lookTarget,
      this.contacts.compression,
    );
    this.equipment.sampleAnchors(this.animator.anchors(), time);
    for (const event of events) {
      if (event.name === 'propToss')
        this.prop.toss(
          this.animator.hand(),
          0.3,
          this.animator.definition.scale / (371 / 1191),
        );
      if (event.name === 'propCatch') this.prop.catch(this.animator.hand());
      if (event.name.startsWith('chestTapContact'))
        this.animator.performance.impulse(0.09);
    }
    this.analyzer.push(pose, events);
    return events;
  }
  snapshot() {
    return {
      id: this.id,
      state: this.getState(),
      phase: this.controlState(),
      health: this.health,
      stamina: this.stamina,
      score: this.score,
      blocking: this.blocking,
      dodging: this.dodging,
      hitbox: this.hitbox,
      chargeStart: this.chargeStart,
      power: this.power,
      shot: this.shot,
      motor: this.motor.snapshot(),
      graph: this.planner.graph.snapshot(),
      recovery: this.planner.recovery,
      strideFit: this.planner.strideFit,
      gaitResponse: this.planner.gaitResponse.snapshot(),
      equipment: this.equipment.snapshot(),
      contacts: this.contacts.snapshot(),
      anchors: this.animator.anchors(),
      rig: this.animator.snapshot(),
      motion: this.analyzer.snapshot(),
      releaseCount: this.releaseCount,
      personality: this.personality.snapshot(),
      signature: motionSignatures[this.id],
      prop: this.prop.snapshot(),
    };
  }
}
