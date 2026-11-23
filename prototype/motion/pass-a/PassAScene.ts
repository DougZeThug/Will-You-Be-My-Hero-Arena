import * as Phaser from 'phaser';
import { performanceMatchProvider } from '../../../lab/performance/provider';
import type { LoongBonesAdapter } from '../../../lab/performance/LoongBonesAdapter';
import type { CharacterRig } from '../../../lib/arena/engine/characters/CharacterRig';
import { characterProfile } from '../../../lib/arena/engine/characters/CharacterRegistry';
import type { CharacterPerformanceController } from '../../../lib/arena/engine/performance/CharacterPerformanceController';
import { PERFORMANCE_CLIPS } from '../../../lib/arena/engine/performance/ClipNames';
import { softReachDrop } from '../../../lib/arena/engine/performance/KneeReach';
import type { PerformanceAction } from '../../../lib/arena/engine/performance/PerformanceTypes';
import dougTake from '../../../lib/arena/engine/performance/takes/doug-underhand';
import { precisionTarget } from '../../../lib/arena/engine/events/precision/PrecisionPhysics';
import {
  createVisualObject,
  type VisualPresentation,
} from '../../../lib/arena/engine/objects/VisualObjectRegistry';
import { equipmentSprite } from '../../../lib/arena/engine/objects/EquipmentSprite';
import { ArenaEnvironment } from '../../../lib/arena/engine/presentation/ArenaEnvironment';
import {
  prepareCharacterTextures,
  queueArenaAssets,
  queueCharacter,
  type LoadedCharacter,
} from '../../../lib/arena/engine/scenes/CharacterAssetLoader';
import { addBackdrop } from '../../../lib/arena/engine/scenes/stage';
import {
  BAG_FLIGHT_FLATTEN,
  BAG_REST_FLATTEN,
  placement,
} from '../../../lib/arena/equipment-geometry';
import {
  FIXED_DT,
  LiveThrowClock,
  type ThrowMarkers,
} from './LiveThrowClock';
import { StepGait, type Side } from './StepGait';

/** Shipped live cornhole places Doug here (PrecisionEvent.createParticipants);
 * the performance rig applies its own lane depth, so the root scale is 1. */
const START = { x: 215, y: 650, scale: 0.84 };
const WORLD_WIDTH = 1280;
/** Simple flight: one screen-space parabola onto the board, then a short
 * slide. No scoring. */
const FLIGHT = { seconds: 0.95, gravity: 1000, slide: 30, slideSteps: 18 };
/** Board surface direction on screen (toward the hole), read off the placed
 * board art; used only to put the touchdown short of the hole. */
const BOARD_AXIS = { x: 1, y: -0.152 };
const TOUCHDOWN_SHORT = 95;

type Vec = { x: number; y: number };
interface NativeBone {
  origin: Vec;
  offset: Vec & { rotation: number };
  globalTransformMatrix: { tx: number; ty: number };
  boneData: { length: number };
  invalidUpdate(): void;
}
/** The adapter's private rig handles. Pass A layers foot-target offsets on
 * the evaluated pose without changing the adapter. */
interface AdapterInternals {
  bones: Map<string, NativeBone>;
  actor: Phaser.GameObjects.Container & {
    armature: { advanceTime(seconds: number): void };
  };
}
export interface ProtoInput {
  move: number;
  charge: number;
}

