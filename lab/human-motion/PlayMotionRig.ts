import * as Phaser from 'phaser';
import { NativeAnimator } from './NativeAnimator';
import { addPlayRunning } from './authoring/play';
import { MotionPlanner } from '../../lib/arena/engine/motion/MotionPlanner';
import { MotionContacts } from '../../lib/arena/engine/motion/MotionContacts';
import { gaitSupport } from '../../lib/arena/engine/motion/StrideMatcher';
import { CharacterMotor } from '../../lib/arena/engine/movement/CharacterMotor';
import {
  motionProfiles,
  type MotionEvent,
} from '../../lib/arena/engine/motion/MotionTypes';
import type {
  CharacterRig,
  RigDriveFrame,
  SocketName,
} from '../../lib/arena/engine/characters/CharacterRig';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';

const joints: Record<SocketName, string> = {
  throwingHand: 'rightHand',
  offHand: 'leftHand',
  head: 'head',
  chest: 'chest',
  waist: 'pelvis',
  footL: 'rightAnkle',
  footR: 'leftAnkle',
  effect: 'chest',
};
/** World px per unit body scale of the Play puppet, so a side-view runner
 * stands exactly as tall as the puppet it replaces (both are 5'8"). */
export const PLAY_RIG_HEIGHT = 307;
/** Play runs at 1.7-2.7 m/s in body terms. A real run at that speed covers
 * about 1.5 m per stride cycle, twice the Lab proof's short measured-cadence
 * strides, so the stride is doubled instead of stretching the legs to their
 * reach limit. The arms swing back past the hip (the proof kept both hands
 * ahead of the chest). */
const PLAY_GAIT = { strideScale: 2, armBias: 14, armGain: 1.1 };

/**
 * Side-view (profile) character for Play, on the Human Motion native
 * animator: measured-reference gaits, world-space foot locks, touchdown
 * blends and support compression, a complete far arm and the rear-garment
 * view when facing left.
 *
 * The event simulation stays the only authority for position, speed, jumps
 * and results. Each frame its presented body is mirrored into the motor the
 * animator reads, so the gait is fitted to the real ground speed (planted
 * feet do not slide) and actions start from the simulation's own clip starts.
 */
export type PlayMotionEvent = 'running' | 'fighting';
/** Play combat actions → the Human Motion combat vocabulary. The proof has a
 * near-arm jab and heavy punch; the bigger Play attacks reuse the heavy. */
