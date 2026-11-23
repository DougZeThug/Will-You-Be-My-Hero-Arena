import * as Phaser from 'phaser';
import { NativeAnimator } from './NativeAnimator';
import { addPlayRunning } from './authoring/play';
import { MotionPlanner } from './motion/MotionPlanner';
import { MotionContacts } from './motion/MotionContacts';
import {
  gaitStartEvents,
  landingEvents,
} from './motion/GaitEvents';
import { CharacterMotor } from '../../lib/arena/engine/movement/CharacterMotor';
import type { MotionEvent } from '../../lib/arena/engine/motion/MotionTypes';
import { motionProfiles } from '../../lib/arena/engine/motion/MotionProfiles';
import type {
  CharacterRig,
  RigDriveFrame,
  SocketName,
} from '../../lib/arena/engine/characters/CharacterRig';
import {
  ARENA_STANDING_HEIGHT,
  displayScale,
} from '../loongbones/side-rig/anatomy';
import { SIDE_RIG_SOCKETS } from '../loongbones/arena/sideRigSockets';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';

/** World px per unit body scale of the Play puppet, so a side-view runner
 * stands exactly as tall as the puppet it replaces (both are 5'8"). */
const PLAY_RIG_HEIGHT = 307;
/** The live session's fixed simulation step; body velocities change only on it. */
const SIM_STEP = 1 / 60;
/** Play runs at 1.7-2.7 m/s in body terms. A real run at that speed covers
 * about 1.5 m per stride cycle, twice the Lab proof's short measured-cadence
 * strides, so the stride is doubled instead of stretching the legs to their
 * reach limit. The arms swing back past the hip (the proof kept both hands
 * ahead of the chest). */
const PLAY_GAIT = { strideScale: 2, armBias: 14, armGain: 1.1 };
/** A facing change (a cross-up) turns as a quick paper flip over this many
 * seconds of presented time instead of mirroring in one frame. */