export class PassAScene extends Phaser.Scene {
  ready = false;
  frame = 0;
  readonly input_: ProtoInput = { move: 0, charge: 0 };
  /** Real-time mode: the scene steps itself from the frame delta. */
  live = false;
  private provider!: Awaited<ReturnType<typeof performanceMatchProvider>>;
  private loaded!: LoadedCharacter;
  private rig!: CharacterRig;
  private performance!: CharacterPerformanceController;
  private runtime!: LoongBonesAdapter;
  private native!: AdapterInternals;
  private clock!: LiveThrowClock;
  private gait!: StepGait;
  private nominalScale = 1;
  private heldBag!: VisualPresentation;
  private thrownBag!: VisualPresentation;
  private bag: {
    state: 'held' | 'flight' | 'slide' | 'rest';
    x: number;
    y: number;
    angle: number;
    origin?: Vec;
    velocity?: Vec;
    age: number;
    spin: number;
  } = { state: 'held', x: 0, y: 0, angle: 0, age: 0, spin: 0 };
  private wasCharging = false;
  private releasedThisStep = false;
  private pressFrame: number | null = null;
  private keyUpFrame: number | null = null;
  private releaseFrame: number | null = null;
  private idleSteps = 0;
  private accumulator = 0;
  private recovering = false;
  private hand: Vec & { angle: number } = { x: 0, y: 0, angle: 0 };
  private handVelocity: Vec = { x: 0, y: 0 };
  constructor(private mirror = true) {
    super('PassA');
  }
  async prepare() {
    this.provider = await performanceMatchProvider();
  }
  preload() {
    queueArenaAssets(this);
    this.provider.preload(this);
    this.loaded = queueCharacter(this, 'card-doug', 0);
  }
  create() {
    prepareCharacterTextures(this, [this.loaded]);
    // Same court as shipped live cornhole (LiveArenaScene.create), minus the
    // HUD, reticle, effects and camera cues.
    addBackdrop(this, WORLD_WIDTH);
    equipmentSprite(this, placement('cornhole', 0), 530);
    const environment = new ArenaEnvironment(this, 'cornhole', 720, WORLD_WIDTH);
    this.events.once('shutdown', () => environment.destroy());
    this.cameras.main.setZoom(1).centerOn(640, 360);
    const rig = this.provider.create(
      this,
      this.loaded,
      characterProfile('card-doug', this.loaded.asset),
      { lane: 0, scale: START.scale },
    );
    if (!rig?.performance) throw Error('Performance rig unavailable');
    this.rig = rig;
    this.performance = rig.performance;
    this.runtime = this.performance.runtime as LoongBonesAdapter;
    this.native = this.runtime as unknown as AdapterInternals;
    this.nominalScale = this.runtime.definition.scale;
    rig.root.setPosition(START.x, START.y).setScale(1).setDepth(START.y + 20);

    const clip = this.runtime.clips.get(PERFORMANCE_CLIPS.underhand)!;
    const at = (name: string) =>
      clip.markers.find((m) => m.name === name)!.at;
    const markers: ThrowMarkers = {
      windup: at('windup'),
      windupPeak: at('windupPeak'),
      equipmentRelease: at('equipmentRelease'),
      finish: at('finish'),
      holdEnd: at('holdEnd'),
      duration: clip.duration,
    };
    // Authored world arm swing of the take, for the early-release re-entry.
    const tempo = this.performance.profile.movementTempo,
      times = dougTake.times.map((t) => t / tempo),
      swing = dougTake.channels.armSwing;
    const swingAt = (t: number) => {
      const i = times.findIndex((time) => time >= t);
      if (i < 0) return swing.at(-1)!;
      if (i === 0) return swing[0];
      const u = (t - times[i - 1]) / (times[i] - times[i - 1]);
      return swing[i - 1] + (swing[i] - swing[i - 1]) * u;
    };
    this.clock = new LiveThrowClock(
      markers,
      this.mirror ? swingAt : undefined,
    );

    // Timing-only action tables on the shipped controller. The throw is one
    // open segment of the shipped take (the clock owns its timing and end);
    // its states step straight to `drive` because the clock can enter the
    // clip past the choreography's phase times. Recovery is the shipped
    // recover clip.
    const actions = this.performance.actions as Map<string, PerformanceAction>;
    actions.set('passAThrow', {
      name: 'passAThrow',
      priority: 10,
      requiresObject: true,
      preparation: 'external',
      segments: [
        {
          state: 'anticipate',
          clip: PERFORMANCE_CLIPS.underhand,
          duration: 30,
          interruptible: true,
          phases: [
            { at: 1 / 240 / clip.duration, state: 'windup' },
            { at: 1 / 120 / clip.duration, state: 'drive' },
          ],
        },
      ],
    });
    actions.set('passARecover', {
      name: 'passARecover',
      priority: 4,
      segments: [
        {
          state: 'recover',
          clip: PERFORMANCE_CLIPS.recoverWatch,
          interruptible: true,
        },
      ],
    });
    this.performance.onEvent((event) => {
      if (event.name === 'OBJECT_RELEASED') this.releasedThisStep = true;
    });

    const bones = this.native.bones;
    this.gait = new StepGait(START.x, {
      L: bones.get('foot_target_L')!.origin.x * this.nominalScale,
      R: bones.get('foot_target_R')!.origin.x * this.nominalScale,
    });
    const object = { kind: 'bag', owner: 'p0', x: 0, y: 0 };
    this.heldBag = createVisualObject(this, { id: 'held', ...object }, 0);
    this.heldBag.setLayer?.(rig.heldObjectLayer);
    this.thrownBag = createVisualObject(this, { id: 'thrown', ...object }, 0);
    this.thrownBag.setVisible(false);
    this.readHand();
    this.presentBag();
    this.ready = true;
    this.events.emit('proto-ready');
  }
  update(_time: number, delta: number) {
    if (!this.live || !this.ready) return;
    this.accumulator = Math.min(this.accumulator + delta / 1000, 0.1);
    while (this.accumulator >= FIXED_DT - 1e-9) {
      this.accumulator -= FIXED_DT;
      this.tick();
    }
  }

