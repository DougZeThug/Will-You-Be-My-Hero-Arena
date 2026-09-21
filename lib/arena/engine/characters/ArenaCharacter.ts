import type { CharacterProfile } from './CharacterProfile';
import type { PuppetAsset } from '../../puppet-geometry';
import type {
  ControllableEntity,
  ActionPayload,
  EntityState,
} from '../controllers/ControllableEntity';
import type { Vector } from '../input/InputActions';
import { AnimationComponent } from './components/AnimationComponent';
import { PersonalityComponent } from './components/PersonalityComponent';
import { CharacterStats } from './components/CharacterStats';
import { AbilityComponent } from './components/AbilityComponent';
import type { ClipMarker } from '../animation/AnimationEvents';
export interface CharacterComponent {
  can(action: string): boolean;
  perform(action: string, payload: ActionPayload): boolean;
  update?(delta: number): void;
  marker?(marker: ClipMarker): void;
  cleanup?(): void;
}
export class ArenaCharacter implements ControllableEntity {
  body = { x: 200, y: 620, z: 0, vx: 0, vy: 0, vz: 0, facing: 1, scale: 0.83 };
  health = 100;
  stamina = 100;
  score = 0;
  state: EntityState = 'idle';
  substate = 'ready';
  moveIntent: Vector = { x: 0, y: 0 };
  aimIntent: Vector = { x: 0, y: 0 };
  animation: AnimationComponent;
  personality: PersonalityComponent;
  stats: CharacterStats;
  abilities: AbilityComponent;
  private components: CharacterComponent[] = [];
  private presentedHand?: () => { x: number; y: number };
  constructor(
    readonly id: string,
    readonly profile: CharacterProfile,
    random: () => number,
    geometry?: PuppetAsset,
  ) {
    this.animation = new AnimationComponent(profile, geometry);
    this.personality = new PersonalityComponent(profile, random);
    this.stats = new CharacterStats(profile);
    this.abilities = new AbilityComponent(
      profile.gameplay?.abilities ?? [
        'precisionMode',
        'burstSprint',
        'powerStrike',
      ],
    );
    this.animation.idle = this.personality.choose('idle');
  }
  attach(component: CharacterComponent) {
    this.components.push(component);
  }
  move(direction: Vector) {
    this.moveIntent = direction;
  }
  aim(direction: Vector) {
    this.aimIntent = direction;
    this.animation.headAim = direction.y * 4;
  }
  canPerform(action: string) {
    if (this.state === 'disabled') return false;
    return (
      action === 'move' ||
      action === 'aim' ||
      action === 'celebrate' ||
      this.components.some((c) => c.can(action))
    );
  }
  performAction(action: string, payload: ActionPayload = {}) {
    if (!this.canPerform(action)) return false;
    if (action === 'move' || action === 'aim') {
      const v = payload.value;
      if (v && typeof v !== 'number') this[action](v);
      return true;
    }
    if (action === 'celebrate') {
      if (this.animation.timeline.active) return false;
      this.celebrate();
      return true;
    }
    return this.components.some(
      (c) => c.can(action) && c.perform(action, payload),
    );
  }
  startAction(clip: string) {
    this.state = 'action';
    this.animation.start(clip);
  }
  cancelAction() {
    this.animation.cancel();
    this.moveIntent = { x: 0, y: 0 };
    if (this.state !== 'disabled') this.state = 'idle';
  }
  react(clip: string) {
    this.state = 'reaction';
    this.animation.start(clip);
  }
  celebrate(importance = 0.3) {
    this.state = 'celebrating';
    this.animation.start(this.personality.choose('celebration', importance));
  }
  applyImpulse(x: number, y = 0) {
    this.body.vx += x;
    this.body.vz += y;
  }
  takeHit(damage: number, impulse: number) {
    this.health = Math.max(0, this.health - damage);
    this.applyImpulse(impulse);
    this.react(
      this.health <= 0
        ? 'combat.defeat'
        : damage >= 15
          ? 'combat.heavyHit'
          : 'combat.hit',
    );
    this.substate = this.health <= 0 ? 'defeated' : 'hitstun';
    if (this.health <= 0) this.state = 'disabled';
  }
  update(dt: number, time: number, emit: (marker: ClipMarker) => void) {
    for (const c of this.components) c.update?.(dt);
    this.animation.update(dt, time, Math.abs(this.body.vx), (m) => {
      const revision = this.animation.timeline.revision;
      for (const c of this.components) c.marker?.(m);
      emit(m);
      if (
        m.name === 'animationComplete' &&
        this.state !== 'disabled' &&
        revision === this.animation.timeline.revision
      ) {
        this.state = 'idle';
        this.animation.timeline.cancel();
      }
    });
  }
  hand(time: number) {
    if (this.presentedHand) return this.presentedHand();
    const p = this.animation.handAt(time),
      b = this.body;
    return { x: b.x + p.x * b.scale * b.facing, y: b.y - b.z + p.y * b.scale };
  }
  setPresentedHand(provider?: () => { x: number; y: number }) {
    this.presentedHand = provider;
  }
  getState() {
    return this.state;
  }
  controlState() {
    return this.substate;
  }
  canCancel() {
    return this.animation.timeline.canCancel;
  }
  getFacing() {
    return this.body.facing;
  }
  cleanup() {
    this.components.forEach((c) => c.cleanup?.());
    this.components = [];
  }
}