const FLIP_SECONDS = 0.1;

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
  /** Acceleration of the latest simulation step, held between steps. */
  private acceleration = { x: 0, y: 0 };
  private sinceVelocityChange = Infinity;
  private width = 1;
  /** The facing being flipped to, where the flip started (signed width) and
   * when; `drawn` is the signed facing currently drawn. */
  private flip = { to: 0, from: 1, at: 0 };
  private drawn = 1;
  private squash = { x: 1, y: 1 };
  /** Absolute scale of the native actor (source units → world px). */
  private actorScale = 0;
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
  private actorScaleFor(laneScale: number) {
    return (
      (this.definition.scale * PLAY_RIG_HEIGHT * laneScale) /
      ARENA_STANDING_HEIGHT
    );
  }
  private build(frame: RigDriveFrame) {
    const id = this.definition.id;
    const scale = this.actorScaleFor(this.scale);
    this.actorScale = scale;
    this.animator = new NativeAnimator(
      this.scene,
      { ...this.definition, scale },
      {
        directional: true,
        extend: (library) => addPlayRunning(library),
        // Fighters close distance in short guarded steps (the proof's own
        // tuning); only runners need the long Play stride.
        gait: this.event === 'running' ? PLAY_GAIT : undefined,
      },
    );
    // Ratio to the 371 px Lab reference: motor and stride fitting only.
    const display = displayScale(this.definition, scale);
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
  private start(
    clip: string,
    substate: string,
    state: string,
    duration: number,
  ) {
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
    // Match-end wins finish the event; a mid-match taunt only celebrates.
    else if (substate === 'finished' || state === 'celebrating')
      planner.request('success', true);
  }
  drive(frame: RigDriveFrame) {
    if (!this.animator) {
      this.build(frame);
      this.flip = { to: frame.facing, from: frame.facing, at: frame.time };
    }
    this.squash = frame.squash;
    // A new facing starts a paper flip from whatever is drawn now.
    if (frame.facing !== this.flip.to)
      this.flip = { to: frame.facing, from: this.drawn, at: frame.time };
    this.drawn = this.flipFacing(frame.time);
    // Reduced motion can flip mid-match: re-read it every drive, not just at
    // build, so the organic/secondary layer follows the live setting.
    this.animator!.organicEnabled = !frame.reduced;
    const animator = this.animator!,
      planner = this.planner!,
      motor = this.motor!;
    if (frame.clipRevision !== this.revision) {
      this.revision = frame.clipRevision;
      this.start(
        frame.clip,
        frame.substate,
        frame.state,
        frame.clipDuration,
      );
    }
    // A held guard ends when the simulation lets go of the block, not when
    // its short start-up clip ends.
    if (
      planner.graph.get('action')?.clip.id === 'block' &&
      frame.substate !== 'blocking'
    )
      planner.graph.remove('action');
    // Lane depth: a runner changing lane is drawn at the new lane's scale.
    // The IK solves against the animator's scale, so it changes there, not
    // only at the root, and planted feet stay planted.
    if (Math.abs(frame.scale - this.scale) > 1e-4) this.rescale(frame.scale);
    // Paused or held (hit-stop): keep the pose.
    if (!(frame.dt > 0)) return this.applyWidth();
    const dt = Math.min(0.1, frame.dt),
      wasGrounded = motor.grounded;
    // Velocities come from fixed simulation steps, so differentiate per step,
    // not per render frame: a frame with a new velocity measures the change
    // over at least one step and frames between steps hold it, so lean does
    // not spike and drop at refresh rates above 60 Hz. Once a whole step
    // passes without a change the body is not accelerating. At 60 Hz every
    // frame is a step, as before.
    this.sinceVelocityChange += dt;
    if (frame.vx !== motor.velocity.x || frame.vy !== motor.velocity.y) {
      const span = Math.max(SIM_STEP, dt);
      this.acceleration = {
        x: (frame.vx - motor.velocity.x) / span,
        y: (frame.vy - motor.velocity.y) / span,
      };
      this.sinceVelocityChange = 0;
    } else if (this.sinceVelocityChange >= SIM_STEP * 0.75)
      this.acceleration = { x: 0, y: 0 };
    motor.acceleration = { ...this.acceleration };
    motor.velocity = { x: frame.vx, y: frame.vy };
    motor.position = { x: frame.x, y: frame.y };
    const falling = (motor.height - frame.z) / dt;
    motor.height = frame.z;
    motor.grounded = frame.z <= 0.5;
    if (!motor.grounded) this.airborneSpeed = Math.max(0, falling);
    // The pose mirrors when the flip passes edge-on (its sign changes), so
    // the drawing, garment view and foot locks change side together while
    // the figure is a sliver, never as a one-frame swap.
    motor.facing = motor.facingTarget = Math.sign(this.drawn);
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
      events.push(
        ...gaitStartEvents(gait, gait.clip.gait.stance, frame.time, 0),
      );
    }
    let impact = 0;
    if (!wasGrounded && motor.grounded) {
      impact = this.airborneSpeed;
      events.push(...landingEvents(frame.time, 'land'));
    }
    this.contacts.update(dt, events, impact);
    planner.gaitResponse.update(motor, events, dt);
    animator.advance(
      planner,
      motor,
      dt,
      events,
      frame.time,
      { aim: { x: 0, y: 0 }, landingCompression: this.contacts.compression },
    );
    // Sort with the other lane objects by ground line, as the puppet does.
    animator.actor.setDepth(frame.y + 20);
    this.applyWidth();
  }
  private rescale(scale: number) {
    this.scale = scale;
    this.actorScale = this.actorScaleFor(scale);
    const display = displayScale(this.definition, this.actorScale);
    this.animator!.definition.scale = this.actorScale;
    this.motor!.verticalScale = display;
    this.planner!.displayScale = display;
  }
  /** Signed draw width of the facing flip: it eases from the old side
   * through edge-on to the new one, never quite zero. */
  private flipFacing(time: number) {
    const { to, from, at } = this.flip,
      u = Math.min(1, Math.max(0, (time - at) / FLIP_SECONDS));
    if (u >= 1) return to;
    const f = from + (to - from) * u * u * (3 - 2 * u);
    return Math.sign(f || to) * Math.max(0.04, Math.abs(f));
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
      this.actorScale *
      this.drawn *
      this.squash.x *
      Math.max(0.001, this.width);
    this.animator.actor.scaleY = this.actorScale * this.squash.y;
    this.animator.actor.setVisible(this.width > 0.01);
  }
  apply() {
    throw Error('The side-view motion rig is driven by the simulated body');
  }
  socket(name: SocketName) {
    return this.animator
      ? this.animator.joint(SIDE_RIG_SOCKETS[name])
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
