import * as Phaser from 'phaser';
import {
  NativeFactory,
  type NativeArmature,
} from '../loongbones/NativeFactory';
import { NativeMesh } from '../loongbones/NativeMesh';
import { dragonBones as db } from '../loongbones/vendor/dragonBones';
import type { WeightedRigDefinition } from '../loongbones/arena/RigDefinition';
import { buildMotionLibrary } from './authoring';
import {
  SIDE_RIG_BONES,
  validateHumanRig,
} from '../../lib/arena/engine/motion/HumanSkeleton';
import type { MotionPlanner } from '../../lib/arena/engine/motion/MotionPlanner';
import type { CharacterMotor } from '../../lib/arena/engine/movement/CharacterMotor';
import { FootLock } from '../../lib/arena/engine/movement/FootLock';
import {
  OrganicMotion,
  PERFORMANCE_BONES,
} from '../../lib/arena/engine/motion/OrganicMotion';
import { motionProfiles } from '../../lib/arena/engine/motion/MotionTypes';
import { InertialPose } from './InertialPose';
import { anatomy } from '../loongbones/side-rig/anatomy';
import {
  contactRoll,
  rolledAnkle,
} from '../../lib/arena/engine/motion/FootContactRoll';
import { repairFootMaterial } from './FootMaterialRepair';
import { registerArmMaterial } from './ArmMaterialRegistration';
import { restoreFarArm } from './FarArmMaterial';
import {
  addHandAttachments,
  applyHandExposure,
  compileHandExposures,
  handAtlas,
  newHandSlots,
} from './HandAttachments';
import { chestContactWeight } from '../../lib/arena/engine/motion/ContactEnvelope';
import { assertInterchangeBudget } from '../loongbones/side-rig/limits';
import { NativeRigIntegrity } from './NativeRigIntegrity';
import { DirectionalSkin } from './DirectionalSkin';
import {
  supportCompression,
  type SupportedLeg,
} from '../../lib/arena/engine/motion/SupportAdjustment';
import {
  clamp,
  type MotionEvent,
  type Vec2,
  type MotionPose,
} from '../../lib/arena/engine/motion/MotionTypes';
const layers = { base: 0, action: 1, gaze: 2, personality: 3, reaction: 4 };
/** Native fades persist across ticks. No reset/gotoAndStop in normal playback. */
export class NativeAnimator {
  readonly actor: NativeArmature;
  readonly factory: NativeFactory;
  readonly library: ReturnType<typeof buildMotionLibrary>;
  private readonly authoringData: object;
  readonly feet = new FootLock();
  readonly validation: ReturnType<typeof validateHumanRig>;
  private states = new Map<
    string,
    { revision: number; state: db.AnimationState }
  >();
  readonly performance: OrganicMotion;
  readonly inertia = new InertialPose();
  organicEnabled = true;
  private supportLowering = 0;
  private releasedFeet = new Map<
    string,
    { x: number; y: number; age: number }
  >();
  private previousFeet = new Map<string, Vec2>();
  private groundOffsets = new Map<string, number>();
  private touchdowns = new Map<string, { from: Vec2; age: number }>();
  private contactPoses = new Map<
    string,
    { ankle: Vec2; anchor: Vec2; region: string; angle: number; pivot: Vec2 }
  >();
  private footVectors: Record<string, { heel: Vec2; toe: Vec2 }> = {};
  private handInfluence = 0;
  twoHandError = 0;
  nativeEvents: { name: string; clip: string }[] = [];
  starts = 0;
  ticks = 0;
  private silhouette = false;
  readonly repairedFootWeights: number;
  readonly registeredArmVertices: number;
  readonly integrity: NativeRigIntegrity;
  readonly directional?: DirectionalSkin;
  private soleOwners: ('left' | 'right' | null)[] = [];
  constructor(
    scene: Phaser.Scene,
    readonly definition: WeightedRigDefinition,
    options: {
      forwardKnees?: boolean;
      stance?: { right: number; left: number };
      directional?: boolean;
    } = {},
  ) {
    this.performance = new OrganicMotion(
      motionProfiles[definition.id as 'dan' | 'doug'],
    );
    const landmarks = anatomy(definition.id as 'dan' | 'doug').joints;
    for (const side of ['L', 'R']) {
      const ankle = landmarks.find((j) => j.name === 'foot_' + side)!.point;
      const vector = (name: string) => {
        const p = landmarks.find((j) => j.name === name + '_' + side)!.point;
        return { x: p.x - ankle.x, y: p.y - ankle.y };
      };
      this.footVectors[side === 'L' ? 'right' : 'left'] = {
        heel: vector('heel'),
        toe: vector('toe'),
      };
    }
    const data = structuredClone(
      scene.cache.json.get(definition.key + '-skeleton'),
    );
    const arm = data.armature[0];
    this.repairedFootWeights = repairFootMaterial(definition.id, arm);
    this.registeredArmVertices = registerArmMaterial(definition.id, arm);
    restoreFarArm(definition.id as 'dan' | 'doug', arm);
    addHandAttachments(definition.id as 'dan' | 'doug', arm);
    const body = arm.skin[0].slot.find(
      (s: { name: string }) => s.name === 'body',
    ).display[0];
    for (let i = 0; i < body.weights.length;) {
      const count = body.weights[i];
      let owner: 'left' | 'right' | null = null,
        strongest = 0;
      for (let j = 0; j < count; j++) {
        const bone = arm.bone[body.weights[i + 1 + j * 2]].name,
          weight = body.weights[i + 2 + j * 2];
        if (weight > strongest && ['foot_L', 'foot_R'].includes(bone)) {
          owner = bone === 'foot_L' ? 'right' : 'left';
          strongest = weight;
        }
      }
      this.soleOwners.push(owner);
      i += 1 + count * 2;
    }
    if (options.forwardKnees) {
      const far = arm.ik.find((c: { name: string }) => c.name === 'plant_R');
      if (far) far.bendPositive = true;
    }
    this.library = buildMotionLibrary(
      definition.id as 'dan' | 'doug',
      arm.animation,
    );
    compileHandExposures(this.library);
    // Event stance places effectors relative to the pelvis. Skin bind matrices,
    // anatomical bones and limb lengths remain unchanged.
    if (options.stance) {
      for (const side of ['right', 'left'] as const) {
        const name = 'foot_target_' + (side === 'right' ? 'L' : 'R');
        const target = arm.bone.find((b: { name: string }) => b.name === name);
        const delta = options.stance[side] - target.transform.x;
        target.transform.x += delta;
        // Measured locomotion already owns its foot placement in canonical bind space.
        for (const c of this.library.native.filter((c) =>
          ['v2_walk', 'v2_jog', 'v2_run', 'v2_sprint'].includes(c.name),
        ))
          for (const t of c.bone ?? [])
            if (t.name === name)
              for (const k of (t.translateFrame ?? []) as { x: number }[])
                k.x -= delta;
      }
    }
    arm.animation = this.library.native;
    this.validation = validateHumanRig(
      arm.bone.map((b: { name: string }) => b.name),
    );
    if (!this.validation.valid)
      throw Error(
        'Human rig missing ' +
          this.validation.missing.map((m) => m.semantic).join(', '),
      );
    // Optional two-hand target. Existing topology and anatomical bind transforms stay untouched.
    arm.bone.push({
      name: 'equipment_target',
      parent: 'root',
      transform: { x: 0, y: -230 },
    });
    arm.ik.push({
      name: 'equipment_hand',
      bone: 'forearm_R',
      target: 'equipment_target',
      chain: 1,
      bendPositive: false,
      weight: 0,
    });
    arm.bone.push(
      { name: 'chest_contact', parent: 'chest', transform: { x: -37, y: 34 } },
      { name: 'chest_target', parent: 'root', transform: { x: 0, y: -300 } },
    );
    arm.ik.push({
      name: 'chest_hand',
      bone: 'forearm_L',
      target: 'chest_target',
      chain: 1,
      bendPositive: false,
      weight: 0,
    });
    this.authoringData = structuredClone(data);
    assertInterchangeBudget(arm.skin[0].slot.map((s: any) => s.display[0]));
    this.factory = new NativeFactory(scene);
    this.factory.parseDragonBonesData(data, definition.key + '-human-v2');
    this.factory.parseTextureAtlasData(
      scene.cache.json.get(definition.key + '-atlas'),
      definition.key + '-texture',
      definition.key + '-human-v2',
    );
    this.factory.parseTextureAtlasData(
      handAtlas,
      'arena-hands-v1',
      definition.key + '-human-v2',
    );
    this.actor = this.factory.build(
      definition.armature,
      definition.key + '-human-v2',
    );
    this.actor.setScale(definition.scale).setDepth(40);
    this.integrity = new NativeRigIntegrity(this.actor, arm);
    if (options.directional)
      this.directional = new DirectionalSkin(
        scene,
        definition.id,
        definition.key + '-texture',
      );
    this.actor.on(db.EventObject.FRAME_EVENT, (event: db.EventObject) => {
      this.nativeEvents.push({
        name: event.name,
        clip: event.animationState?.name ?? '',
      });
      this.nativeEvents = this.nativeEvents.slice(-32);
    });
    this.tint();
  }
  private tint() {
    for (const mesh of this.actor.list)
      if (mesh instanceof NativeMesh)
        mesh.setTint(this.silhouette ? 0x000000 : 0xfff2df);
  }
  setSilhouette(value: boolean) {
    this.silhouette = value;
    this.tint();
  }
  joint(name: string): Vec2 {
    const native = SIDE_RIG_BONES[name as keyof typeof SIDE_RIG_BONES] ?? name;
    const b = this.actor.armature.getBone(native);
    if (!b) throw Error('Missing joint ' + name);
    const m = b.globalTransformMatrix;
    return this.actor.getWorldTransformMatrix().transformPoint(m.tx, m.ty);
  }
  hand() {
    const b = this.actor.armature.getBone('throwing_hand')!;
    return {
      ...this.joint('rightHand'),
      angle: Math.atan2(
        b.globalTransformMatrix.b,
        b.globalTransformMatrix.a * (this.directional?.facing ?? 1),
      ),
    };
  }
  floorPoint(side: string, motor: CharacterMotor): Vec2 {
    return {
      x: this.joint(side + 'Ankle').x + 7,
      y: motor.position.y + (this.groundOffsets.get(side) ?? -14) + 14,
    };
  }
  anchors() {
    const hand = this.hand(),
      left = this.joint('leftHand');
    const depth =
      this.definition.scale /
      (371 / (this.definition.id === 'dan' ? 1215 : 1191));
    return {
      rightHand: hand,
      leftHand: { ...left, angle: 0 },
      twoHandGrip: {
        x: hand.x + 5 * depth,
        y: hand.y - 12 * depth,
        angle: hand.angle,
      },
    };
  }
  private offsetTarget(name: string, world: Vec2, influence = 1) {
    const b = this.actor.armature.getBone(name)!;
    const origin = b.origin!;
    b.offset.x =
      ((world.x - this.actor.x) / this.actor.scaleX -
        origin.x -
        b.animationPose.x) *
      influence;
    b.offset.y =
      ((world.y - this.actor.y) / this.definition.scale -
        origin.y -
        b.animationPose.y) *
      influence;
    b.invalidUpdate();
  }
  private constraintWeight(name: string, weight: number) {
    // Audited pinned DragonBones 5.5 bridge: the only native weight setter is internal.
    const c = this.actor.armature._constraints.find((c) => c.name === name) as
      | db.IKConstraint
      | undefined;
    if (!c || !('_weight' in c))
      throw Error('Pinned IK bridge incompatible: ' + name);
    c._weight = clamp(weight, 0, 1);
    c.invalidUpdate();
  }
  private releaseExposure() {
    // Pinned native color timeline can remain just below an integer frame at
    // a floating-point marker boundary. Commit the discrete hand change in
    // the same step as equipment release; do not advance the animation clock.
    for (const name of ['grip', 'open', 'relaxed']) {
      const slot = this.actor.armature.getSlot(name);
      if (!slot) throw Error('Missing registered hand exposure ' + name);
      const color = new db.ColorTransform();
      color.copyFrom(slot._colorTransform);
      color.alphaMultiplier = name === 'open' ? 1 : 0;
      slot._setColor(color);
    }
    this.actor.armature.advanceTime(0);
  }
  advance(
    planner: MotionPlanner,
    motor: CharacterMotor,
    dt: number,
    events: MotionEvent[],
    time: number,
    aim: Vec2,
    twoHand = false,
    target?: Vec2,
    landingCompression = 0,
  ) {
    if (this.directional) {
      if (this.directional.facing !== motor.facing) {
        this.feet.clear();
        this.previousFeet.clear();
        this.touchdowns.clear();
        this.releasedFeet.clear();
      }
      this.actor.setScale(
        this.definition.scale * motor.facing,
        this.definition.scale,
      );
      this.directional.apply(this.actor, motor.facing);
    }
    this.actor
      .setPosition(motor.position.x, motor.position.y - motor.height)
      .setDepth(30 + motor.position.y * 0.02);
    const active = planner.graph.active(),
      existing = new Set(active.map((s) => s.clip.layer));
    for (const [layer, entry] of this.states)
      if (!existing.has(layer as keyof typeof layers)) {
        entry.state.fadeOut(0.14, false);
        this.states.delete(layer);
      }
    for (const s of active) {
      let entry = this.states.get(s.clip.layer);
      if (entry?.revision !== s.revision) {
        const state = this.actor.animation.fadeIn(
          s.clip.native,
          s.clip.fade,
          s.clip.loop ? 0 : 1,
          layers[s.clip.layer],
          s.clip.layer,
          db.AnimationFadeOutMode.SameGroup,
        )!;
        if (!state) throw Error('Native clip unavailable ' + s.clip.native);
        // DragonBones defaults to a paused playhead during fade-in. A game
        // action must advance while blending or release/contacts lag its clock.
        state.play();
        // Unkeyed channels belong to lower layers. Reset-to-bind channels can
        // suddenly replace the running arm/leg pose when a fade completes.
        state.resetToPose = false;
        if (s.clip.mask) {
          state.displayControl = false;
          for (const bone of s.clip.mask) state.addBoneMask(bone, true);
        }
        state.currentTime = Math.max(0, s.time - dt * s.rate) % s.clip.duration;
        entry = { revision: s.revision, state };
        this.states.set(s.clip.layer, entry);
        this.starts++;
      }
      entry.state.timeScale = s.rate;
    }
    // Clear only bounded procedural offsets, never authored transforms.
    for (const name of [
      'foot_target_L',
      'foot_target_R',
      'foot_L',
      'foot_R',
      ...PERFORMANCE_BONES,
    ]) {
      const b = this.actor.armature.getBone(name)!;
      b.offset.identity();
      b.invalidUpdate();
    }
    this.constraintWeight('equipment_hand', 0);
    this.constraintWeight('chest_hand', 0);
    this.factory.runtime.advanceTime(dt);
    this.ticks++;
    const gait = planner.graph.get('base');
    const locomoting =
      gait?.clip.gait &&
      !planner.graph.get('action') &&
      !planner.graph.get('reaction');
    if (locomoting && planner.strideFit) {
      for (const side of ['right', 'left']) {
        const ankle = this.joint(side + 'Ankle'),
          hip = this.joint(side + 'Hip');
        this.offsetTarget('foot_target_' + (side === 'right' ? 'L' : 'R'), {
          x:
            hip.x +
            (ankle.x - hip.x) *
              planner.strideFit.reachScale *
              planner.profile.strideScale,
          y: this.groundOffsets.has(side)
            ? motor.position.y +
              this.groundOffsets.get(side)! +
              (ankle.y - motor.position.y - this.groundOffsets.get(side)!) *
                planner.gaitResponse.liftScale
            : ankle.y,
        });
      }
      // Acceleration inclines the whole support chain through a small pelvis shift.
      const viewDirection = Math.sign(this.actor.scaleX);
      const lean = planner.gaitResponse.lean * viewDirection;
      const pelvis = this.actor.armature.getBone('pelvis')!;
      pelvis.offset.x += lean * 300;
      pelvis.offset.rotation += lean;
      pelvis.invalidUpdate();
      const chest = this.actor.armature.getBone('chest')!;
      chest.offset.rotation += planner.gaitResponse.chest * viewDirection;
      chest.invalidUpdate();
      this.actor.armature.advanceTime(0);
    }
    if (this.organicEnabled) {
      for (const e of events)
        if (e.name === 'land') this.performance.impulse(0.65);
      const state =
        planner.graph.get('reaction') ??
        planner.graph.get('action') ??
        planner.graph.get('base');
      const adjustment = this.performance.update({
        state,
        pose: this.pose(time, motor),
        dt,
        time,
        grounded: motor.grounded,
        contacts: ['right', 'left'].filter((s) => !!this.feet.target(s)),
        velocity: motor.velocity,
        acceleration: motor.acceleration,
        facing: Math.sign(this.actor.scaleX),
        aim,
        target,
        recoverySeconds: planner.recovery.seconds,
      });
      this.inertia.apply(
        this.actor.armature,
        active
          .filter((s) => s.clip.layer !== 'personality')
          .map((s) => s.revision)
          .join(':'),
        dt,
        planner.recovery.seconds,
      );
      for (const [name, offset] of Object.entries(adjustment)) {
        const b = this.actor.armature.getBone(name)!;
        b.offset.x += offset.x;
        b.offset.y += offset.y;
        b.offset.rotation += offset.rotation;
        b.invalidUpdate();
      }
      this.actor.armature.advanceTime(0);
    }
    if (!this.groundOffsets.size)
      for (const side of ['right', 'left'])
        this.groundOffsets.set(
          side,
          this.joint(side + 'Ankle').y - motor.position.y,
        );
    // Capture contact at the evaluated native pose, then preserve its world target above moving roots.
    for (const e of events)
      if (e.foot) {
        if (e.name === 'footPlant') {
          const from =
            this.previousFeet.get(e.foot) ?? this.joint(e.foot + 'Ankle');
          const point = {
            x: from.x,
            y: motor.position.y + this.groundOffsets.get(e.foot)!,
          };
          if (Math.abs(motor.velocity.x) > 6) {
            // Place the upcoming support under the moving hip, within this
            // character's actual leg reach; do not lock an airborne trailing foot.
            const hip = this.joint(e.foot + 'Hip'),
              knee = this.joint(e.foot + 'Knee'),
              ankle = this.joint(e.foot + 'Ankle');
            const length =
              Math.hypot(knee.x - hip.x, knee.y - hip.y) +
              Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
            const reach = Math.sqrt(
              Math.max(0, (length * 0.995) ** 2 - (point.y - hip.y) ** 2),
            );
            const horizon = planner.graph.get('action') ? 0.04 : 0.1;
            point.x =
              hip.x +
              clamp(motor.velocity.x * horizon, -reach * 0.75, reach * 0.75);
          }
          if (
            !this.feet.target(e.foot) &&
            Math.hypot(from.x - point.x, from.y - point.y) > 3
          )
            this.touchdowns.set(e.foot, { from, age: 0 });
          this.feet.plant(e.foot, point);
          this.releasedFeet.delete(e.foot);
        } else if (e.name === 'footRelease') {
          this.touchdowns.delete(e.foot);
          const old = this.previousFeet.get(e.foot),
            now = this.joint(e.foot + 'Ankle');
          if (old)
            this.releasedFeet.set(e.foot, {
              x: old.x - now.x,
              y: old.y - now.y,
              age: 0,
            });
          this.feet.release(e.foot);
        }
      }
    if (!motor.grounded) {
      for (const side of ['right', 'left']) {
        if (this.feet.target(side)) {
          const old = this.previousFeet.get(side),
            now = this.joint(side + 'Ankle');
          if (old)
            this.releasedFeet.set(side, {
              x: old.x - now.x,
              y: old.y - now.y,
              age: 0,
            });
        }
      }
      this.feet.clear();
      this.touchdowns.clear();
    }
    this.contactPoses.clear();
    for (const side of ['right', 'left']) {
      const target = this.feet.target(side),
        native = 'foot_target_' + (side === 'right' ? 'L' : 'R');
      if (target) {
        const foot = this.actor.armature.getBone(
          'foot_' + (side === 'right' ? 'L' : 'R'),
        )!;
        const action =
          planner.graph.get('reaction') ?? planner.graph.get('action') ?? gait;
        const roll = contactRoll(
          action?.clip.footContactRoll ? foot.animationPose.rotation : 0,
        );
        foot.offset.rotation = roll.radians - foot.animationPose.rotation;
        foot.invalidUpdate();
        const v =
          this.footVectors[side][roll.region === 'heel' ? 'heel' : 'toe'];
        const pivot = {
          x: v.x * this.actor.scaleX,
          y: v.y * this.definition.scale,
        };
        const angle = roll.radians * Math.sign(this.actor.scaleX);
        const supported = rolledAnkle(target, pivot, angle);
        this.contactPoses.set(side, {
          ankle: supported,
          anchor: { x: target.x, y: target.y },
          region: roll.region,
          angle,
          pivot,
        });
        const touchdown = this.touchdowns.get(side);
        if (touchdown) {
          touchdown.age += dt;
          const t = Math.min(1, touchdown.age / 0.075),
            blend = t * t * (3 - 2 * t);
          this.feet.setInfluence(side, blend);
          this.offsetTarget(native, {
            x: touchdown.from.x + (supported.x - touchdown.from.x) * blend,
            y: touchdown.from.y + (supported.y - touchdown.from.y) * blend,
          });
          if (t === 1) this.touchdowns.delete(side);
        } else this.offsetTarget(native, supported);
      } else {
        const released = this.releasedFeet.get(side);
        if (released) {
          released.age += dt;
          const decay = Math.exp(-released.age / 0.065),
            now = this.joint(side + 'Ankle');
          this.offsetTarget(native, {
            x: now.x + released.x * decay,
            y: now.y + released.y * decay,
          });
          if (decay < 0.005) this.releasedFeet.delete(side);
        }
      }
    }
    // Preserve foot targets when a run settles into a taller standing pose.
    // Lower the pelvis within the real leg reach instead of stretching shins
    // or silently moving the planted ankle. Release this correction gradually.
    const legs: SupportedLeg[] = [];
    for (const side of ['right', 'left']) {
      const target = this.feet.target(side);
      if (target && target.influence >= 0.999)
        legs.push({
          hip: this.joint(side + 'Hip'),
          knee: this.joint(side + 'Knee'),
          ankle: this.joint(side + 'Ankle'),
          target: this.contactPoses.get(side)?.ankle ?? target,
        });
    }
    // First-step support can outlast a gait change during acceleration. Allow
    // a bounded athletic knee load instead of exhausting the idle 8px budget.
    const needed = motor.grounded
      ? supportCompression(legs, locomoting ? 16 : 8)
      : 0;
    this.supportLowering = Math.max(
      needed,
      this.supportLowering * Math.exp(-dt / 0.09),
    );
    const pelvis = this.actor.armature.getBone('pelvis')!;
    pelvis.offset.y +=
      (this.supportLowering + landingCompression) / this.definition.scale;
    pelvis.invalidUpdate();
    this.actor.armature.advanceTime(0);
    this.handInfluence +=
      (Number(twoHand) - this.handInfluence) * (1 - Math.exp(-dt / 0.07));
    if (this.handInfluence > 0.005) {
      const hand = this.anchors().twoHandGrip,
        depth =
          this.definition.scale /
          (371 / (this.definition.id === 'dan' ? 1215 : 1191)),
        desired = { x: hand.x - 16 * depth, y: hand.y + 5 * depth },
        palm = this.joint('leftHand'),
        wrist = this.joint('leftWrist');
      let target = {
        x: desired.x - (palm.x - wrist.x),
        y: desired.y - (palm.y - wrist.y),
      };
      this.constraintWeight('equipment_hand', this.handInfluence);
      for (let i = 0; i < 4; i++) {
        this.offsetTarget('equipment_target', target);
        this.actor.armature.advanceTime(0);
        const p = this.joint('leftHand');
        target = {
          x: target.x + (desired.x - p.x) * 0.75,
          y: target.y + (desired.y - p.y) * 0.75,
        };
      }
      const p = this.joint('leftHand');
      this.twoHandError = Math.hypot(p.x - desired.x, p.y - desired.y);
    }
    const gesture = planner.graph.get('reaction');
    if (gesture?.clip.id === 'gesture.chestTap') {
      const influence = chestContactWeight(gesture.time);
      if (influence > 0) {
        const contact = this.joint('chest_contact');
        this.constraintWeight('chest_hand', influence);
        let wrist = this.joint('rightWrist');
        let palm = this.actor.socket('hand_L', 20, 0);
        let desired = {
          x: contact.x - palm.x + wrist.x,
          y: contact.y - palm.y + wrist.y,
        };
        for (let i = 0; i < 4; i++) {
          this.offsetTarget('chest_target', desired);
          this.actor.armature.advanceTime(0);
          palm = this.actor.socket('hand_L', 20, 0);
          desired = {
            x: desired.x + (contact.x - palm.x) * 0.7,
            y: desired.y + (contact.y - palm.y) * 0.7,
          };
        }
      }
    }
    if (events.some((e) => e.name === 'equipmentRelease'))
      this.releaseExposure();
    applyHandExposure(
      this.actor.armature,
      planner.graph.get('reaction') ??
        planner.graph.get('action') ??
        planner.graph.get('base'),
      twoHand && !events.some((e) => e.name === 'equipmentRelease'),
    );
    this.tint();
    this.directional?.apply(this.actor, motor.facing);
    for (const side of ['right', 'left']) {
      const p = this.joint(side + 'Ankle');
      const contact = this.contactPoses.get(side);
      // Measure support-frame error; intended ankle roll is not foot sliding.
      this.feet.measure(
        side,
        contact
          ? {
              x: p.x - contact.ankle.x + contact.anchor.x,
              y: p.y - contact.ankle.y + contact.anchor.y,
            }
          : p,
        dt,
      );
      this.previousFeet.set(side, p);
    }
    const pose = this.pose(time, motor);
    this.performance.measure(
      pose,
      motor.grounded,
      ['right', 'left'].filter((s) => !!this.feet.target(s)),
    );
    const torso = Math.max(
      1,
      Math.hypot(
        pose.joints.chest.x - pose.joints.pelvis.x,
        pose.joints.chest.y - pose.joints.pelvis.y,
      ),
    );
    planner.observePose({
      handHeight: (pose.joints.pelvis.y - pose.joints.rightHand.y) / torso,
      chestPitch: Math.atan2(
        pose.joints.chest.x - pose.joints.pelvis.x,
        pose.joints.pelvis.y - pose.joints.chest.y,
      ),
      speed: Math.hypot(motor.velocity.x, motor.velocity.y),
      footPhase:
        ((planner.graph.get('base')?.time ?? 0) /
          (planner.graph.get('base')?.clip.duration ?? 1)) %
        1,
    });
    return pose;
  }
  pose(time: number, motor: CharacterMotor): MotionPose {
    const joints = Object.fromEntries(
      Object.keys(SIDE_RIG_BONES).map((name) => [name, this.joint(name)]),
    );
    const p = joints.pelvis,
      c = joints.chest;
    return {
      time,
      joints,
      root: { ...motor.position },
      massProxy: { x: p.x * 0.65 + c.x * 0.35, y: p.y * 0.65 + c.y * 0.35 },
    };
  }
  snapshot() {
    return {
      backend: 'native-loongbones-human-v2',
      starts: this.starts,
      ticks: this.ticks,
      validation: this.validation,
      feet: this.feet.snapshot(),
      supportContacts: Object.fromEntries(this.contactPoses),
      touchdowns: [...this.touchdowns].map(([foot, t]) => ({
        foot,
        age: t.age,
      })),
      nativeEvents: [...this.nativeEvents],
      layers: [...this.states].map(([layer, s]) => ({
        layer,
        clip: s.state.name,
        time: s.state.currentTime,
        weight: s.state.weight,
      })),
      twoHandConstraint: 'pinned-native-IK',
      twoHandError: this.twoHandError,
      handInfluence: this.handInfluence,
      supportLowering: this.supportLowering,
      handExposure: Object.fromEntries(
        ['grip', 'open', 'relaxed', ...newHandSlots, 'farHand'].map((name) => [
          name,
          this.actor.armature.getSlot(name)?._colorTransform.alphaMultiplier ??
            0,
        ]),
      ),
      performance: {
        ...this.performance.snapshot(),
        enabled: this.organicEnabled,
        inertia: this.inertia.snapshot(),
      },
      artDirection:
        'protected side-v3 art; opposite-facing garment variant when registered',
      direction: this.directional?.snapshot() ?? {
        facing: 1,
        skin: 'original-front-three-quarter',
      },
      repairedFootWeights: this.repairedFootWeights,
      registeredArmVertices: this.registeredArmVertices,
      integrity: this.integrity.snapshot(),
      editorRoundTripVerified: false,
      productionInstalled: false,
    };
  }
  /** Read-only actual sole vertices; ankle IK alone cannot validate a planted shoe. */
  soleVertices() {
    const mesh = this.actor.list.find(
      (o) => o instanceof NativeMesh && o.name === 'body',
    ) as NativeMesh | undefined;
    if (!mesh) return [];
    const matrix = this.actor.getWorldTransformMatrix();
    return mesh.vertices.flatMap((v, i) =>
      mesh.local[i * 2 + 1] > -35
        ? [
            {
              index: i,
              foot: this.soleOwners[i],
              ...matrix.transformPoint(v.vx, v.vy),
            },
          ]
        : [],
    );
  }
  destroy() {
    this.actor.dispose();
    this.factory.runtime.advanceTime(0);
    this.factory.clear(true);
  }
  exportAuthoring() {
    return structuredClone({
      schema: 'arena-loongbones-motion-upgrade-v1',
      character: this.definition.id,
      skeleton: this.authoringData,
      handAtlas,
      metadata: this.library.metadata,
      textureSources: [
        this.definition.key + '-texture',
        '/human-motion/assets/hands/hand-sheet-v1.png',
      ],
      provenance:
        'Derived Arena authoring; preserved source atlas; complete far arm registered from original isolated arm; ImageGen hand sheet v1.',
      editorRoundTripVerified: false,
      productionInstalled: false,
    });
  }
}