  private clipTime() {
    return this.performance.graph.get('action')?.time ?? 0;
  }
  private enterClip(clipTime: number) {
    const clip = this.runtime.clips.get(PERFORMANCE_CLIPS.underhand)!;
    // Same request the controller makes for a segment, at a clip phase.
    this.performance.graph.request(
      { ...clip, layer: 'action', priority: 10 },
      true,
      clipTime / clip.duration,
    );
  }
  private startThrow() {
    this.performance.cancel();
    const id = this.performance.perform('passAThrow', {
      objectId: 'held',
      queue: false,
    });
    if (id === null) return;
    this.recovering = false;
    this.enterClip(this.clock.press());
    this.pressFrame = this.frame;
    this.keyUpFrame = null;
    this.releaseFrame = null;
  }
  private endThrow() {
    this.clock.reset();
    this.performance.cancel();
    this.recovering =
      this.performance.perform('passARecover', { queue: false }) !== null;
  }

  /** One fixed 1/60 s step. */
  tick() {
    const charge = this.input_.charge > 0.5,
      dt = FIXED_DT;
    this.releasedThisStep = false;
    const committed = this.clock.active && !this.clock.interruptible;
    if (
      charge &&
      !this.wasCharging &&
      this.bag.state === 'held' &&
      !committed
    )
      this.startThrow();
    if (this.clock.active) {
      const before = this.clock.phase;
      const step = this.clock.step(charge);
      if (
        this.keyUpFrame === null &&
        step.phase === 'drive' &&
        (before === 'backswing' || before === 'hang')
      )
        this.keyUpFrame = this.frame;
      for (const op of step.ops)
        if ('enter' in op) this.enterClip(op.enter);
        else this.performance.advance(op.advance);
      if (Math.abs(this.clipTime() - this.clock.clip) > 1e-4)
        throw Error(
          `Clock/clip disagreement: ${this.clock.clip} vs ${this.clipTime()}`,
        );
    } else this.performance.advance(dt);
    // Recover into movement: once the follow-through has peaked, a move
    // intent hands the body to the shipped recover clip while the feet go.
    const moveIntent = Math.abs(this.input_.move) > 0.2;
    if (
      this.clock.phase === 'done' ||
      (this.clock.active && this.clock.interruptible && moveIntent)
    )
      this.endThrow();
    if (this.recovering && this.performance.segmentClip === null)
      this.recovering = false;

    const rooted = this.clock.active;
    this.gait.step(rooted ? 0 : this.input_.move);
    this.rig.root.setPosition(this.gait.x, START.y);
    this.applyFeet();

    const previous = this.hand;
    this.readHand();
    this.handVelocity = {
      x: (this.hand.x - previous.x) / dt,
      y: (this.hand.y - previous.y) / dt,
    };
    this.stepBag();
    this.presentBag();
    this.wasCharging = charge;
    this.frame++;
  }

