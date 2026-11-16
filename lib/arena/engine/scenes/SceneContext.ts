import type * as Phaser from 'phaser';
import type { Attempt, MotionPersonality, Recording } from '../../model';
import type { revealed } from '../../simulation';
import type { ArenaOptions } from '../core/ArenaOptions';
import type { DirectedAction, DirectorCue } from '../core/BattlePlan';
import type { ArenaEvent, ProjectileFrame } from '../events/ArenaEvent';
import type { CharacterController } from '../characters/CharacterController';
import type { CardPortal } from '../objects/CardPortal';
import type { Projectile } from '../objects/Projectile';
import type { ImpactEffects } from '../effects/ImpactEffects';

/** Where a held bag draws: at the hand, lifted and spun through the bag-flip
 * ritual's toss between u = 0.35 and 0.72. */
export function heldBagPose(
  hand: { x: number; y: number; angle: number },
  flipping: boolean,
  u: number,
  depth: number,
) {
  const flip = flipping && u >= 0.35 && u <= 0.72 ? (u - 0.35) / 0.37 : 0;
  return {
    x: hand.x,
    y: hand.y - Math.sin(flip * Math.PI) * 34 * depth,
    angle: hand.angle + flip * Math.PI * 2,
  };
}

export type Intro = ReturnType<CardPortal['entrance']>;

export interface ReleasedBagOptions {
  depthed: boolean;
  landAt?: number;
  touch?: { x: number; y: number };
  layer?: Phaser.GameObjects.Container;
  hand?: { x: number; y: number; scale?: number };
}

/** What a scene shares with its directors: the arena's objects and the
 * scene's own helpers, passed explicitly instead of reaching into the scene. */
export interface SceneContext {
  options(): ArenaOptions;
  readonly characters: CharacterController[];
  readonly cards: CardPortal[];
  readonly effects: ImpactEffects;
  /** The current sport's event; replaced when the sport changes. */
  event(): ArenaEvent;
  projectile(id: string, actor: number): Projectile;
  enter(
    c: CharacterController,
    time: number,
    personality: MotionPersonality,
    duration: number,
    reduced: boolean,
  ): Intro;
  /** The idle a character returns to, per the battle plan (recordings only). */
  idleFor(actor: number, time?: number): string | undefined;
  showReleasedBag(
    rec: Recording,
    attempt: Attempt,
    time: number,
    frame: ProjectileFrame,
    o: ReleasedBagOptions,
  ): void;
  emitCue(cue: DirectorCue): void;
}

/** The revealed match state the scene computes once per render. */
export interface SceneFrame {
  status: ReturnType<typeof revealed> | null;
  active: Attempt | undefined;
  direction: DirectedAction | undefined;
}

/** How one kind of scene content (a recorded match, or a collection preview)
 * draws a frame. The scene owns the lifecycle, camera, effects and HUD. */
export interface RenderDirector {
  /** The clock jumped (a seek back, or a long skip): drop continuity state. */
  discontinuity(): void;
  /** Draws one character, after the scene has placed it. */
  character(
    c: CharacterController,
    i: number,
    time: number,
    frame: SceneFrame,
  ): void;
  /** Draws the frame's remaining scene objects, after every character. */
  finish(time: number, frame: SceneFrame): void;
  destroy(): void;
}