const COMBAT: Record<string, string> = {
  'combat.jab': 'jab',
  'combat.cross': 'jab',
  'combat.heavy': 'heavy',
  'combat.uppercut': 'heavy',
  'combat.finisher': 'heavy',
  'combat.special': 'heavy',
  'combat.grapple': 'heavy',
  'combat.dodge': 'dodge',
  'combat.block': 'block',
  'combat.hit': 'hit',
  'combat.heavyHit': 'hit',
  'combat.defeat': 'failure',
};
export class PlayMotionRig implements CharacterRig {
  readonly root: Phaser.GameObjects.Container;
  readonly backend = 'loongbones-side-motion';
  private animator?: NativeAnimator;
  private planner?: MotionPlanner;
  private motor?: CharacterMotor;
  private contacts = new MotionContacts();
  private revision = -1;
  private airborneSpeed = 0;
  private width = 1;
  private squash = { x: 1, y: 1 };
  private displayScale = 0;
  constructor(
    private scene: Phaser.Scene,
    readonly definition: WeightedRigDefinition,
    private scale: number,
    readonly event: PlayMotionEvent = 'running',
  ) {
    // The native actor is placed in world space (its foot locks are world
    // points); the root stays at the origin so socket() is world space too.
    this.root = scene.add.container(0, 0);
  }
  private build(frame: RigDriveFrame) {
    const id = this.definition.id as 'dan' | 'doug';
    const scale =
      (this.definition.scale * PLAY_RIG_HEIGHT * this.scale) / 371;
    this.displayScale = scale;
    this.animator = new NativeAnimator(
      this.scene,
      { ...this.definition, scale },
      {
        forwardKnees: true,
        directional: true,
        extend: (library) => addPlayRunning(library),
        // Fighters close distance in short guarded steps (the proof's own
        // tuning); only runners need the long Play stride.
        gait: this.event === 'running' ? PLAY_GAIT : undefined,
      },
    );
    this.animator.organicEnabled = !frame.reduced;
    const display = scale / this.definition.scale;
    this.motor = new CharacterMotor(motionProfiles[id], {
      x: frame.x,
      y: frame.y,
    });
    this.motor.verticalScale = display;
    this.planner = new MotionPlanner(
      this.animator.library.metadata,
      this.motor.profile,
      display,
    );
    if (this.event === 'fighting') {
      // Guard stance and guard-carrying gaits; facing follows the opponent.
      this.motor.steerFacing = false;
      this.planner.idle = 'combatNeutral';
      this.planner.locomotionVariants = Object.fromEntries(
        ['walk', 'jog', 'run', 'sprint'].map((id) => [id, 'combat.' + id]),
      );
      this.planner.request('combatNeutral', true);
    }
  }
  /** Start the rig's action for a new simulation clip. */
  private start(clip: string, substate: string, duration: number) {
    const planner = this.planner!;
    if (clip === 'athletic.jump') {
      // The simulation leaves the ground on the jump input: enter the
      // authored jump at its takeoff, not at its crouch, and stretch its air
      // phase over the simulation's real airtime so it lands with the body.
      const jump = planner.clips.get('jump'),
        phase = (name: string) => jump?.phases.find((p) => p.phase === name)?.at;
      const takeoff = phase('airborne') ?? 0,
        landing = phase('recovery') ?? jump?.duration ?? 0;
      if (jump && planner.graph.request(jump, true, takeoff / jump.duration)) {
        const state = planner.graph.get('action')!;
        state.rate = duration > 0 ? (landing - takeoff) / duration : 1;
      }
    } else if (clip === 'running.slide') planner.request('slide', true);
    else if (clip === 'running.stumble') planner.request('hit', true);
    else if (COMBAT[clip]) planner.request(COMBAT[clip], true);
    else if (substate === 'finished' || substate === 'celebrating')
      planner.request('success', true);
  }
  drive(frame: RigDriveFrame) {
    if (!this.animator) this.build(frame);
    this.squash = frame.squash;
    const animator = this.animator!,
      planner = this.planner!,
      motor = this.motor!;
    if (frame.clipRevision !== this.revision) {
      this.revision = frame.clipRevision;
      this.start(frame.clip, frame.substate, frame.clipDuration);
    }
    // A held guard ends when the simulation lets go of the block.
    if (
      planner.graph.get('action')?.clip.id === 'block' &&
      frame.clip !== 'combat.block'
    )
      planner.graph.remove('action');
    // Paused or held (hit-stop): keep the pose.
    if (!(frame.dt > 0)) return this.applyWidth();
    const dt = Math.min(0.1, frame.dt),
      wasGrounded = motor.grounded;
    motor.acceleration = {
      x: (frame.vx - motor.velocity.x) / dt,
      y: (frame.vy - motor.velocity.y) / dt,
    };
    motor.velocity = { x: frame.vx, y: frame.vy };
    motor.position = { x: frame.x, y: frame.y };
    const falling = (motor.height - frame.z) / dt;
    motor.height = frame.z;
    motor.grounded = frame.z <= 0.5;
    if (!motor.grounded) this.airborneSpeed = Math.max(0, falling);
    motor.facing = motor.facingTarget = frame.facing;
    motor.turning = false;
    const oldGait = planner.graph.get('base')?.revision;
    planner.locomotion(motor);
    const active =
      planner.graph.get('reaction') ?? planner.graph.get('action');
    // Full-body actions own contacts; the gait keeps its phase underneath.
    const events: MotionEvent[] = planner.graph
      .advance(dt, frame.time)
      .filter((e) => !e.foot || !active || e.clip === active.clip.id);
    const gait = planner.graph.get('base');
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
          time: frame.time,
          cycle: 0,
        });
    }
    let impact = 0;
    if (!wasGrounded && motor.grounded) {
      impact = this.airborneSpeed;
      events.push(
        { name: 'land', at: 0, clip: 'land', time: frame.time, cycle: 0 },
        ...(['left', 'right'] as const).map((foot) => ({
          name: 'footPlant',
          foot,
          at: 0,
          clip: 'land',
          time: frame.time,
          cycle: 0,
        })),
      );
    }
    this.contacts.update(dt, events, impact);
    planner.gaitResponse.update(motor, events, dt);
    animator.advance(
      planner,
      motor,
      dt,
      events,
      frame.time,
      { x: 0, y: 0 },
      false,
      undefined,
      this.contacts.compression,
    );
    // Sort with the other lane objects by ground line, as the puppet does.
    animator.actor.setDepth(frame.y + 20);
    this.applyWidth();
  }
  setViewWidth(width: number) {
    this.width = width;
    this.applyWidth();
  }
  /** Close the profile toward edge-on during a turn to the front view, and
   * apply the presentation squash. */
  private applyWidth() {
    if (!this.animator || !this.motor) return;
    // Scales about the actor origin on the ground line, so feet stay down.
    this.animator.actor.scaleX =
      this.displayScale *
      this.motor.facing *
      this.squash.x *
      Math.max(0.001, this.width);
    this.animator.actor.scaleY = this.displayScale * this.squash.y;
    this.animator.actor.setVisible(this.width > 0.01);
  }
  apply() {
    throw Error('The side-view motion rig is driven by the simulated body');
  }
  socket(name: SocketName) {
    return this.animator
      ? this.animator.joint(joints[name])
      : { x: 0, y: 0 };
  }
  socketTransform(name: SocketName) {
    const q = this.socket(name);
    return {
      ...q,
      angle: name === 'throwingHand' && this.animator ? this.animator.hand().angle : 0,
    };
  }
  debugInfo() {
    return this.animator
      ? {
          runtimeRevision: 'play-side-motion-v1',
          clip: this.planner?.graph.get('reaction')?.clip.id ??
            this.planner?.graph.get('action')?.clip.id ??
            this.planner?.graph.get('base')?.clip.id,
          strideFit: this.planner?.strideFit,
          rig: this.animator.snapshot(),
        }
      : { runtimeRevision: 'play-side-motion-v1', pending: true };
  }
  destroy() {
    this.animator?.destroy();
    this.root.destroy();
  }
}
