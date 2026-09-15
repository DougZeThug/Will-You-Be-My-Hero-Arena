import * as Phaser from 'phaser';
import { sideDefinitions } from '../loongbones/side-rig/definitions';
import { queueRig } from '../loongbones/arena/provider';
import { queueArenaAssets } from '../../lib/arena/engine/scenes/CharacterAssetLoader';
import { Equipment } from '../../lib/arena/engine/objects/Equipment';
import { HUMAN_CHAINS } from '../../lib/arena/engine/motion/HumanSkeleton';
import { NativeAnimator } from './NativeAnimator';
import { RigDebugView } from './RigDebugView';
import { MotionSession, type ProofEvent } from './MotionSession';
import { KeyboardDevice } from '../../lib/arena/engine/input/KeyboardDevice';
import { bindingsFor } from '../../lib/arena/engine/input/InputBindings';
import { GamepadDevice } from '../../lib/arena/engine/input/GamepadDevice';
import type { BagContact } from '../../lib/arena/engine/events/cornhole/ScreenBagDynamics';
import { ArenaHud } from '../../lib/arena/engine/presentation/ArenaHud';
import { ArenaEnvironment } from '../../lib/arena/engine/presentation/ArenaEnvironment';
import {
  retargetReference,
  type ReferenceTrack,
} from '../../lib/arena/engine/motion-tools/ReferenceMotion';
export class MotionScene extends Phaser.Scene {
  session!: MotionSession;
  ready = false;
  rigDebug!: RigDebugView;
  rate = 1;
  overlay = true;
  trails = true;
  balanceView = false;
  velocityView = false;
  collisionView = false;
  equipmentView = false;
  focus: 'arena' | 'dan' | 'doug' = 'arena';
  reference?: ReferenceTrack;
  referenceOffset = 0;
  retargetOverlay = false;
  private drawing!: Phaser.GameObjects.Graphics;
  private props!: Phaser.GameObjects.Graphics;
  private shadows!: Phaser.GameObjects.Graphics;
  private equipment?: Equipment;
  private background?: Phaser.GameObjects.Image;
  private environment!: ArenaEnvironment;
  readonly presentationVersion = 2;
  hud!: ArenaHud;
  private neutral = false;
  private startingX = new Map<string, number>();
  private projectiles = new Map<number, Phaser.GameObjects.Image>();
  private held = new Map<string, Phaser.GameObjects.Image>();
  onReady = () => {};
  onState = () => {};
  onAdvance = () => {};
  private reported = 0;
  constructor(
    readonly proof: ProofEvent,
    private scope: HTMLElement,
  ) {
    super('HumanMotionV2');
  }
  preload() {
    this.load.image(
      'arena-hands-v1',
      '/human-motion/assets/hands/hand-sheet-v1.png',
    );
    sideDefinitions.forEach((d) => queueRig(this, d));
    if (this.proof === 'fighting' || this.proof === 'running')
      for (const id of ['dan', 'doug'])
        this.load.image(
          id + '-rear-source',
          `/human-motion/assets/directional/${id}-rear-source.png`,
        );
    queueArenaAssets(this);
  }
  create() {
    this.background = this.add
      .image(640, 380, 'arena-background')
      .setDisplaySize(1280, 760);
    this.shadows = this.add.graphics().setDepth(20);
    this.environment = new ArenaEnvironment(this, this.proof, 760);
    this.hud = new ArenaHud(this, 760);
    this.props = this.add.graphics().setDepth(25);
    const animators = sideDefinitions.map(
      (d, i) =>
        new NativeAnimator(
          this,
          {
            ...d,
            scale:
              d.scale *
              (this.proof === 'cornhole' || this.proof === 'basketball'
                ? i
                  ? 0.7
                  : 1
                : 0.85),
          },
          {
            forwardKnees: true,
            ...(this.proof === 'basketball'
              ? { stance: { right: -30, left: 35 } }
              : this.proof === 'cornhole'
                ? { stance: { right: -140, left: 110 } }
                : {}),
            directional: this.proof === 'fighting' || this.proof === 'running',
          },
        ),
    );
    this.session = new MotionSession(this.proof, animators);
    this.startingX = new Map(
      this.session.actors.map((a) => [a.id, a.motor.position.x]),
    );
    if (
      new URLSearchParams(location.search).get('organic') === '0' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      animators.forEach((a) => {
        a.organicEnabled = false;
      });
    if (this.proof === 'cornhole' || this.proof === 'basketball') {
      this.equipment = new Equipment(this);
      this.equipment.update(this.proof, []);
    }
    this.drawing = this.add.graphics().setDepth(80);
    this.rigDebug = new RigDebugView(this);
    this.ready = true;
    this.onReady();
    this.renderState();
    this.events.once('shutdown', () => {
      this.ready = false;
      this.session.destroy();
      this.hud.destroy();
      this.environment.destroy();
      this.equipment?.destroy();
      this.projectiles.clear();
      this.held.clear();
    });
  }
  setNeutral(enabled: boolean) {
    this.neutral = enabled;
    this.background?.setVisible(!enabled);
    this.environment?.setVisible(!enabled);
    this.hud?.setVisible(!enabled);
    this.cameras.main.setBackgroundColor(enabled ? '#d8d6cd' : '#282820');
  }
  device(kind: 'ai' | 'keyboard' | 'gamepad') {
    for (let i = 0; i < this.session.actors.length; i++) {
      const a = this.session.actors[i];
      if (kind === 'ai') this.session.ai(a.id);
      else if (kind === 'keyboard')
        this.session.assign(
          a.id,
          new KeyboardDevice(
            'motion-keyboard:' + i,
            bindingsFor(i),
            i,
            this.scope,
          ),
        );
      else this.session.assign(a.id, new GamepadDevice(i, bindingsFor(i)));
    }
  }
  update(_time: number, delta: number) {
    if (!this.ready || this.session.paused) return;
    this.session.advance((delta / 1000) * this.rate);
    this.renderState();
    this.onAdvance();
    if (!this.ready) return;
    if (_time - this.reported > 150) {
      this.reported = _time;
      this.onState();
    }
  }
  renderState() {
    this.rigDebug.render();
    const focused = this.session.actors.find((a) => a.id === this.focus);
    let zoom = 1,
      centerX = 640,
      centerY = 380;
    if (focused) {
      // Ground-anchored framing: a jump must rise inside the view, not move its
      // camera or change scale as hands extend. Reserve headroom for overhead actions.
      zoom = this.proof === 'basketball' ? 1.28 : 1.65;
      centerX = focused.motor.position.x + 60;
      centerY =
        focused.motor.position.y - (this.proof === 'basketball' ? 245 : 185);
      centerX = Phaser.Math.Clamp(centerX, 640 / zoom, 1280 - 640 / zoom);
      centerY = Phaser.Math.Clamp(centerY, 380 / zoom, 760 - 380 / zoom);
    }
    this.cameras.main.setZoom(zoom).centerOn(centerX, centerY);
    this.shadows.clear();
    this.drawing.clear();
    this.props.clear();
    for (const a of this.session.actors) {
      const state = a.analyzer.snapshot(this.trails),
        pose = state.latest ?? a.animator.pose(this.session.time, a.motor);
      for (const foot of ['left', 'right']) {
        const floor = a.animator.floorPoint(foot, a.motor);
        const depth = a.motor.verticalScale,
          air = Math.max(0.2, 1 - a.motor.height / 150);
        for (const [w, h, opacity] of [
          [58, 12, 0.055],
          [40, 7, 0.12],
          [25, 3, 0.18],
        ])
          this.shadows
            .fillStyle(0x211d20, opacity * air)
            .fillEllipse(floor.x, floor.y, w * depth, h * depth);
      }
      if (this.overlay) {
        this.drawing.lineStyle(2, a.id === 'dan' ? 0x23dcdc : 0xfbd446, 0.8);
        for (const chain of HUMAN_CHAINS) {
          const points = chain.map((name) => pose.joints[name]).filter(Boolean);
          this.drawing.strokePoints(points, false);
        }
        for (const p of Object.values(pose.joints))
          this.drawing.fillStyle(0xffffff, 0.8).fillCircle(p.x, p.y, 2.3);
      }
      if (this.balanceView || this.overlay) {
        const c = pose.massProxy;
        this.drawing
          .lineStyle(1, 0xffffff, 0.6)
          .lineBetween(c.x, c.y, c.x, a.motor.position.y)
          .strokeCircle(c.x, c.y, 5);
        for (const foot of a.animator.feet.snapshot())
          this.drawing
            .lineStyle(2, foot.warning ? 0xff4949 : 0x77ee99)
            .strokeCircle(foot.point.x, foot.point.y, 7);
      }
      if (this.velocityView || this.overlay) {
        const hand = a.animator.hand(),
          v = state.velocities.rightHand;
        if (v)
          this.drawing
            .lineStyle(2, 0xe063ed, 0.8)
            .lineBetween(
              hand.x,
              hand.y,
              hand.x + v.x * 0.08,
              hand.y + v.y * 0.08,
            );
        const root = a.motor.position,
          velocity = a.motor.velocity;
        this.drawing
          .lineStyle(2, 0x50d5ff, 0.8)
          .lineBetween(
            root.x,
            root.y,
            root.x + velocity.x * 0.12,
            root.y + velocity.y * 0.12,
          );
      }
      if (this.equipmentView) {
        for (const anchor of Object.values(a.animator.anchors()))
          this.drawing
            .lineStyle(2, 0xffcc66, 0.9)
            .strokeCircle(anchor.x, anchor.y, 4);
      }
      if (this.trails && state.trails.length > 1) {
        for (const [joint, color] of [
          ['pelvis', 0xcf8dff],
          ['rightShoulder', 0x4f9dff],
          ['rightElbow', 0x63e792],
          ['rightWrist', 0xffc550],
          ['rightHand', 0xff6262],
        ] as const) {
          this.drawing.lineStyle(1.5, color, 0.8);
          this.drawing.strokePoints(
            state.trails.map((t) => t[joint]).filter(Boolean),
            false,
          );
        }
      }
      let held = this.held.get(a.id);
      if (!held) {
        held = this.add
          .image(
            0,
            0,
            this.proof === 'basketball'
              ? 'equipment:basketball'
              : 'equipment:bag-' + (a.id === 'dan' ? 'yellow' : 'teal'),
          )
          .setDepth(45);
        this.held.set(a.id, held);
      }
      const hand = a.equipment.current() ?? a.animator.hand();
      const prop = a.prop.flight;
      held
        .setVisible(!!a.equipment.attached)
        .setPosition(prop?.position.x ?? hand.x, prop?.position.y ?? hand.y)
        .setRotation(prop?.angle ?? hand.angle)
        .setDisplaySize(
          (this.proof === 'basketball' ? 37 : 27) * (a.id === 'doug' ? 0.7 : 1),
          (this.proof === 'basketball' ? 37 : 16) * (a.id === 'doug' ? 0.7 : 1),
        );
    }
    const view = this.session.event.snapshot();
    const charging = this.session.actors.find((a) => a.chargeStart !== null);
    this.hud.update({
      event: this.proof,
      time: this.session.time,
      protectedPoints: (
        (view.projectiles ?? []) as {
          position: { x: number; y: number };
          landed: boolean;
        }[]
      )
        .filter((p) => !p.landed)
        .map((p) => ({
          ...p.position,
          radius: this.proof === 'basketball' ? 19 : 15,
        })),
      phase: `${this.session.paused ? 'PAUSED' : 'LIVE'} · ${this.proof === 'fighting' ? 'SPARRING' : this.proof === 'running' ? 'RACE' : 'PRACTICE'}`,
      players: this.session.actors.map((a) => {
        const action = a.planner.graph.get('action'),
          reaction = a.planner.graph.get('reaction');
        const progress =
          this.proof === 'running' && typeof view.finish === 'number'
            ? Math.max(
                0,
                Math.min(
                  100,
                  ((a.motor.position.x - this.startingX.get(a.id)!) /
                    (view.finish - this.startingX.get(a.id)!)) *
                    100,
                ),
              )
            : a.score;
        return {
          name: a.id,
          score: this.proof === 'fighting' ? a.health : progress,
          active: !!action && !action.completed,
          status:
            this.proof === 'fighting'
              ? `HP · ENERGY ${Math.ceil(a.stamina)}`
              : this.proof === 'running'
                ? `COURSE % · ${a.score ? 'FINISHED' : a.motor.sprint ? 'SPRINTING' : Math.abs(a.motor.velocity.x) > 5 ? 'RUNNING' : 'READY'}`
                : reaction
                  ? 'REACTION'
                  : action && !action.completed
                    ? this.proof === 'basketball'
                      ? 'SHOOTING'
                      : a.shot.replaceAll('_', ' ')
                    : 'READY',
          meter:
            this.proof === 'fighting'
              ? a.health / 100
              : this.proof === 'running'
                ? a.stamina / 100
                : undefined,
        };
      }),
      ...(charging
        ? {
            action: {
              label: this.proof === 'basketball' ? 'SHOT POWER' : 'THROW POWER',
              value: Math.max(
                0.25,
                Math.min(1, this.session.time - charging.chargeStart!),
              ),
            },
          }
        : {}),
    });
    this.hud.setVisible(!this.neutral && this.focus === 'arena');
    if (this.collisionView)
      for (const body of this.session.proximity.snapshot(
        this.proof === 'fighting' ? this.session.bodies() : [],
      ).shapes) {
        this.drawing
          .lineStyle(2, 0xff84c1, 0.8)
          .strokeEllipse(
            body.position.x,
            body.position.y,
            body.radius * 2,
            body.depthRadius * 2,
          )
          .strokeRoundedRect(
            body.position.x - body.radius,
            body.position.y - body.height,
            body.radius * 2,
            body.height,
            body.radius,
          );
      }
    const projectiles = (view.projectiles ?? []) as {
      id: number;
      owner: string;
      position: { x: number; y: number };
      angle: number;
      velocity: { x: number; y: number };
      landed: boolean;
      scored: boolean;
      contact?: BagContact;
    }[];
    for (const [id, sprite] of this.projectiles)
      if (!projectiles.some((p) => p.id === id)) {
        sprite.destroy();
        this.projectiles.delete(id);
      }
    for (const p of projectiles) {
      if (this.velocityView && !p.landed)
        this.drawing
          .lineStyle(2, 0xffffff, 0.8)
          .lineBetween(
            p.position.x,
            p.position.y,
            p.position.x + p.velocity.x * 0.08,
            p.position.y + p.velocity.y * 0.08,
          );
      let sprite = this.projectiles.get(p.id);
      if (!sprite) {
        sprite = this.add
          .image(
            0,
            0,
            this.proof === 'basketball'
              ? 'equipment:basketball'
              : 'equipment:bag-' + (p.owner === 'dan' ? 'yellow' : 'teal'),
          )
          .setDepth(60);
        this.projectiles.set(p.id, sprite);
      }
      sprite
        .setPosition(p.position.x, p.position.y)
        .setRotation(p.angle)
        .setDisplaySize(
          this.proof === 'basketball'
            ? 37 * (p.owner === 'doug' ? 0.7 : 1)
            : 27 *
                (p.contact?.board.scale ?? 1) *
                (1 + (p.contact?.compression ?? 0) * 0.45),
          this.proof === 'basketball'
            ? 37 * (p.owner === 'doug' ? 0.7 : 1)
            : 16 *
                (p.contact?.board.scale ?? 1) *
                (1 - (p.contact?.compression ?? 0)),
        )
        .setAlpha(
          p.contact?.phase === 'hole'
            ? Math.max(0, 1 - p.contact.age / 0.18)
            : p.landed && p.scored
              ? 0
              : 1,
        );
      if (this.trails && p.contact?.trail.length)
        this.drawing
          .lineStyle(1.5, 0xffffff, 0.7)
          .strokePoints(p.contact.trail, false);
    }
    for (const o of (view.obstacles ?? []) as {
      x: number;
      y: number;
      height: number;
    }[]) {
      // Same obstacle bounds, now a readable low training hurdle with planted feet.
      this.props.fillStyle(0x171d20, 0.18).fillEllipse(o.x, o.y + 2, 44, 7);
      this.props
        .fillStyle(0x18272d)
        .fillRect(o.x - 12, o.y - o.height, 5, o.height)
        .fillRect(o.x + 7, o.y - o.height, 5, o.height);
      this.props
        .fillStyle(0xe7b75b)
        .fillRoundedRect(o.x - 15, o.y - o.height, 30, 8, 2);
      this.props
        .lineStyle(1, 0xffedc8, 0.65)
        .lineBetween(
          o.x - 13,
          o.y - o.height + 1,
          o.x + 13,
          o.y - o.height + 1,
        );
    }
    if (this.proof === 'running' && typeof view.finish === 'number') {
      for (let y = 490; y < 660; y += 14)
        for (let x = 0; x < 2; x++)
          this.props
            .fillStyle(
              (Math.floor((y - 490) / 14) + x) % 2 ? 0x111b20 : 0xffedc8,
              0.55,
            )
            .fillRect(view.finish + x * 9, y, 9, 14);
    }
    if (this.reference && this.overlay) {
      const samples = this.reference.samples,
        t = this.session.time - this.referenceOffset;
      let nearest = samples[0];
      for (const s of samples)
        if (Math.abs(s.timestamp - t) < Math.abs(nearest.timestamp - t))
          nearest = s;
      const points = nearest?.normalized;
      if (points) {
        const origin = { x: 1080, y: 510 };
        this.drawing.lineStyle(2, 0xde77f1, 0.85);
        for (const chain of HUMAN_CHAINS) {
          const ps = chain
            .map((name) => points[name])
            .filter(Boolean)
            .map((p) => ({ x: origin.x + p.x * 90, y: origin.y + p.y * 90 }));
          if (ps.length > 1) this.drawing.strokePoints(ps, false);
        }
        if (this.retargetOverlay) {
          const a = this.session.actors[0];
          const proposal = retargetReference(
            nearest,
            a.animator.pose(this.session.time, a.motor).joints,
          );
          this.drawing.lineStyle(2, 0xff91fa, 0.9);
          for (const chain of HUMAN_CHAINS) {
            const ps = chain
              .map((name) => proposal.joints[name])
              .filter(Boolean);
            if (ps.length > 1) this.drawing.strokePoints(ps, false);
          }
        }
      }
    }
  }
}
