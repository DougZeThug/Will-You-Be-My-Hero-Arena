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
export class PlayMotionRig implements CharacterRig {
  readonly root: Phaser.GameObjects.Container;
  readonly backend = 'loongbones-side-motion';
  private animator?: NativeAnimator;
  private planner?: MotionPlanner;
  private motor?: CharacterMotor;
  private contacts = new MotionContacts();
  private revision = -1;
  private airborneSpeed = 0;
  constructor(
    private scene: Phaser.Scene,
    readonly definition: WeightedRigDefinition,
    private scale: number,
  ) {
    // The native actor is placed in world space (its foot locks are world
    // points); the root stays at the origin so socket() is world space too.
    this.root = scene.add.container(0, 0);
  }
  private build(frame: RigDriveFrame) {
    const id = this.definition.id as 'dan' | 'doug';
    const scale =
      (this.definition.scale * PLAY_RIG_HEIGHT * this.scale) / 371;
    this.animator = new NativeAnimator(
      this.scene,
      { ...this.definition, scale },
      {
        forwardKnees: true,
        directional: true,
        extend: (library) => addPlayRunning(library),
        gait: PLAY_GAIT,
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
    else if (substate === 'finished') planner.request('success', true);
  }
  drive(frame: RigDriveFrame) {
    if (!this.animator) this.build(frame);
    const animator = this.animator!,
      planner = this.planner!,
      motor = this.motor!;
    if (frame.clipRevision !== this.revision) {
      this.revision = frame.clipRevision;
      this.start(frame.clip, frame.substate, frame.clipDuration);
    }
    // Paused or held (hit-stop): keep the pose.
    if (!(frame.dt > 0)) return;
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