  /** Write the planner's world foot plants to the existing IK targets, as
   * offsets from their bind (the adapter zeroes offsets every evaluation).
   * At rest in the stance both offsets are exactly zero and nothing changes. */
  private applyFeet() {
    const { bones, actor } = this.native,
      s = this.nominalScale;
    let moved = false;
    for (const side of ['L', 'R'] as Side[]) {
      const foot = this.gait.feet[side],
        bone = bones.get('foot_target_' + side)!,
        x = (foot.x - this.gait.x) / s - bone.origin.x,
        y = -foot.lift / s;
      if (Math.abs(x) < 1e-6 && y === 0) continue;
      bone.offset.x = x;
      bone.offset.y = y;
      bone.invalidUpdate();
      moved = true;
    }
    if (!moved) return;
    actor.armature.advanceTime(0);
    // Same soft knee reach the adapter applies, for the moved targets.
    const local = (name: string) => {
      const m = bones.get(name)!.globalTransformMatrix;
      return { x: m.tx, y: m.ty };
    };
    const drop = softReachDrop(
      (['L', 'R'] as const).map((side) => ({
        hip: local('thigh_' + side),
        ankle: local('foot_target_' + side),
        length:
          bones.get('thigh_' + side)!.boneData.length +
          bones.get('shin_' + side)!.boneData.length,
      })),
    );
    if (drop > 0) {
      const pelvis = bones.get('pelvis')!;
      pelvis.offset.y += drop;
      pelvis.invalidUpdate();
      actor.armature.advanceTime(0);
    }
  }
  private readHand() {
    const hand = this.runtime.attachment('rightHand');
    this.hand = { x: hand.x, y: hand.y, angle: hand.angle };
  }
  private worldBone(name: string) {
    const m = this.native.bones.get(name)!.globalTransformMatrix,
      p = this.native.actor
        .getWorldTransformMatrix()
        .transformPoint(m.tx, m.ty);
    return { x: p.x, y: p.y };
  }
  private stepBag() {
    const bag = this.bag,
      target = precisionTarget(),
      touchdown = {
        x: target.x - TOUCHDOWN_SHORT * BOARD_AXIS.x,
        y: target.y - TOUCHDOWN_SHORT * BOARD_AXIS.y,
      };
    if (this.releasedThisStep && bag.state === 'held') {
      // The bag leaves from the drawn hand on the release step.
      const T = FLIGHT.seconds;
      this.releaseFrame = this.frame;
      Object.assign(bag, {
        state: 'flight',
        age: 0,
        origin: { x: this.hand.x, y: this.hand.y },
        velocity: {
          x: (touchdown.x - this.hand.x) / T,
          y: (touchdown.y - this.hand.y) / T - (FLIGHT.gravity * T) / 2,
        },
        angle: this.hand.angle,
        spin: this.hand.angle,
      });
    } else if (bag.state === 'flight') bag.age += FIXED_DT;
    else if (bag.state === 'slide' || bag.state === 'rest') bag.age += FIXED_DT;
    if (bag.state === 'held') {
      Object.assign(bag, this.hand);
      return;
    }
    if (bag.state === 'flight') {
      const t = Math.min(bag.age, FLIGHT.seconds),
        o = bag.origin!,
        v = bag.velocity!;
      bag.x = o.x + v.x * t;
      bag.y = o.y + v.y * t + (FLIGHT.gravity * t * t) / 2;
      // The hand's angle settles to level over the first part of the flight.
      bag.angle = bag.spin * Math.max(0, 1 - t / 0.35);
      if (bag.age >= FLIGHT.seconds) {
        bag.state = 'slide';
        bag.age = 0;
      }
    }
    if (bag.state === 'slide') {
      const u = Math.min(1, (bag.age * 60) / FLIGHT.slideSteps),
        along = FLIGHT.slide * (1 - (1 - u) * (1 - u));
      bag.x = touchdown.x + along * BOARD_AXIS.x;
      bag.y = touchdown.y + along * BOARD_AXIS.y;
      bag.angle = 0.08 * u;
      if (u >= 1) {
        bag.state = 'rest';
        bag.age = 0;
      }
    }
    // A new bag is in hand once the throw is over and Doug has stood still.
    this.idleSteps =
      bag.state === 'rest' &&
      !this.clock.active &&
      !this.recovering &&
      this.gait.settled
        ? this.idleSteps + 1
        : 0;
    if (this.idleSteps >= 20) {
      bag.state = 'held';
      this.idleSteps = 0;
      Object.assign(bag, this.hand);
    }
  }
  private presentBag() {
    const bag = this.bag,
      held = bag.state === 'held';
    this.heldBag.setVisible(held);
    if (held)
      this.heldBag.update({
        id: 'held',
        kind: 'bag',
        x: this.hand.x,
        y: this.hand.y,
        angle: this.hand.angle,
      });
    // The previous bag stays on the board while the next one is in hand.
    if (!held) {
      this.thrownBag.setVisible(true);
      this.thrownBag.update({
        id: 'thrown',
        kind: 'bag',
        x: bag.x,
        y: bag.y,
        angle: bag.angle,
        flatten: bag.state === 'flight' ? BAG_FLIGHT_FLATTEN : BAG_REST_FLATTEN,
      });
    }
  }

  state() {
    const round = (p: Vec) => ({
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
    });
    const graph = this.performance.graph.get('action');
    const phase = this.clock.active
      ? this.clock.phase
      : this.recovering
        ? this.gait.settled
          ? 'recover'
          : 'recover+step'
        : this.gait.settled
          ? 'idle'
          : 'step';
    return {
      frame: this.frame,
      phase,
      chargeSteps: this.clock.chargeSteps,
      /** Planned key-up -> release in fixed steps. */
      releaseSteps: this.clock.releaseSteps,
      pressFrame: this.pressFrame,
      keyUpFrame: this.keyUpFrame,
      /** Frame index whose step released the bag. */
      releaseFrame: this.releaseFrame,
      mirrored: this.clock.mirrored,
      clip: graph?.clip.id ?? 'idle',
      clipTime: graph?.time ?? 0,
      clipRate: this.clock.active ? this.clock.rate : 1,
      performanceState: this.performance.state,
      root: { x: this.gait.x, v: this.gait.v },
      gait: this.gait.mode,
      hand: round(this.hand),
      handVelocity: round(this.handVelocity),
      /** foot_L is the near/back leg, foot_R the far/front leg. */
      ankles: {
        back: round(this.worldBone('foot_L')),
        front: round(this.worldBone('foot_R')),
      },
      plants: {
        back: { ...this.gait.feet.L, swing: !!this.gait.feet.L.swing },
        front: { ...this.gait.feet.R, swing: !!this.gait.feet.R.swing },
      },
      bag: { state: this.bag.state, ...round(this.bag) },
    };
  }
}
