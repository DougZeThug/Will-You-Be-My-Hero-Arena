// Procedural, goal-driven 3D character animator. No clips: commands only change
// GOALS, and every step the pose is solved from goals + physical-ish state, so
// any action can interrupt any other and every channel stays continuous.
//
// Layering, bottom up (each layer is carried by the one below):
//   feet (planted = world-locked, or swinging to a planned plant)
//     -> root/pelvis (follows the support; height from leg geometry)
//       -> spine/chest/head (springs: lag, overshoot, lead with the head)
//         -> arms (pendulum springs, blended to analytic IK for reach/toss)
//           -> prop (rigid in the palm between the grip and release steps)
import type { Basis, Command, Frame, HandPose, JointName, Proportions, PropState, SegmentName, Side, Vec3 } from './types';
import { DT, VIEW_ANGLE } from './types';
import type { MotionStyle } from './style';
import {
  Mover,
  Spring,
  UP,
  add,
  applyBasis,
  clamp,
  clamp01,
  cross,
  dist,
  dot,
  fwd,
  hermite,
  lerp,
  lerp3,
  madd,
  makeRng,
  minJerk,
  mkBasis,
  mul,
  norm,
  relBasis,
  rgt,
  rotate,
  rotateBasis,
  smin,
  smooth,
  solveTwoBone,
  sub,
  v3,
  wrap,
  yawOf,
} from './math';

export interface SimOptions {
  proportions: Proportions;
  style: MotionStyle;
  seed?: string | number;
  start?: { x: number; z: number; yaw: number };
  prop?: { x: number; z: number };
}

export interface SimEvent {
  step: number;
  type: 'grip' | 'release' | 'place' | 'drop' | 'land' | 'footPlant' | 'footLift' | 'ignored';
  /** |palm - prop| at the event (m) */
  posMismatch?: number;
  /** |palmVelocity - propVelocity| at the event (m/s) */
  velMismatch?: number;
  /** toss only: |palmVelocity - plannedLaunchVelocity| (m/s) */
  launchError?: number;
  note?: string;
}

export interface FootDebug {
  planted: boolean;
  x: number; // sole anchor (ankle ground projection when flat)
  z: number;
  yaw: number;
  pitch: number; // + heel up (pivot on the ball), - toes up (pivot on the heel)
}

export interface SimDebug {
  feet: { L: FootDebug; R: FootDebug };
  legAsked: { L: number; R: number }; // hip->ankle distance / leg length
  armAsked: { L: number; R: number }; // shoulder->palm distance / arm length, before clamping
  root: { x: number; z: number };
  yawBase: number; // pelvis yaw before stride rotation (unwrapped)
  facing: number; // facing goal (unwrapped)
  speed: number;
  stand: Vec3; // top centre of the prop stand
  events: SimEvent[];
}

export interface SimFrame extends Frame {
  debug: SimDebug;
}

export interface Sim {
  command(cmd: Command): void;
  step(): SimFrame;
  readonly frame: SimFrame;
  readonly options: SimOptions;
}

interface Foot {
  side: Side;
  sgn: number; // +1 right, -1 left
  planted: boolean;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  lift: number;
  toeFlat: number;
  fx: number;
  fz: number;
  fyaw: number;
  fpitch: number;
  tx: number;
  tz: number;
  tyaw: number;
  gx: number; // goal the landing spot is chasing
  gz: number;
  gyaw: number;
  tvx: number;
  tvz: number;
  tvyaw: number;
  u: number;
  T: number;
  h: number;
  landPitch: number;
  toeDown: number;
  age: number;
  forced: boolean;
}

interface Arm {
  side: Side;
  sgn: number;
  phi: Spring; // shoulder flexion (+ forward)
  alpha: Spring; // abduction (+ outward)
  eps: Spring; // elbow flexion
  beta: Spring; // wrist flexion
  pron: Spring; // forearm pronation: 0 = palm on the elbow-crease side (supinated), pi = palm on the elbow-point side
  basis: Basis; // hand basis (x fingers, z palm normal)
  pole: Vec3; // remembered elbow side
  hasPole: boolean;
  elev: Spring; // shoulder elevation (m)
  prot: Spring; // shoulder protraction (m)
  palm: Vec3;
  palmPrev: Vec3;
}

type Task =
  | { kind: 'reach'; phase: 'approach' | 'extend' | 'ready' | 'lift'; wantGrip: boolean; spot: { x: number; z: number }; n: number }
  | { kind: 'place'; phase: 'approach' | 'extend' | 'release' | 'withdraw'; spot: { x: number; z: number }; n: number }
  | {
      kind: 'toss';
      phase: 'settle' | 'load' | 'swing' | 'follow' | 'recover';
      power: number;
      n: number;
      plan: TossPlan | null;
    };

interface TossPlan {
  ox: number;
  oz: number;
  yaw: number;
  nLoad: number;
  n1: number;
  n2: number;
  n3: number;
  hold: number;
  thB: number;
  leanB: number;
  shY: number;
  dropB: number;
  pB: Vec3;
  pLow: Vec3;
  pR: Vec3;
  pF: Vec3;
  vLow: Vec3;
  v0: Vec3;
  back: number;
  fwd: number;
  released: boolean;
}

const G = 9.81;
const BAG_REST = 0.03;
const STAND_H = 0.8;
const PRON_REST = 1.75; // relaxed forearm: palm toward the thigh, slightly back
const FLAT: Basis = { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } };
const ARM_MAX = 0.985;
const LEG_SOFT = 0.985;

class CharacterSim implements Sim {
  readonly options: SimOptions;
  private P: Proportions;
  private S: MotionStyle;
  private rng: () => number;
  private n = 0;

  // locomotion
  private root = { x: 0, z: 0 };
  private vel = { x: 0, z: 0 };
  private velPrev = { x: 0, z: 0 };
  private cmdVd = { x: 0, z: 0 };
  private vdEff = { x: 0, z: 0 };
  private facing = 0;
  private yawBase = new Spring(0);
  private feet: { L: Foot; R: Foot };
  private pending: { side: Side; wait: number; start: number } | null = null;
  private swayS = new Spring(0);
  private dip = new Spring(0);
  private sinkS = new Spring(0);
  private rollS = new Spring(0);
  private pelvisY = 0;
  private pelvisYS = new Spring(0);
  private legLen: number;
  private hipDrop: number;

  // trunk
  private chestYaw = new Spring(0);
  private headYaw = new Spring(0);
  private pitchS = new Spring(0);
  private leanRoll = new Spring(0);
  private headPitch = new Spring(0);
  private headRoll = new Spring(0);
  private twist = new Spring(0);
  private squashS = new Spring(1);
  private arms: { L: Arm; R: Arm };
  private armLen: number;

  // idle acting
  private idleShift = 0;
  private nextShift = 0;
  private glance = 0;
  private glancePitch = 0;
  private nextGlance = 0;
  private glanceEnd = 0;
  private idleFor = 0;
  private bounceEnv = new Spring(0);

  // tasks
  private task: Task | null = null;
  private hand: Side;
  private reachS = new Mover(0);
  private reachTarget: Vec3 = v3();
  private reachHelp = 0;
  private reachLean = new Spring(0);
  private reachCrouch = new Spring(0);
  private openTimer = 0;
  private tossW = new Mover(0);
  private tossG = new Mover(0);
  private tossCrouch = new Mover(0);
  private tossLean = new Mover(0);
  private tossYawP = new Mover(0);
  private tossYawC = new Mover(0);
  private tossWrist = new Mover(0);
  private tossOff = new Mover(0);
  private tossShoulder = new Mover(0);
  private tossTarget: Vec3 = v3();
  private tossRootLock = false;

  // hit
  private hit: { n: number; heavy: boolean; dir: number; phase: 'impact' | 'stagger' | 'recover'; recoverAt: number } | null = null;
  private auth = new Mover(1);
  private hitCrouch = new Spring(0);
  private swaggerN = -1;

  // prop
  private stand = { x: 0, z: 0 };
  private prop: PropState = { id: 'bag', pos: v3(), vel: v3(), heldBy: null, basis: FLAT };
  private propRel: Basis = FLAT; // bag basis inside the hand basis, captured at the grip step
  private propAxis: Vec3 = v3(0, 0, 1);
  private tossPron = new Mover(PRON_REST);
  private tossHolding = false;
  private K = 1; // leg-length scale relative to a 0.86 m leg: strides, clearances and speeds scale with it
  private propState: 'stand' | 'held' | 'air' | 'ground' = 'stand';
  private propSpin = 0;

  private events: SimEvent[] = [];
  private armAsked = { L: 0, R: 0 };
  private legAsked = { L: 0, R: 0 };
  private _frame!: SimFrame;

  constructor(opts: SimOptions) {
    this.options = opts;
    this.P = opts.proportions;
    this.S = opts.style;
    this.rng = makeRng(opts.seed ?? 'lab');
    this.hand = this.S.dominantHand;
    const P = this.P;
    this.legLen = P.thigh + P.shin;
    this.hipDrop = Math.max(0, P.pelvisHeight - P.ankleHeight - this.legLen);
    this.armLen = P.upperArm + P.forearm + P.hand * 0.5;
    this.K = this.legLen / 0.86;
    const start = opts.start ?? { x: 0, z: 0, yaw: 0 };
    this.root = { x: start.x, z: start.z };
    this.facing = start.yaw;
    this.yawBase.x = start.yaw;
    this.chestYaw.x = start.yaw;
    this.headYaw.x = start.yaw;
    this.pitchS.x = this.S.posture.lean;
    const mkFoot = (side: Side): Foot => {
      const sgn = side === 'R' ? 1 : -1;
      const r = rgt(start.yaw);
      const w = this.stanceWidth() / 2;
      return {
        side,
        sgn,
        planted: true,
        x: start.x + r.x * sgn * w,
        z: start.z + r.z * sgn * w,
        yaw: start.yaw - sgn * this.S.posture.toeOut,
        pitch: 0,
        lift: 0,
        toeFlat: 1,
        fx: 0,
        fz: 0,
        fyaw: 0,
        fpitch: 0,
        tx: 0,
        tz: 0,
        tyaw: 0,
        gx: 0,
        gz: 0,
        gyaw: 0,
        tvx: 0,
        tvz: 0,
        tvyaw: 0,
        u: 0,
        T: 0.3,
        h: 0,
        landPitch: 0,
        toeDown: 0,
        age: 1000,
        forced: false,
      };
    };
    this.feet = { L: mkFoot('L'), R: mkFoot('R') };
    const mkArm = (side: Side): Arm => ({
      side,
      sgn: side === 'R' ? 1 : -1,
      phi: new Spring(0),
      alpha: new Spring(this.S.posture.armAbduct),
      eps: new Spring(this.S.posture.elbowRest),
      beta: new Spring(0),
      pron: new Spring(PRON_REST),
      basis: FLAT,
      pole: v3(0, 0, -1),
      hasPole: false,
      elev: new Spring(this.S.posture.shoulderLift),
      prot: new Spring(0),
      palm: v3(),
      palmPrev: v3(),
    });
    this.arms = { L: mkArm('L'), R: mkArm('R') };
    this.pelvisY = P.ankleHeight + this.legLen * (1 - this.S.posture.kneeSoftness) + this.hipDrop;
    const prop = opts.prop ?? { x: 0.9, z: 0.55 };
    this.stand = { x: prop.x, z: prop.z };
    this.prop.pos = this.standTop();
    this.nextShift = Math.round(lerp(this.S.acting.idle.shiftEvery[0], this.S.acting.idle.shiftEvery[1], this.rng()) * 30);
    this.nextGlance = Math.round(lerp(this.S.acting.idle.lookEvery[0], this.S.acting.idle.lookEvery[1], this.rng()) * 30);
    // Solve the rest pose once so `frame` is valid before the first step.
    this.n = -1;
    this._frame = this.solve(true);
    this.n = 0;
  }

  get frame(): SimFrame {
    return this._frame;
  }

  // ------------------------------------------------------------------ commands

  command(cmd: Command): void {
    switch (cmd.type) {
      case 'move': {
        const m = Math.hypot(cmd.x, cmd.z);
        if (!(m > 1e-6) || !Number.isFinite(m)) {
          this.cmdVd = { x: 0, z: 0 };
          break;
        }
        const k = Math.min(1, m) / m;
        this.interruptForLocomotion();
        this.cmdVd = { x: cmd.x * k * this.walkSpeed(), z: cmd.z * k * this.walkSpeed() };
        this.setFacing(yawOf(cmd.x, cmd.z));
        break;
      }
      case 'stop':
        this.cmdVd = { x: 0, z: 0 };
        if (this.task && (this.task.kind === 'reach' || this.task.kind === 'place') && this.task.phase === 'approach') {
          this.task = null;
        }
        if (this.task && this.task.kind === 'toss' && this.task.phase === 'settle') this.task = null;
        break;
      case 'face':
        if (!Number.isFinite(cmd.yaw)) break;
        this.interruptForLocomotion();
        this.cmdVd = { x: 0, z: 0 };
        this.setFacing(cmd.yaw);
        break;
      case 'turnTo': {
        const a = VIEW_ANGLE[cmd.view];
        if (a === undefined) break;
        this.interruptForLocomotion();
        this.cmdVd = { x: 0, z: 0 };
        this.setFacing((cmd.camYaw ?? 0) - a); // viewAngle = camYaw - blockYaw
        break;
      }
      case 'reach':
        this.startReach(false);
        break;
      case 'grip':
        if (this.task && this.task.kind === 'reach') {
          this.task.wantGrip = true;
        } else {
          this.startReach(true);
        }
        break;
      case 'place':
        if (this.propState !== 'held' || (this.task && this.task.kind !== 'reach')) {
          this.note('ignored', 'place: nothing in hand or busy');
          break;
        }
        if (this.task && this.task.kind === 'reach' && this.task.phase !== 'lift') break;
        this.cmdVd = { x: 0, z: 0 };
        this.reachTarget = this.reachS.x > 1e-9 ? this.reachTarget : this.standTop();
        this.task = { kind: 'place', phase: 'approach', spot: this.approachSpot(this.standTop()), n: 0 };
        break;
      case 'toss':
        if (this.propState !== 'held' || (this.task && this.task.kind !== 'reach')) {
          this.note('ignored', 'toss: nothing in hand or busy');
          break;
        }
        if (this.task && this.task.kind === 'reach' && this.task.phase !== 'lift') break;
        this.cmdVd = { x: 0, z: 0 };
        if (cmd.yaw !== undefined && Number.isFinite(cmd.yaw)) this.setFacing(cmd.yaw);
        this.task = { kind: 'toss', phase: 'settle', power: clamp01(Number.isFinite(cmd.power) ? cmd.power : 0.5), n: 0, plan: null };
        if (this.reachS.x > 0) this.reachS.to(0, 0.3);
        break;
      case 'hit':
        if (Number.isFinite(cmd.dirYaw)) this.applyHit(cmd.dirYaw, cmd.strength === 'heavy');
        break;
      case 'placeProp':
        if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.z)) break;
        if (this.task && (this.task.kind === 'reach' || this.task.kind === 'place')) this.abortTask();
        this.stand = cmd.relative ? { x: this.root.x + cmd.x, z: this.root.z + cmd.z } : { x: cmd.x, z: cmd.z };
        if (this.propState !== 'held') {
          this.propState = 'stand';
          this.prop.pos = this.standTop();
          this.prop.vel = v3();
          this.prop.basis = FLAT;
          this.propSpin = 0;
        }
        break;
    }
  }

  private note(type: SimEvent['type'], note: string): void {
    this.events.push({ step: this.n, type, note });
  }

  private setFacing(yaw: number): void {
    let d = wrap(yaw - this.yawBase.x);
    // An exact about-face is ambiguous: prefer turning
    // the negative way (through the front view at camera yaw 0) so the face stays visible.
    if (d > Math.PI - 0.3) d -= Math.PI * 2;
    this.facing = this.yawBase.x + d;
  }

  private standTop(): Vec3 {
    return v3(this.stand.x, STAND_H + BAG_REST, this.stand.z);
  }

  /** A locomotion command arrived: give up whatever task owns the legs. */
  private interruptForLocomotion(): void {
    const t = this.task;
    if (!t) return;
    if (t.kind === 'reach' && t.phase === 'lift') return; // already gripped; carrying is compatible with walking
    if (t.kind === 'place' && t.phase === 'withdraw') return;
    this.abortTask();
  }

  private abortTask(): void {
    const t = this.task;
    if (!t) return;
    if (t.kind === 'reach' || t.kind === 'place') {
      this.reachS.to(0, 0.32);
    } else if (t.kind === 'toss') {
      this.endToss(0.3);
    }
    this.task = null;
  }

  private endToss(T: number): void {
    this.tossW.to(0, T);
    this.tossG.to(this.tossG.x, 0.01);
    this.tossCrouch.to(0, T);
    this.tossLean.to(0, T);
    this.tossYawP.to(0, T);
    this.tossYawC.to(0, T * 1.2);
    this.tossWrist.to(0, T);
    this.tossOff.to(0, T * 1.3);
    this.tossShoulder.to(0, T);
    this.tossPron.to(PRON_REST, T);
    this.tossRootLock = false;
    this.tossHolding = false;
  }

  private propAtRest(): boolean {
    return this.propState === 'stand' || (this.propState === 'ground' && Math.hypot(this.prop.vel.x, this.prop.vel.z) < 0.05);
  }

  private startReach(wantGrip: boolean): void {
    if (this.propState === 'held') {
      this.note('ignored', 'reach: already holding');
      return;
    }
    if (this.task && this.task.kind === 'toss' && this.task.phase !== 'follow' && this.task.phase !== 'recover') return;
    if (this.task) this.abortTask();
    if (this.tossW.x > 0) this.endToss(0.3);
    this.cmdVd = { x: 0, z: 0 };
    this.task = { kind: 'reach', phase: 'approach', wantGrip, spot: { x: this.root.x, z: this.root.z }, n: 0 };
    // The spot is chosen once the prop is at rest (it may still be sliding).
    this.task.n = -1;
  }

  private approachSpot(target: Vec3): { x: number; z: number } {
    const dx = target.x - this.root.x;
    const dz = target.z - this.root.z;
    const D = Math.hypot(dx, dz);
    const standoff = lerp(0.3, 0.43, clamp01(target.y / STAND_H)) * (this.armLen / 0.64);
    const yawTo = yawOf(dx, dz);
    const inRange = D > standoff - 0.13 && D < standoff + 0.1 && Math.abs(wrap(yawTo - this.yawBase.x)) < 0.5;
    if (inRange || D < 1e-6) return { x: this.root.x, z: this.root.z };
    // Stand so the reaching shoulder, not the sternum, lines up with the prop.
    const side = this.hand === 'R' ? 1 : -1;
    const r = rgt(yawTo);
    return {
      x: target.x - (dx / D) * standoff - r.x * side * 0.1,
      z: target.z - (dz / D) * standoff - r.z * side * 0.1,
    };
  }

  private applyHit(dir: number, heavy: boolean): void {
    const H = this.S.acting.hit;
    const k = heavy ? 2.3 : 1;
    const push = heavy ? 2.2 : 1.1;
    const d = fwd(dir);
    this.vel.x += d.x * push;
    this.vel.z += d.z * push;
    const fC = fwd(this.chestYaw.x);
    const rC = rgt(this.chestYaw.x);
    const pf = d.x * fC.x + d.z * fC.z;
    const pr = d.x * rC.x + d.z * rC.z;
    // The struck part goes first: the chest moves this very step ...
    const kk = heavy ? 1.9 : 1;
    this.pitchS.kick((pf * kk * 1.5) / H.brace);
    this.leanRoll.kick((pr * kk * 1.5) / H.brace);
    // ... the head is left behind and snaps after it.
    this.headPitch.kick(-pf * kk * 3.2 * H.headWhip);
    this.headRoll.kick(-pr * kk * 2.8 * H.headWhip);
    this.twist.kick(-pr * kk * 1.6);
    this.hitCrouch.kick(H.absorb * k * 0.55);
    this.squashS.kick(-0.5 * k);
    for (const side of ['L', 'R'] as Side[]) {
      const a = this.arms[side];
      a.phi.kick(-pf * kk * 4.2 * H.flail);
      a.alpha.kick((1.6 + 1.8 * Math.abs(pr) + 0.9 * Math.abs(pf)) * kk * H.flail * (1 + 0.35 * a.sgn * pr));
      a.eps.kick(-1.4 * kk * H.flail);
      a.elev.kick(H.guard * 14 * Math.sqrt(k));
    }
    // Whatever was going on with the hands is over.
    if (this.task) this.abortTask();
    if (this.reachS.x > 0) this.reachS.to(0, 0.25);
    if (this.tossW.x > 0) this.endToss(0.28);
    if (heavy && this.propState === 'held') {
      // A heavy blow knocks the bag loose: it leaves with the palm's velocity plus the shove.
      const a = this.arms[this.prop.heldBy as Side];
      const pv = mul(sub(a.palm, a.palmPrev), 1 / DT);
      this.propState = 'air';
      this.prop.heldBy = null;
      this.prop.vel = v3(pv.x + d.x * 1.3, pv.y + 1.6, pv.z + d.z * 1.3);
      this.propSpin = 9;
      this.propAxis = norm(v3(d.z, 0.3, -d.x));
      this.events.push({ step: this.n, type: 'drop', posMismatch: 0, velMismatch: 0, note: 'knocked loose by heavy hit' });
    }
    this.auth.x = 0;
    this.auth.v = 0;
    this.auth.to(0, 0.01);
    this.hit = { n: 0, heavy, dir, phase: 'impact', recoverAt: 0 };
    this.pending = null;
    this.swaggerN = -1;
  }

  // ------------------------------------------------------------------ helpers

  private other(f: Foot): Foot {
    return f.side === 'L' ? this.feet.R : this.feet.L;
  }

  private speed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /** Standing stance: the style's width, but never narrower than the hips can carry. */
  private stanceWidth(): number {
    return Math.max(this.S.posture.stanceWidth * Math.pow(this.K, 0.5), this.P.hipWidth * 0.9);
  }

  private swingTime(): number {
    return this.S.timing.swingTime * Math.pow(this.K, 0.25);
  }

  private walkSpeed(): number {
    return this.S.timing.walkSpeed * Math.pow(this.K, 0.8);
  }

  private speedFrac(s = this.speed()): number {
    return clamp01(s / this.walkSpeed());
  }

  private footGeom(f: Foot): { ankle: Vec3; heel: Vec3; toe: Vec3; ball: Vec3 } {
    const L = this.P.footLen;
    const H = this.P.ankleHeight;
    const back = 0.25 * L;
    const ballF = 0.45 * L;
    const toeF = 0.75 * L;
    const fx = Math.cos(f.yaw);
    const fz = -Math.sin(f.yaw);
    const at = (px: number, pz: number, u: number, h: number, a: number): Vec3 => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const along = u * c + h * s;
      return v3(px + fx * along, f.lift - u * s + h * c, pz + fz * along);
    };
    if (f.pitch >= 0) {
      const bx = f.x + fx * ballF;
      const bz = f.z + fz * ballF;
      const a = f.pitch;
      const toe = at(bx, bz, toeF - ballF, 0, a * (1 - f.toeFlat));
      if (toe.y < 0) toe.y = 0;
      return { ankle: at(bx, bz, -ballF, H, a), heel: at(bx, bz, -(back + ballF), 0, a), toe, ball: v3(bx, f.lift, bz) };
    }
    const hx = f.x - fx * back;
    const hz = f.z - fz * back;
    const a = f.pitch;
    return { ankle: at(hx, hz, back, H, a), heel: v3(hx, f.lift, hz), toe: at(hx, hz, L, 0, a), ball: at(hx, hz, back + ballF, 0, a) };
  }

  private accelLimit(): number {
    const T = this.S.timing;
    if (this.hit && this.hit.phase !== 'recover') return this.S.acting.hit.staggerDecel * (this.hit.heavy ? 0.85 : 1);
    const sd = Math.hypot(this.vdEff.x, this.vdEff.z);
    return sd >= this.speed() ? T.accel : T.decel;
  }

  /** Where (and at what yaw) a foot should come down if it lands `tRem` seconds from now. */
  private stepTarget(foot: Foot, tRem: number, swingT: number): { x: number; z: number; yaw: number } {
    const st = this.S;
    const o = this.other(foot);
    const acc = this.accelLimit();
    const dvx = this.vdEff.x - this.vel.x;
    const dvz = this.vdEff.z - this.vel.z;
    const dv = Math.hypot(dvx, dvz);
    const lim = acc * tRem;
    const k = dv > lim ? lim / dv : 1;
    const vlx = this.vel.x + dvx * k;
    const vlz = this.vel.z + dvz * k;
    const px = this.root.x + 0.5 * (this.vel.x + vlx) * tRem;
    const pz = this.root.z + 0.5 * (this.vel.z + vlz) * tRem;
    const sl = Math.hypot(vlx, vlz);
    const Tds = st.timing.doubleSupport;
    const Tlead = 0.5 * (swingT + 2 * Tds);
    let lx = vlx * Tlead;
    let lz = vlz * Tlead;
    const sd = Math.hypot(this.vdEff.x, this.vdEff.z);
    if (sd < sl - 1e-6 && sl > 1e-6) {
      // Braking or being shoved: the foot goes out to where the body will stop.
      const want = (0.85 * (sl * sl - sd * sd)) / (2 * acc);
      const cur = Math.hypot(lx, lz);
      if (want > cur) {
        lx = (vlx / sl) * want;
        lz = (vlz / sl) * want;
      }
    }
    const toe = st.posture.toeOut;
    const stanceBody = o.yaw + o.sgn * toe;
    let rel = this.facing - stanceBody;
    const ext = 1.5; // a foot opens outward (right foot: negative yaw) further than it turns in
    const int = 1.0;
    rel = foot.sgn > 0 ? clamp(rel, -ext, int) : clamp(rel, -int, ext);
    const bodyYaw = stanceBody + rel;
    const width = this.stanceWidth() * (1 - 0.4 * this.speedFrac(sl));
    const r = rgt(bodyYaw);
    let x = px + lx + r.x * foot.sgn * width * 0.5;
    let z = pz + lz + r.z * foot.sgn * width * 0.5;
    // Never cross the stance foot.
    const ra = rgt(0.5 * (stanceBody + bodyYaw));
    const sep = ((x - o.x) * ra.x + (z - o.z) * ra.z) * foot.sgn;
    const minSep = this.P.hipWidth * 0.5 + 0.05;
    if (sep < minSep) {
      x += ra.x * foot.sgn * (minSep - sep);
      z += ra.z * foot.sgn * (minSep - sep);
    }
    const maxD = 0.82 * this.legLen;
    const d = Math.hypot(x - o.x, z - o.z);
    if (d > maxD) {
      x = o.x + ((x - o.x) * maxD) / d;
      z = o.z + ((z - o.z) * maxD) / d;
    }
    return { x, z, yaw: bodyYaw - foot.sgn * toe };
  }

  private liftFoot(f: Foot, target: { x: number; z: number; yaw: number }, T: number, forced: boolean): void {
    const st = this.S;
    f.planted = false;
    f.fx = f.x;
    f.fz = f.z;
    f.fyaw = f.yaw;
    f.fpitch = f.pitch;
    f.tx = target.x;
    f.tz = target.z;
    f.tyaw = target.yaw;
    f.gx = target.x;
    f.gz = target.z;
    f.gyaw = target.yaw;
    f.tvx = 0;
    f.tvz = 0;
    f.tvyaw = 0;
    f.u = 0;
    f.T = T;
    f.forced = forced;
    const dx = target.x - f.x;
    const dz = target.z - f.z;
    const d = Math.hypot(dx, dz);
    const K = this.K;
    const along = dx * Math.cos(target.yaw) - dz * Math.sin(target.yaw);
    f.h = K * st.gait.stepHeight * (0.42 + 0.58 * clamp01(d / (0.5 * K))) + (this.hit ? 0.02 : 0);
    f.landPitch = -st.gait.heelStrike * clamp(along / (0.5 * K), -0.5, 1);
    f.toeDown = 0.3 * clamp01(along / (0.4 * K));
    this.pending = null;
    this.events.push({ step: this.n, type: 'footLift', note: f.side });
  }

  // ------------------------------------------------------------------ step

  step(): SimFrame {
    this.events = [];
    this._frame = this.solve(false);
    this.n++;
    return this._frame;
  }

  private solve(initial: boolean): SimFrame {
    const P = this.P;
    const st = this.S;
    const dt = initial ? 0 : DT;
    const live = !initial;

    // ---- 1. tasks and goals -------------------------------------------------
    let taskVd: { x: number; z: number } | null = null;
    let lookAt: Vec3 | null = null;
    let lookYawOverride: number | null = null;
    let stepperLocked = false;
    if (live) {
      taskVd = this.updateTask();
      if (this.task && this.task.kind === 'toss') {
        const ph = this.task.phase;
        const aligned = Math.abs(this.facing - this.yawBase.x) < 0.12 && this.feet.L.planted && this.feet.R.planted && !this.pending;
        if (ph === 'swing' || ph === 'follow' || (ph === 'load' && aligned && !this.tossHolding)) stepperLocked = true;
      }
    }
    if (this.task && (this.task.kind === 'reach' || this.task.kind === 'place')) {
      lookAt = this.task.kind === 'reach' ? this.prop.pos : this.standTop();
    }
    if (this.task && this.task.kind === 'toss' && this.task.plan && this.task.plan.released && this.propState !== 'held') {
      lookAt = this.prop.pos;
    }

    // ---- 2. hit state machine ------------------------------------------------
    const H = st.acting.hit;
    if (live && this.hit) {
      const h = this.hit;
      h.n++;
      const bothDown = this.feet.L.planted && this.feet.R.planted;
      if (h.phase === 'impact' && h.n >= 6) h.phase = 'stagger';
      if (h.phase === 'stagger' && h.n >= (h.heavy ? 40 : 14) && this.speed() < 0.15 && bothDown) {
        h.phase = 'recover';
        h.recoverAt = h.n;
        this.auth.to(1, H.recoverTime * (h.heavy ? 1.5 : 1));
        this.swaggerN = 0;
      }
      if (h.phase === 'recover' && this.auth.arrived) this.hit = null;
    }
    if (live) this.auth.step(dt);
    if (this.hit && this.hit.n > 10 && this.hit.n < (this.hit.heavy ? 85 : 45)) {
      // Check where that came from.
      lookYawOverride = this.hit.dir + Math.PI;
    }

    // ---- 3. root velocity ----------------------------------------------------
    const T = st.timing;
    const vd = taskVd ?? this.cmdVd;
    const vdMag = Math.hypot(vd.x, vd.z);
    let align = 1;
    if (vdMag > 1e-6) {
      const c = Math.cos(wrap(yawOf(vd.x, vd.z) - this.yawBase.x));
      align = clamp01((c + 0.25) / 0.85);
      if (taskVd) align = Math.max(align, 0.6); // short approach steps may go sideways/backwards
    }
    const a = this.auth.x;
    const wasStill = Math.hypot(this.vdEff.x, this.vdEff.z) < 0.02;
    this.vdEff = { x: vd.x * a * align, z: vd.z * a * align };
    this.velPrev = { x: this.vel.x, z: this.vel.z };
    if (live) {
      if (this.tossRootLock && this.task && this.task.kind === 'toss' && this.task.plan) {
        const pl = this.task.plan;
        const d = fwd(pl.yaw);
        const g0 = this.tossG.x;
        const g1 = this.tossG.step(dt);
        this.root.x += d.x * (g1 - g0);
        this.root.z += d.z * (g1 - g0);
        this.vel = { x: (d.x * (g1 - g0)) / dt, z: (d.z * (g1 - g0)) / dt };
      } else {
        const acc = this.accelLimit();
        const dvx = this.vdEff.x - this.vel.x;
        const dvz = this.vdEff.z - this.vel.z;
        const dv = Math.hypot(dvx, dvz);
        if (dv > 1e-9) {
          const stepv = Math.min(dv * 10 * dt, acc * dt);
          this.vel.x += (dvx / dv) * stepv;
          this.vel.z += (dvz / dv) * stepv;
        }
        // The body cannot outrun its support: as the root nears the reach of a planted leg, the
        // velocity away from that foot fades out (the leg "holds" it) instead of the leg stretching.
        {
          const Rmax = 0.47 * this.legLen * LEG_SOFT + this.P.hipWidth * 0.5;
          for (const f of [this.feet.L, this.feet.R]) {
            if (!f.planted) continue;
            const ox = this.root.x - f.x;
            const oz = this.root.z - f.z;
            const d = Math.hypot(ox, oz);
            if (d < 0.8 * Rmax) continue;
            const vo = (this.vel.x * ox + this.vel.z * oz) / d;
            if (vo <= 0) continue;
            const keep = smooth((Rmax - d) / (0.2 * Rmax));
            // only bites while this is the only support, or the other foot cannot take over yet
            const o = this.other(f);
            const bite = o.planted ? 0.15 : 1;
            this.vel.x -= (ox / d) * vo * (1 - keep) * bite;
            this.vel.z -= (oz / d) * vo * (1 - keep) * bite;
          }
        }
        this.root.x += this.vel.x * dt;
        this.root.z += this.vel.z * dt;
        if (wasStill && Math.hypot(this.vdEff.x, this.vdEff.z) > 0.1 && this.speed() < 0.2) {
          // Start: unlock the knees on the very first step.
          this.dip.kick((-0.16 * st.acting.anticipation - 0.06) * this.K);
        }
      }
    }
    const speed = this.speed();
    const sf = this.speedFrac(speed);
    const accX = live ? (this.vel.x - this.velPrev.x) / DT : 0;
    const accZ = live ? (this.vel.z - this.velPrev.z) / DT : 0;

    // ---- 4. pelvis yaw, limited by where the feet point ------------------------
    {
      let lo = -Infinity;
      let hi = Infinity;
      for (const f of [this.feet.L, this.feet.R]) {
        const body = f.yaw + f.sgn * st.posture.toeOut;
        const A = f.planted ? 0.85 : 1.25;
        lo = Math.max(lo, body - A);
        hi = Math.min(hi, body + A);
      }
      if (lo > hi) lo = hi = 0.5 * (lo + hi);
      const target = clamp(this.facing, lo, hi);
      if (live) this.yawBase.step(target, T.pelvisFollow * (0.25 + 0.75 * a), 1, dt);
    }

    // ---- 5. feet -------------------------------------------------------------
    if (live) this.updateFeet(stepperLocked, speed);

    const fL = this.feet.L;
    const fR = this.feet.R;
    const fB = fwd(this.yawBase.x);
    const rB = rgt(this.yawBase.x);
    const stride = (fR.x - fL.x) * fB.x + (fR.z - fL.z) * fB.z;
    const halfSep = Math.max(0.06, 0.5 * Math.abs((fR.x - fL.x) * rB.x + (fR.z - fL.z) * rB.z));

    // ---- 6. idle acting ------------------------------------------------------
    const idle = !this.task && !this.hit && vdMag < 1e-6 && speed < 0.05 && fL.planted && fR.planted && !this.pending && this.propState !== 'air';
    if (live) {
      this.idleFor = idle ? this.idleFor + 1 : 0;
      const I = st.acting.idle;
      if (idle && this.idleFor > 20) {
        if (this.idleFor >= this.nextShift) {
          const r = this.rng();
          this.idleShift = this.idleShift === 0 ? (r < 0.5 ? -1 : 1) : r < 0.75 ? -this.idleShift : 0;
          this.nextShift = this.idleFor + Math.round(lerp(I.shiftEvery[0], I.shiftEvery[1], this.rng()) * 60);
        }
        if (this.idleFor >= this.nextGlance) {
          this.glance = (this.rng() * 2 - 1) * I.lookAmount;
          this.glancePitch = (this.rng() - 0.6) * 0.25 * I.lookAmount;
          this.glanceEnd = this.idleFor + Math.round(lerp(0.5, 1.3, this.rng()) * 60);
          this.nextGlance = this.glanceEnd + Math.round(lerp(I.lookEvery[0], I.lookEvery[1], this.rng()) * 60);
        }
        if (this.idleFor >= this.glanceEnd) {
          this.glance = 0;
          this.glancePitch = 0;
        }
      } else if (!idle) {
        this.idleShift = 0;
        this.glance = 0;
        this.glancePitch = 0;
        this.nextShift = Math.round(lerp(I.shiftEvery[0], I.shiftEvery[1], 0.3) * 40);
        this.nextGlance = 30;
        this.glanceEnd = 0;
      }
      const waiting = speed < 0.05 && !this.hit && fL.planted && fR.planted && (!this.task || this.task.kind !== 'toss');
      this.bounceEnv.step(waiting ? 1 : 0, 5, 1, dt);
    }
    const tsec = this.n * DT;
    const breath = Math.sin(tsec * Math.PI * 2 * st.acting.idle.breathHz);
    const idleBounce = st.acting.idle.bounce * this.bounceEnv.x * (0.5 - 0.5 * Math.cos(tsec * Math.PI * 2 * st.acting.idle.bounceHz));

    // ---- 7. lateral weight: over the stance foot before the other lifts ----------
    let swayTarget: number;
    {
      const latOf = (f: Foot) => (f.x - this.root.x) * rB.x + (f.z - this.root.z) * rB.z;
      const frac = Math.min(0.95, lerp(0.85, 0.3, sf) * st.gait.sway);
      const single = !fL.planted ? fR : !fR.planted ? fL : this.pending ? this.other(this.feet[this.pending.side]) : null;
      if (single) swayTarget = latOf(single) * frac;
      else swayTarget = 0.5 * (latOf(fL) + latOf(fR)) * 0.6 + this.idleShift * st.acting.idle.shiftAmount * halfSep;
      if (live) this.swayS.step(swayTarget, this.pending ? 15 : lerp(9, 13, sf), 0.85, dt);
    }

    // ---- 8. crouch channels ----------------------------------------------------
    const accMag = Math.hypot(accX, accZ);
    if (live) {
      this.dip.step(0, 13, 0.5, dt);
      this.sinkS.step(st.gait.sink * this.K * clamp01(accMag / 6), 12, 0.8, dt);
      this.hitCrouch.step(0, this.hit && this.hit.heavy ? 5.5 : 8, 0.6, dt);
      this.reachLean.step(0, 1, 1, 0); // (targets set in the arm section; keeps state defined)
    }
    const eReach = clamp01(this.reachS.x * 1.7);
    let ffLean = 0;
    let ffCrouch = 0;
    if (this.reachS.x > 0 || (this.task && this.task.kind !== 'toss')) {
      const tgt = this.reachTarget;
      const side = this.hand === 'R' ? 1 : -1;
      const shRest = v3(
        this.root.x + rB.x * side * P.shoulderWidth * 0.5,
        this.pelvisStand() + P.spine + P.chestLen,
        this.root.z + rB.z * side * P.shoulderWidth * 0.5,
      );
      ffCrouch = clamp((0.62 - tgt.y) * 0.8, 0, 0.5 * this.legLen);
      const need = Math.max(0, dist(v3(shRest.x, shRest.y - ffCrouch, shRest.z), tgt) - 0.8 * this.armLen);
      ffLean = clamp((need / (P.spine + P.chestLen)) * 1.15, 0, 1.0);
    }
    if (live) {
      this.reachLean.step(eReach * (ffLean + this.reachHelp), 11, 1, dt);
      this.reachCrouch.step(eReach * (ffCrouch + this.reachHelp * 0.35), 9, 1, dt);
    }
    const crouch = clamp(
      0.012 * sf +
        this.sinkS.x +
        this.reachCrouch.x +
        this.tossCrouch.x +
        Math.max(-0.02, this.hitCrouch.x) +
        idleBounce -
        this.dip.x,
      -0.03,
      0.66 * this.legLen,
    );

    // ---- 9. trunk springs ------------------------------------------------------
    const brace = this.hit && this.hit.phase !== 'recover' ? 0.55 * H.brace : 1;
    const zeta = this.hit ? Math.min(st.timing.settleDamping, 0.45) : st.timing.settleDamping;
    if (live) {
      this.twist.step(0, 9, 0.5, dt);
      this.rollS.step(
        (!fR.planted ? 0.07 * Math.sin(Math.PI * fR.u) : !fL.planted ? -0.07 * Math.sin(Math.PI * fL.u) : 0) * (0.4 + 0.6 * sf) -
          0.09 * clamp(this.swayS.x / halfSep, -1, 1) * (1 - sf),
        10,
        0.9,
        dt,
      );
    }
    const pelvisRot = (st.gait.pelvisRotation * stride * clamp01(0.3 + sf)) / this.K;
    const yawP = this.yawBase.x + pelvisRot + this.tossYawP.x + 0.4 * this.twist.x;
    // swagger: a decaying shoulder roll + head shake when gathering after a hit
    let swagChest = 0;
    let swagHead = 0;
    if (this.swaggerN >= 0) {
      const ts = this.swaggerN * DT;
      const env = Math.exp(-2.6 * ts) * smooth(ts / 0.12);
      swagChest = H.swagger * env * Math.sin(ts * Math.PI * 2 * 1.9);
      swagHead = -H.swagger * 1.6 * env * Math.sin(ts * Math.PI * 2 * 3.8);
      if (live) {
        this.swaggerN++;
        if (ts > 2.2) this.swaggerN = -1;
      }
    }
    const reachSide = this.hand === 'R' ? 1 : -1;
    const chestTarget =
      this.yawBase.x +
      clamp(this.facing - this.yawBase.x, -0.65, 0.65) -
      pelvisRot * st.gait.counterRotation +
      this.tossYawC.x +
      this.twist.x +
      swagChest +
      reachSide * 0.3 * eReach * (1 - clamp01(this.reachLean.x));
    if (live) {
      this.chestYaw.step(chestTarget, T.chestFollow * (0.4 + 0.6 * a), 0.8, dt);
      // keep the chest within what a spine can do over the pelvis
      const rel = this.chestYaw.x - yawP;
      if (Math.abs(rel) > 0.95) {
        this.chestYaw.x = yawP + Math.sign(rel) * 0.95;
        this.chestYaw.v *= 0.5;
      }
    }
    const yawC = this.chestYaw.x;
    const fC = fwd(yawC);
    const rC = rgt(yawC);
    const aF = accX * fC.x + accZ * fC.z;
    const aR = accX * rC.x + accZ * rC.z;
    const pitchTarget =
      st.posture.lean +
      st.gait.leanIntoMotion * clamp(aF, -8, 8) +
      0.05 * sf * (this.vel.x * fC.x + this.vel.z * fC.z > 0 ? 1 : -0.6) +
      this.reachLean.x +
      this.tossLean.x -
      0.012 * breath +
      0.25 * Math.max(0, this.hitCrouch.x) * 4 * 0.3;
    const rollTarget = st.gait.leanIntoMotion * clamp(aR, -8, 8) - 0.7 * this.rollS.x;
    if (live) {
      this.pitchS.step(pitchTarget, st.timing.settleFreq * brace, zeta, dt);
      this.leanRoll.step(rollTarget, st.timing.settleFreq * brace, zeta, dt);
      this.pitchS.x = clamp(this.pitchS.x, -0.7, 1.35);
      this.leanRoll.x = clamp(this.leanRoll.x, -0.7, 0.7);
    }
    const pitch = this.pitchS.x;
    const roll = this.leanRoll.x;

    // ---- 10. pelvis position: carried by the legs ---------------------------------
    const hinge = 0.3 * P.spine * Math.sin(clamp(pitch - st.posture.lean, -0.5, 1.2));
    const fP = fwd(yawP);
    const rP = rgt(yawP);
    const hw = P.hipWidth * 0.5;
    const Lmax = this.legLen * LEG_SOFT;
    const dmax = 0.47 * Lmax;
    let px = 0;
    let pz = 0;
    const gL = this.footGeom(fL);
    const gR = this.footGeom(fR);
    const geo = { L: gL, R: gR };
    for (let pass = 0; pass < 3; pass++) {
      px = this.root.x + rB.x * this.swayS.x - fC.x * hinge * 2.2;
      pz = this.root.z + rB.z * this.swayS.x - fC.z * hinge * 2.2;
      let moved = false;
      for (const f of [fL, fR]) {
        if (!f.planted) continue;
        const hx = px + rP.x * f.sgn * hw;
        const hz = pz + rP.z * f.sgn * hw;
        const an = geo[f.side].ankle;
        const dx = hx - an.x;
        const dz = hz - an.z;
        const d = Math.hypot(dx, dz);
        if (d > dmax) {
          // The body cannot leave its support: the root is pulled back onto it.
          const push = d - dmax;
          this.root.x -= (dx / d) * push;
          this.root.z -= (dz / d) * push;
          const vn = (this.vel.x * dx + this.vel.z * dz) / d;
          if (vn > 0) {
            this.vel.x -= (dx / d) * vn * 0.5;
            this.vel.z -= (dz / d) * vn * 0.5;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }

    // planted-foot roll (heel-off as the hip passes over and ahead; relaxed heel when unweighted)
    if (live) {
      for (const f of [fL, fR]) {
        if (!f.planted) continue;
        f.age++;
        const hx = px + rP.x * f.sgn * hw;
        const hz = pz + rP.z * f.sgn * hw;
        const dF = (hx - f.x) * Math.cos(f.yaw) - (hz - f.z) * Math.sin(f.yaw);
        let target = 0.95 * smooth((dF - 0.17 * this.legLen) / (0.33 * this.legLen));
        const wN = clamp(this.swayS.x / halfSep, -1, 1);
        if (idle) target = Math.max(target, st.acting.idle.relaxedHeel * clamp01((-wN * f.sgn - 0.25) / 0.45));
        // deep crouch (ground pick-up): heels come up
        target = Math.max(target, 0.55 * clamp01((crouch - 0.22) / 0.25));
        const rate = (f.pitch < 0 ? 5.5 : 5) * dt;
        f.pitch += clamp((target - f.pitch) * 0.3, -rate, rate);
        if (Math.abs(f.pitch) < 1e-5 && target === 0) f.pitch = 0;
        f.toeFlat = 1;
      }
    }
    const gL2 = this.footGeom(fL);
    const gR2 = this.footGeom(fR);
    const geom = { L: gL2, R: gR2 };

    // height: stand tall minus crouch, but never beyond what either leg can reach
    const rho = this.rollS.x;
    {
      // The pelvis has vertical inertia: it springs toward its standing height and is only
      // ever limited from above by the legs, so a leg coming off the ground never pops it up.
      const yPrev = this.pelvisYS.x;
      let y = initial ? this.pelvisStand() - crouch : this.pelvisYS.step(this.pelvisStand() - crouch, 17, 0.85, dt);
      const ySpring = y;
      for (const f of [fL, fR]) {
        const hx = px + rP.x * f.sgn * hw;
        const hz = pz + rP.z * f.sgn * hw;
        const an = geom[f.side].ankle;
        const d = Math.hypot(hx - an.x, hz - an.z);
        const lim = an.y + Math.sqrt(Math.max(0.0004, Lmax * Lmax - d * d)) + this.hipDrop + f.sgn * rho * hw;
        y = smin(y, lim, 0.03);
      }
      if (initial) {
        this.pelvisYS.x = y;
      } else if (y < ySpring - 1e-9) {
        // riding a leg's reach: carry the actual velocity so the release is smooth
        this.pelvisYS.x = y;
        this.pelvisYS.v = Math.min(this.pelvisYS.v, (y - yPrev) / dt);
      }
      this.pelvisY = y;
    }
    const pelvis = v3(px, this.pelvisY, pz);

    // ---- 11. legs ---------------------------------------------------------------
    const J = {} as Record<JointName, Vec3>;
    const B = {} as Record<SegmentName, Basis>;
    J.pelvis = pelvis;
    B.pelvis = mkBasis(v3(rP.x * rho, 1, rP.z * rho), fP);
    for (const f of [fL, fR]) {
      const hip = v3(px + rP.x * f.sgn * hw, this.pelvisY - this.hipDrop - f.sgn * rho * hw, pz + rP.z * f.sgn * hw);
      const g = geom[f.side];
      const ff = fwd(f.yaw);
      // The knee hinges about an axis between the foot's and the pelvis's lateral axes, so the
      // knee tracks over the toes and can never flip (a leg is never parallel to its hinge).
      const fr = rgt(f.yaw);
      const nLeg = norm(v3(fr.x * 0.55 + rP.x * 0.6 - fP.x * f.sgn * 0.1, 0, fr.z * 0.55 + rP.z * 0.6 - fP.z * f.sgn * 0.1), rP);
      const dLeg = norm(sub(g.ankle, hip), v3(0, -1, 0));
      const pole = norm(cross(nLeg, dLeg), ff);
      const ik = solveTwoBone(hip, g.ankle, P.thigh, P.shin, pole, 0.995);
      this.legAsked[f.side] = ik.asked;
      const tDir = norm(sub(ik.mid, hip));
      const sDir = norm(sub(g.ankle, ik.mid));
      B[`thigh${f.side}`] = mkBasis(tDir, cross(nLeg, tDir), pole);
      B[`shin${f.side}`] = mkBasis(sDir, cross(nLeg, sDir), pole);
      B[`foot${f.side}`] = mkBasis(sub(g.ball, g.heel), UP, ff);
      J[`hip${f.side}`] = hip;
      J[`knee${f.side}`] = ik.mid;
      J[`ankle${f.side}`] = g.ankle;
      J[`heel${f.side}`] = g.heel;
      J[`toe${f.side}`] = g.toe;
    }

    // ---- 12. spine, chest, head --------------------------------------------------
    const u = (p: number, r: number, f: Vec3, rr: Vec3): Vec3 =>
      norm(v3(f.x * Math.sin(p) + rr.x * Math.sin(r), Math.cos(p) * Math.cos(r), f.z * Math.sin(p) + rr.z * Math.sin(r)));
    const uLow = u(pitch * 0.45 - st.posture.spineCurve, roll * 0.4 + rho * 0.6, fC, rC);
    const uUp = u(pitch - st.posture.chestOut * 2.5, roll, fC, rC);
    const breathLift = st.acting.idle.breath * (0.5 + 0.5 * breath);
    J.spine = madd(pelvis, uLow, P.spine);
    J.chest = madd(J.spine, uUp, P.chestLen + breathLift);

    // head: leads with the eyes. Absolute spring toward the look direction, limited by the neck.
    let lookYaw = this.facing + this.glance + swagHead;
    let lookPitch = this.glancePitch;
    if (vdMag > 1e-6) lookYaw = this.yawBase.x + wrap(yawOf(vd.x, vd.z) - this.yawBase.x);
    if (lookAt) {
      const hx = lookAt.x - J.chest.x;
      const hz = lookAt.z - J.chest.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 0.05) lookYaw = yawOf(hx, hz);
      lookPitch = clamp(Math.atan2(J.chest.y + P.neck + 0.1 - lookAt.y, Math.max(0.2, hd)) * 0.55, -0.5, 0.7);
    }
    if (lookYawOverride !== null) {
      const k = st.acting.hit.lookBack;
      const rel = wrap(lookYawOverride - yawC);
      lookYaw = yawC + clamp(rel, -1.3, 1.3) * k;
    }
    {
      const rel = clamp(wrap(lookYaw - yawC), -1.3, 1.3);
      const targetAbs = yawC + rel;
      const tgt = this.headYaw.x + wrap(targetAbs - this.headYaw.x);
      if (live) {
        this.headYaw.step(tgt, T.headLead, 0.85, dt);
        if (Math.abs(this.headYaw.v) > 9.5) {
          // a head whips round fast, but not instantly
          const over = Math.sign(this.headYaw.v) * 9.5;
          this.headYaw.x -= (this.headYaw.v - over) * dt;
          this.headYaw.v = over;
        }
        const hr = this.headYaw.x - yawC;
        if (Math.abs(hr) > 1.4) {
          this.headYaw.x = yawC + Math.sign(hr) * 1.4;
          this.headYaw.v *= 0.5;
        }
        this.headPitch.step(lookPitch, this.hit ? 9 : 12, this.hit ? 0.3 : 0.75, dt);
        this.headRoll.step(0, this.hit ? 9 : 12, this.hit ? 0.3 : 0.75, dt);
        this.headPitch.x = clamp(this.headPitch.x, -0.75, 0.85);
        this.headRoll.x = clamp(this.headRoll.x, -0.6, 0.6);
      }
    }
    const yawH = this.headYaw.x;
    const fH = fwd(yawH);
    const rH = rgt(yawH);
    const uNeck = u(pitch * 0.55 + st.posture.headForward + this.headPitch.x * 0.4, roll * 0.5 + this.headRoll.x * 0.4, fC, rC);
    J.neck = madd(J.chest, uNeck, P.neck * 0.35);
    J.head = madd(J.chest, uNeck, P.neck);
    // The head stays level against the trunk's lean (eyes on the horizon), plus its own nod.
    const uHead = u(pitch * 0.25 + st.posture.headPitch + this.headPitch.x, roll * 0.25 + this.headRoll.x, fH, rH);
    J.headTop = madd(J.head, uHead, P.headLen);
    B.spine = mkBasis(uLow, v3(fP.x + fC.x, 0, fP.z + fC.z), fC);
    B.chest = mkBasis(uUp, fC);
    B.head = mkBasis(uHead, fH);

    // ---- 13. arms ------------------------------------------------------------------
    const uC = uUp;
    const rCb = norm(sub(rC, mul(uC, dot(rC, uC))));
    const fCb = cross(uC, rCb);
    const held = this.propState === 'held' ? this.prop.heldBy : null;
    const hands: { L: HandPose; R: HandPose } = { L: 'relaxed', R: 'relaxed' };
    let tossPathPoint: Vec3 | null = null;
    if (this.tossW.x > 0 || (this.task && this.task.kind === 'toss' && this.task.plan)) tossPathPoint = this.tossTarget;
    for (const side of ['L', 'R'] as Side[]) {
      const A = this.arms[side];
      const isTask = side === this.hand;
      const carrying = held === side;
      const hitLoose = this.hit && this.hit.phase !== 'recover' ? 0.55 : 1;
      const swing = clamp((-A.sgn * stride * st.gait.armSwing * clamp01(0.25 + sf)) / this.K, -0.6, 0.75) * (carrying ? 0.35 : 1);
      const off = isTask ? 0 : this.tossOff.x;
      const phiT = swing + 0.06 * sf + off + (carrying ? 0.05 : 0);
      const alphaT = st.posture.armAbduct + 0.04 * sf + Math.abs(off) * 0.35 + (isTask ? 0 : 0.5 * this.reachLean.x);
      const epsT =
        st.posture.elbowRest +
        st.gait.elbowSwing * Math.max(0, A.phi.x) +
        0.3 * sf +
        (carrying ? 0.22 : 0) -
        clamp(0.05 * A.phi.v, -0.3, 0.3) +
        Math.abs(off) * 0.4;
      const betaT = clamp(-0.06 * A.phi.v, -0.45, 0.45) + (isTask ? this.tossWrist.x : 0) + (carrying ? -0.12 : 0) - (isTask ? 0.35 * this.reachS.x : 0);
      const elevT =
        st.posture.shoulderLift +
        st.acting.idle.breath * 0.6 * breath -
        (carrying ? 0.008 : 0) +
        (isTask ? 0.035 * this.reachS.x * clamp01((this.reachTarget.y - 1.0) / 0.4) + 0.03 * this.tossShoulder.x : 0) +
        A.sgn * 0.02 * roll;
      const protT = (isTask ? 0.05 * this.reachS.x + 0.05 * this.tossShoulder.x : -0.02 * this.reachS.x) - 0.01 * A.phi.x * -1;
      if (live) {
        const w = st.timing.armFreq * hitLoose;
        const z = this.hit ? Math.min(0.4, st.timing.armDamping) : st.timing.armDamping;
        A.phi.step(phiT, w, z, dt);
        A.alpha.step(alphaT, w, z + 0.15, dt);
        A.eps.step(epsT, w * 1.3, z + 0.1, dt);
        A.beta.step(betaT, w * 1.7, 0.55, dt);
        A.elev.step(elevT, 12, 0.6, dt);
        A.prot.step(protT, 12, 0.8, dt);
        limit(A.phi, -1.5, 2.7);
        limit(A.alpha, 0.05, 1.9);
        limit(A.eps, 0.42, 2.4);
        limit(A.beta, -0.9, 0.9);
        limit(A.elev, -0.03, 0.08);
      }
      const shoulder = add(
        J.chest,
        add(mul(rCb, A.sgn * P.shoulderWidth * 0.5), add(mul(uC, A.elev.x), mul(fCb, A.prot.x - st.posture.chestOut))),
      );
      const cphi = Math.cos(A.phi.x);
      const sphi = Math.sin(A.phi.x);
      let dirU = add(mul(uC, -cphi), mul(fCb, sphi));
      dirU = norm(add(mul(dirU, Math.cos(A.alpha.x)), mul(rCb, A.sgn * Math.sin(A.alpha.x))));
      const qRaw = add(fCb, add(mul(uC, 0.35), mul(rCb, -A.sgn * 0.22)));
      const q = norm(sub(qRaw, mul(dirU, dot(qRaw, dirU))));
      const dirF = add(mul(dirU, Math.cos(A.eps.x)), mul(q, Math.sin(A.eps.x)));
      const q2 = norm(sub(q, mul(dirF, dot(q, dirF))));
      const hh = P.hand * 0.5;
      const beta = A.beta.x;
      const handDir = add(mul(dirF, Math.cos(beta)), mul(q2, Math.sin(beta)));
      const fkPalm = add(shoulder, add(mul(dirU, P.upperArm), add(mul(dirF, P.forearm), mul(handDir, hh))));
      let palmT = fkPalm;
      let w = 0;
      if (isTask) {
        const e = this.reachS.x;
        if (e > 0) {
          palmT = lerp3(palmT, this.reachTarget, e);
          const bump = Math.sin(Math.PI * clamp01(e)) * 0.08;
          palmT = v3(palmT.x, palmT.y + bump, palmT.z);
          w = Math.max(w, clamp01(e * 1.5));
        }
        if (this.tossW.x > 0 && tossPathPoint) {
          palmT = lerp3(palmT, tossPathPoint, this.tossW.x);
          w = Math.max(w, this.tossW.x * 0.8);
        }
      }
      // The arm's bend plane is chosen by its NORMAL, not by a pole point: a pole can end up
      // parallel to the arm (the elbow then flips), a hinge axis cannot. The pendulum's own
      // hinge axis blends to "elbow down/back and a little out" for reaches and tosses.
      const dArm = norm(sub(palmT, shoulder), mul(uC, -1));
      const nFk = norm(cross(dirU, mul(q, -1)), mul(rCb, -1));
      const nGoal = norm(add(mul(rCb, -1), mul(uC, -A.sgn * 0.4)));
      const nArm = norm(lerp3(nFk, nGoal, w), nFk);
      // Any rule "elbow direction = f(arm direction)" has a direction where it is undefined
      // (and flips either side of it). So the elbow has memory: it turns toward the wanted
      // side at a bounded rate, and simply keeps its side where the rule has no opinion.
      const wantRaw = cross(nArm, dArm);
      const trust = smooth((Math.hypot(wantRaw.x, wantRaw.y, wantRaw.z) - 0.1) / 0.35);
      const want = norm(wantRaw, mul(q, -1));
      let pole = want;
      if (!initial && A.hasPole) {
        const prev = norm(sub(A.pole, mul(dArm, dot(A.pole, dArm))), want);
        const ang = Math.atan2(dot(cross(prev, want), dArm), dot(prev, want));
        const maxTurn = w > 0.02 || this.hit ? 0.2 : 0.45;
        pole = rotate(prev, dArm, clamp(ang * (0.25 + 0.75 * trust), -maxTurn, maxTurn) * trust);
      }
      if (live || initial) {
        A.pole = pole;
        A.hasPole = true;
      }
      const l2 = Math.sqrt(P.forearm * P.forearm + hh * hh + 2 * P.forearm * hh * Math.cos(beta));
      const delta = Math.atan2(hh * Math.sin(beta), P.forearm + hh * Math.cos(beta));
      const ik = solveTwoBone(shoulder, palmT, P.upperArm, l2, pole, ARM_MAX);
      this.armAsked[side] = ik.asked;
      const c = norm(sub(ik.end, ik.mid));
      // in-plane perpendicular of the forearm on the elbow-crease side
      const nPlane = norm(cross(dArm, pole), nArm);
      const qp = norm(cross(c, nPlane), q);
      // Forearm pronation/supination: which way the palm faces. qp is the elbow-crease
      // side; the palm side `m` is qp rolled about the forearm by the pronation angle.
      let pronT = PRON_REST + (carrying ? 0.15 : 0) + clamp(0.5 * A.phi.x, -0.3, 0.5);
      if (isTask) {
        const e = this.reachS.x;
        if (e > 0) {
          // palm toward the prop on the way in, flat down onto it at contact
          const toT = norm(sub(this.reachTarget, ik.end), v3(0, -1, 0));
          const k = smooth(e * 1.25);
          const want = norm(v3(toT.x * (1 - k), toT.y * (1 - k) - k, toT.z * (1 - k)), v3(0, -1, 0));
          const wp = sub(want, mul(c, dot(want, c)));
          if (Math.hypot(wp.x, wp.y, wp.z) > 0.2) {
            const nP = norm(wp);
            let ang = -A.sgn * Math.atan2(dot(cross(qp, nP), c), dot(qp, nP));
            if (ang < -0.9) ang += Math.PI * 2;
            pronT = lerp(pronT, clamp(ang, -0.2, 3.5), smooth(e * 1.6));
          }
        }
        if (this.tossW.x > 0) pronT = lerp(pronT, this.tossPron.x, this.tossW.x);
      }
      if (live) {
        A.pron.step(pronT, 15, 0.9, dt);
        limit(A.pron, -0.3, 3.6);
      }
      const m = rotate(qp, c, -A.sgn * A.pron.x);
      const foreDir = norm(sub(mul(c, Math.cos(delta)), mul(m, Math.sin(delta))));
      const wrist = madd(ik.mid, foreDir, P.forearm);
      const handX = norm(sub(ik.end, wrist), foreDir);
      A.basis = mkBasis(handX, m, qp);
      const uDir = norm(sub(ik.mid, shoulder));
      B[`upperArm${side}`] = mkBasis(uDir, cross(nPlane, uDir), pole);
      B[`forearm${side}`] = mkBasis(foreDir, mul(m, -1), mul(qp, -1));
      B[`hand${side}`] = A.basis;
      J[`shoulder${side}`] = shoulder;
      J[`elbow${side}`] = ik.mid;
      J[`wrist${side}`] = wrist;
      J[`hand${side}`] = ik.end;
      A.palmPrev = initial ? ik.end : A.palm;
      A.palm = ik.end;
      if (carrying) hands[side] = 'grip';
      else if (isTask && (this.reachS.x > 0.25 || this.openTimer > 0)) hands[side] = 'open';
      else if (this.hit && this.hit.n < 22) hands[side] = 'open';
    }
    if (live && this.openTimer > 0) this.openTimer--;

    // Reach help: if the arm is being asked for more than it comfortably has, the body gives more.
    if (live) {
      const asked = this.armAsked[this.hand];
      if (this.reachS.x > 0.5 && this.task && this.task.kind !== 'toss') {
        if (asked > 0.955) this.reachHelp = Math.min(0.75, this.reachHelp + (asked - 0.955) * 2.2 * dt * 14 + dt * 0.1);
      } else if (this.reachS.x < 0.05) {
        this.reachHelp = Math.max(0, this.reachHelp - dt * 1.5);
      }
    }

    // ---- 14. prop -------------------------------------------------------------------
    if (live) this.updateProp(J);

    // ---- 15. squash (root-level, subtle) -----------------------------------------------
    if (live) {
      this.squashS.step(1 - 0.25 * this.tossCrouch.x + 0.012 * this.tossShoulder.x, 16, 0.45, dt);
      this.squashS.x = clamp(this.squashS.x, 0.93, 1.06);
    }

    const frame: SimFrame = {
      step: this.n,
      joints: J,
      yaw: { pelvis: wrap(yawP), chest: wrap(yawC), head: wrap(yawH) },
      lean: { pitch, roll },
      basis: B,
      hands,
      contacts: { footL: fL.planted, footR: fR.planted },
      props: [
        { id: this.prop.id, pos: { ...this.prop.pos }, vel: { ...this.prop.vel }, heldBy: this.prop.heldBy, basis: this.prop.basis },
        { id: 'stand', pos: v3(this.stand.x, STAND_H, this.stand.z), vel: v3(), heldBy: null, basis: FLAT },
      ],
      squash: this.squashS.x,
      phase: this.phaseLabel(idle, speed, vdMag),
      debug: {
        feet: {
          L: { planted: fL.planted, x: fL.x, z: fL.z, yaw: fL.yaw, pitch: fL.pitch },
          R: { planted: fR.planted, x: fR.x, z: fR.z, yaw: fR.yaw, pitch: fR.pitch },
        },
        legAsked: { ...this.legAsked },
        armAsked: { ...this.armAsked },
        root: { x: this.root.x, z: this.root.z },
        yawBase: this.yawBase.x,
        facing: this.facing,
        speed,
        stand: v3(this.stand.x, STAND_H, this.stand.z),
        events: this.events,
      },
    };
    return frame;
  }

  private pelvisStand(): number {
    return this.P.ankleHeight + this.legLen * (1 - this.S.posture.kneeSoftness) + this.hipDrop;
  }

  private phaseLabel(idle: boolean, speed: number, vdMag: number): string {
    if (this.hit) return `hit:${this.hit.heavy ? 'heavy' : 'light'}:${this.hit.phase}`;
    const carry = this.propState === 'held' ? '+carry' : '';
    if (this.task) return `${this.task.kind}:${this.task.phase}${this.task.kind === 'toss' ? '' : carry}`;
    const stepping = !this.feet.L.planted || !this.feet.R.planted || this.pending !== null;
    if (vdMag > 1e-6) {
      const mis = Math.abs(wrap(yawOf(this.cmdVd.x, this.cmdVd.z) - this.yawBase.x));
      return (mis > 1.2 ? 'reverse' : speed < 0.5 * this.walkSpeed() ? 'start' : 'walk') + carry;
    }
    if (speed > 0.08) return 'stop' + carry;
    if (Math.abs(this.facing - this.yawBase.x) > 0.12) return 'turn' + carry;
    if (stepping) return 'settle' + carry;
    return (idle ? 'idle' : 'stand') + carry;
  }

  // ------------------------------------------------------------------ feet

  private updateFeet(locked: boolean, speed: number): void {
    const st = this.S;
    const dt = DT;
    // swinging feet
    for (const f of [this.feet.L, this.feet.R]) {
      if (f.planted) continue;
      f.u += dt / f.T;
      if (f.u >= 1 - 1e-9) {
        // touch-down: from this step the foot is world-locked
        f.u = 1;
        f.planted = true;
        f.x = f.tx;
        f.z = f.tz;
        f.yaw = f.tyaw;
        f.pitch = f.landPitch;
        f.lift = 0;
        f.toeFlat = 1;
        f.age = 0;
        f.forced = false;
        const d = Math.hypot(f.tx - f.fx, f.tz - f.fz);
        this.dip.kick(-st.gait.bounce * this.K * (0.25 + speed + (this.hit ? 0.6 : 0)) * clamp01(0.3 + d / (0.4 * this.K)));
        this.squashS.kick(-0.25 * st.gait.bounce * (0.3 + speed));
        this.events.push({ step: this.n, type: 'footPlant', note: f.side });
        continue;
      }
      if (!f.forced && f.u < 0.72) {
        const t = this.stepTarget(f, (1 - f.u) * f.T, f.T);
        f.gx = t.x;
        f.gz = t.z;
        f.gyaw = t.yaw;
      }
      {
        // the landing spot chases its goal smoothly, so a change of plan never jerks the foot
        const w = 17;
        const den = 1 + 2 * w * dt + w * w * dt * dt;
        f.tvx = (f.tvx + w * w * (f.gx - f.tx) * dt) / den;
        f.tvz = (f.tvz + w * w * (f.gz - f.tz) * dt) / den;
        f.tvyaw = (f.tvyaw + w * w * (f.gyaw - f.tyaw) * dt) / den;
        f.tx += f.tvx * dt;
        f.tz += f.tvz * dt;
        f.tyaw += f.tvyaw * dt;
        const along = (f.tx - f.fx) * Math.cos(f.tyaw) - (f.tz - f.fz) * Math.sin(f.tyaw);
        const lp = -st.gait.heelStrike * clamp(along / (0.5 * this.K), -0.5, 1);
        f.landPitch += (lp - f.landPitch) * 0.2;
      }
      const e = smooth(f.u) * 0.75 + minJerk(f.u) * 0.25;
      f.x = lerp(f.fx, f.tx, e);
      f.z = lerp(f.fz, f.tz, e);
      f.yaw = lerp(f.fyaw, f.tyaw, smooth(f.u));
      f.lift = f.h * Math.pow(Math.sin(Math.PI * Math.pow(f.u, 0.82)), 1.25);
      if (!(f.lift > 0)) f.lift = 0;
      f.pitch =
        f.fpitch * (1 - smooth(f.u / 0.45)) +
        f.toeDown * Math.sin(Math.PI * clamp01(f.u / 0.62)) +
        f.landPitch * smooth((f.u - 0.5) / 0.5);
      f.toeFlat = Math.max(0, f.toeFlat - dt * 9);
    }

    const L = this.feet.L;
    const R = this.feet.R;
    if (!L.planted || !R.planted) return;
    if (locked) {
      this.pending = null;
      return;
    }
    const sdEff = Math.hypot(this.vdEff.x, this.vdEff.z);
    const inHit = !!this.hit && this.hit.phase !== 'recover';
    const moving = sdEff > 0.1 || speed > 0.3 * this.K;
    const thrPos = (moving ? 0.06 : 0.1) * this.K;
    const thrYaw = 0.24;
    const turnDir = this.facing - this.yawBase.x;
    let best: Foot | null = null;
    let bestU = 0;
    let bestT = 0;
    let bestTarget = { x: 0, z: 0, yaw: 0 };
    for (const f of [L, R]) {
      const swingGuess = lerp(st.timing.turnSwingTime, this.swingTime(), this.speedFrac(Math.max(speed, sdEff)));
      const t = this.stepTarget(f, swingGuess, swingGuess);
      const posErr = Math.hypot(t.x - f.x, t.z - f.z);
      const yawErr = Math.abs(t.yaw - f.yaw);
      let uu = posErr / thrPos + yawErr / thrYaw;
      if (yawErr > 0.1 && turnDir * f.sgn < 0) uu += 0.35; // the foot on the inside of a turn opens first
      // emergency: the hip is running away from this foot
      const hipDist = Math.hypot(this.root.x - f.x, this.root.z - f.z);
      if (hipDist > 0.5 * this.legLen) uu += 3;
      // a foot that has already started shifting the weight off itself keeps the turn
      if (this.pending && this.pending.side === f.side && uu >= 1) uu += 100;
      if (uu > bestU) {
        bestU = uu;
        best = f;
        bestTarget = t;
        const travel = clamp01(posErr / (0.5 * this.K));
        bestT = lerp(st.timing.turnSwingTime * (1 + 0.25 * travel), this.swingTime(), travel * this.speedFrac(speed)) * (inHit ? 0.8 : 1);
      }
    }
    if (!best || bestU < 1) {
      this.pending = null;
      return;
    }
    const o = this.other(best);
    const ds = Math.round(st.timing.doubleSupport * 60 * (inHit || !moving ? 0.5 : 1));
    if (o.age < ds) return;
    const slow = speed < 0.4 * this.K && !inHit;
    if (slow) {
      // Weight goes over the stance foot first.
      if (!this.pending || this.pending.side !== best.side) {
        this.pending = { side: best.side, wait: 0, start: this.swayS.x };
        return;
      }
      this.pending.wait++;
      const rB = rgt(this.yawBase.x);
      const lat = (o.x - this.root.x) * rB.x + (o.z - this.root.z) * rB.z;
      const frac = Math.min(0.95, lerp(0.85, 0.3, this.speedFrac()) * st.gait.sway);
      const tgt = lat * frac;
      const total = Math.abs(tgt - this.pending.start);
      const done = total < 1e-4 ? 1 : 1 - Math.abs(tgt - this.swayS.x) / total;
      const maxWait = sdEff > 0.1 ? 4 : 6;
      if (this.pending.wait < 2 || (done < 0.4 && this.pending.wait < maxWait)) return;
    }
    this.liftFoot(best, bestTarget, bestT, false);
  }

  // ------------------------------------------------------------------ tasks

  /** Advances the active task; returns a velocity request when the task owns the legs. */
  private updateTask(): { x: number; z: number } | null {
    const t = this.task;
    const st = this.S;
    if (this.reachS.moving) this.reachS.step(DT);
    for (const m of [this.tossW, this.tossCrouch, this.tossLean, this.tossYawP, this.tossYawC, this.tossWrist, this.tossOff, this.tossShoulder, this.tossPron]) {
      m.step(DT);
    }
    if (!this.tossRootLock) this.tossG.step(DT);
    if (!t) return null;
    const bothDown = this.feet.L.planted && this.feet.R.planted && !this.pending;

    if (t.kind === 'reach' || t.kind === 'place') {
      const target = t.kind === 'reach' ? this.prop.pos : this.standTop();
      if (t.kind === 'reach' && t.n < 0) {
        // wait for the prop to come to rest before committing to a spot
        if (!this.propAtRest()) return { x: 0, z: 0 };
        t.spot = this.approachSpot(target);
        t.n = 0;
      }
      t.n++;
      if (t.phase === 'approach') {
        const dx = t.spot.x - this.root.x;
        const dz = t.spot.z - this.root.z;
        const D = Math.hypot(dx, dz);
        const toT = yawOf(target.x - this.root.x, target.z - this.root.z);
        if (D > 0.3 * this.K) this.setFacing(yawOf(dx, dz));
        else this.setFacing(toT);
        if (D > 0.05) {
          const sp = Math.min(this.walkSpeed(), D * 2.6 + 0.12);
          return { x: (dx / D) * sp, z: (dz / D) * sp };
        }
        if (this.speed() < 0.06 && bothDown && Math.abs(this.facing - this.yawBase.x) < 0.14) {
          t.phase = 'extend';
          if (this.reachS.x <= 1e-9) this.reachTarget = { ...target };
          else this.reachTarget = { ...target };
          const from = this.arms[this.hand].palm;
          const T = st.timing.reachTime * clamp(0.75 + dist(from, target) * 0.5, 0.8, 1.6);
          this.reachS.to(1, T);
        }
        return { x: 0, z: 0 };
      }
      if (t.phase === 'extend') {
        if (this.reachS.arrived && this.reachS.x === 1) {
          const palm = this.arms[this.hand].palm;
          const off = dist(palm, this.reachTarget);
          if (off < 1e-6) {
            if (t.kind === 'reach') {
              t.phase = 'ready';
              t.n = 0;
            } else if (dist(this.arms[this.hand].palm, this.arms[this.hand].palmPrev) < 1e-9) {
              // PLACE: the bag is let go exactly where the palm is, at rest.
              const A = this.arms[this.hand];
              const pv = mul(sub(A.palm, A.palmPrev), 1 / DT);
              this.propState = 'stand';
              this.prop.heldBy = null;
              this.prop.pos = { ...A.palm };
              this.prop.vel = v3();
              this.events.push({ step: this.n, type: 'place', posMismatch: dist(A.palm, this.standTop()), velMismatch: Math.hypot(pv.x, pv.y, pv.z) });
              t.phase = 'release';
              t.n = 0;
              this.openTimer = 30;
            }
          } else if (t.n > 240) {
            // could not get there (should not happen): give up cleanly
            this.note('ignored', `${t.kind}: target out of reach by ${off.toFixed(4)} m`);
            this.abortTask();
          }
        }
        return { x: 0, z: 0 };
      }
      if (t.kind === 'reach' && t.phase === 'ready') {
        if (t.wantGrip && t.n >= 2) {
          const A = this.arms[this.hand];
          const pv = mul(sub(A.palm, A.palmPrev), 1 / DT);
          this.events.push({
            step: this.n,
            type: 'grip',
            posMismatch: dist(A.palm, this.prop.pos),
            velMismatch: dist(pv, this.prop.vel),
          });
          this.propState = 'held';
          this.prop.heldBy = this.hand;
          this.propRel = relBasis(A.basis, this.prop.basis);
          this.propSpin = 0;
          t.phase = 'lift';
          t.n = 0;
        }
        return { x: 0, z: 0 };
      }
      if (t.kind === 'reach' && t.phase === 'lift') {
        if (t.n === 6) this.reachS.to(0, st.timing.reachTime * 0.95);
        if (t.n > 6 && this.reachS.arrived) this.task = null;
        return t.n <= 6 ? { x: 0, z: 0 } : null;
      }
      if (t.kind === 'place' && t.phase === 'release') {
        if (t.n >= 7) {
          t.phase = 'withdraw';
          this.reachS.to(0, st.timing.reachTime * 0.9);
        }
        return { x: 0, z: 0 };
      }
      if (t.kind === 'place' && t.phase === 'withdraw') {
        if (this.reachS.arrived) this.task = null;
        return null;
      }
      return null;
    }

    // ---- toss
    const Ts = st.acting.toss;
    if (t.phase === 'settle') {
      t.n++;
      // The wind-up may begin while the feet are still step-turning toward the throw line.
      if (this.speed() < 0.08 && this.reachS.x < 0.02) {
        t.plan = this.planToss(t.power);
        t.phase = 'load';
        t.n = 0;
        const pl = t.plan;
        const TL = pl.nLoad * DT;
        const ant = st.acting.anticipation;
        this.tossTarget = this.tossBackPoint(pl);
        this.tossW.to(1, TL * 0.9);
        this.tossG.x = 0;
        this.tossG.v = 0;
        this.tossG.to(-pl.back, TL);
        this.tossRootLock = true;
        this.tossCrouch.to(Ts.loadCrouch * (0.6 + 0.4 * ant), TL * 0.85);
        this.tossLean.to(Ts.loadLean, TL * 0.9);
        const side = this.hand === 'R' ? 1 : -1;
        this.tossYawP.to(-side * Ts.bodyTurn * 0.45, TL * 0.8);
        this.tossYawC.to(-side * Ts.bodyTurn, TL);
        this.tossPron.x = this.arms[this.hand].pron.x;
        this.tossPron.v = 0;
        this.tossPron.to(1.35, TL);
        this.tossWrist.to(-0.45 * Ts.wristWhip, TL);
        this.tossOff.to(Ts.offArm * 0.7, TL);
        this.tossShoulder.to(-0.6, TL);
      }
      return { x: 0, z: 0 };
    }
    const pl = t.plan as TossPlan;
    const k = t.n;
    const side = this.hand === 'R' ? 1 : -1;
    const nSwing = pl.n1 + pl.n2;
    this.tossHolding = false;
    if (k === pl.nLoad - 4 && !(bothDown && Math.abs(this.facing - this.yawBase.x) < 0.32)) {
      // Loaded, but the turn has not come round yet: hold the wind-up until the feet are under the throw.
      this.tossTarget = this.tossBackPoint(pl);
      this.tossHolding = true;
      return { x: 0, z: 0 };
    }
    if (k === pl.nLoad - 3 && Ts.stride) {
      // stride: the opposite foot steps out and plants BEFORE the release
      const f = this.hand === 'R' ? this.feet.L : this.feet.R;
      if (f.planted && this.other(f).planted) {
        const d = fwd(pl.yaw);
        const Tst = clamp((nSwing + 1) * DT, 0.2, 0.34);
        const sl = Ts.strideLen * this.K;
        this.liftFoot(f, { x: f.x + d.x * sl, z: f.z + d.z * sl, yaw: f.yaw }, Tst, true);
      }
    }
    if (k === pl.nLoad) {
      t.phase = 'swing';
      // the arc starts from wherever the wound-up hand actually is
      pl.pB = { ...this.tossTarget };
      // pelvis drives first ...
      this.tossG.to(pl.fwd, (nSwing + 9) * DT);
      this.tossYawP.to(side * Ts.bodyTurn * 0.4, (nSwing + 1) * DT);
      // the forearm supinates through the downswing so the palm faces the release direction
      this.tossPron.to(0.12, (nSwing + 1) * DT);
      this.tossCrouch.to(-0.012, (nSwing + 2) * DT);
    }
    if (k === pl.nLoad + 2) {
      // ... then the chest opens and the shoulder leads ...
      this.tossYawC.to(side * Ts.bodyTurn * 0.75, (nSwing + 2) * DT);
      this.tossLean.to(-0.07, (nSwing + 5) * DT);
      this.tossShoulder.to(1, nSwing * DT);
      this.tossOff.to(-Ts.offArm, (nSwing + 4) * DT);
    }
    if (k === pl.nLoad + Math.max(1, pl.n1 - 1)) {
      // ... and the wrist comes through last.
      this.tossWrist.to(Ts.wristWhip, (pl.n2 + 3) * DT);
    }
    // the hand path (world-anchored Hermite arc through back -> low -> release -> finish)
    const zero = v3();
    if (k < pl.nLoad) this.tossTarget = this.tossBackPoint(pl);
    else if (k === pl.nLoad) this.tossTarget = pl.pB;
    else if (k <= pl.nLoad + pl.n1) this.tossTarget = hermite(pl.pB, zero, pl.pLow, pl.vLow, pl.n1 * DT, (k - pl.nLoad) / pl.n1);
    else if (k <= pl.nLoad + nSwing) this.tossTarget = hermite(pl.pLow, pl.vLow, pl.pR, pl.v0, pl.n2 * DT, (k - pl.nLoad - pl.n1) / pl.n2);
    else if (k <= pl.nLoad + nSwing + pl.n3) this.tossTarget = hermite(pl.pR, pl.v0, pl.pF, zero, pl.n3 * DT, (k - pl.nLoad - nSwing) / pl.n3);
    else this.tossTarget = pl.pF;
    if (k === pl.nLoad + nSwing + 1) t.phase = 'follow';
    const endAt = pl.nLoad + nSwing + pl.n3 + pl.hold;
    if (k === endAt) {
      t.phase = 'recover';
      this.endToss(0.42);
    }
    if (k >= endAt + 26) this.task = null;
    t.n++;
    return k < endAt ? { x: 0, z: 0 } : null;
  }

  /** The wound-up hand position, carried by the body so it comes round with a turn. */
  private tossBackPoint(pl: TossPlan): Vec3 {
    const side = this.hand === 'R' ? 1 : -1;
    const yaw = this.yawBase.x;
    const d = fwd(yaw);
    const r = rgt(yaw);
    const rad = 0.93 * this.armLen;
    const along = pl.leanB + rad * Math.sin(pl.thB);
    const lat = side * (this.P.shoulderWidth * 0.5 + 0.08);
    return v3(this.root.x + d.x * along + r.x * lat, pl.shY - pl.dropB - rad * Math.cos(pl.thB), this.root.z + d.z * along + r.z * lat);
  }

  private planToss(power: number): TossPlan {
    const P = this.P;
    const st = this.S;
    const Ts = st.acting.toss;
    const side = this.hand === 'R' ? 1 : -1;
    const yaw = this.facing;
    const d = fwd(yaw);
    const r = rgt(yaw);
    const range = lerp(1.8, 6.0, power);
    const el = lerp(0.74, 0.62, power);
    const speed0 = Math.sqrt((range * G) / Math.sin(2 * el)) * 0.92;
    const v0 = v3(d.x * speed0 * Math.cos(el), speed0 * Math.sin(el), d.z * speed0 * Math.cos(el));
    const vLowMag = 0.7 * speed0;
    const vLow = v3(d.x * vLowMag, 0, d.z * vLowMag);
    const back = (Ts.stride ? 0.07 : 0.045) * this.K;
    const forward = (Ts.stride ? 0.62 * Ts.strideLen : 0.075) * this.K;
    const A = this.armLen;
    const sh = this._frame.joints[`shoulder${this.hand}`];
    const shY = sh.y;
    const ox = this.root.x;
    const oz = this.root.z;
    const base = (g: number, dy: number): Vec3 => v3(ox + d.x * g + r.x * side * (P.shoulderWidth * 0.5), shY + dy, oz + d.z * g + r.z * side * (P.shoulderWidth * 0.5));
    const pt = (s: Vec3, ang: number, rad: number, lat: number): Vec3 =>
      v3(s.x + d.x * rad * Math.sin(ang) + r.x * side * lat, s.y - rad * Math.cos(ang), s.z + d.z * rad * Math.sin(ang) + r.z * side * lat);
    const thB = -Ts.backswing * (0.75 + 0.25 * power);
    const leanB = Ts.loadLean * 0.3;
    const thR = el * 0.92;
    const thF = Ts.followHeight;
    const nLoad = Math.max(8, Math.round(Ts.loadTime * 60));
    // first pass with a fixed shoulder to get durations, second with the planned root travel
    let n1 = 12;
    let n2 = 5;
    let n3 = 10;
    let pB = v3();
    let pLow = v3();
    let pR = v3();
    let pF = v3();
    const Tg = (n: number) => (n1 + n2 + 9) * DT || n;
    for (let pass = 0; pass < 2; pass++) {
      const gAt = (n: number): number => -back + (forward + back) * minJerk((n * DT) / Tg(n));
      pB = pt(base(-back + leanB, -Ts.loadCrouch * 0.8 - 0.03), thB, 0.93 * A, 0.08);
      pLow = pt(base(gAt(n1) + 0.05, -Ts.loadCrouch * 0.3 - 0.02), 0.06, 0.93 * A, 0.1);
      pR = pt(base(gAt(n1 + n2), 0.0), thR, 0.88 * A, 0.05);
      pF = pt(base(pass === 0 ? forward : gAt(n1 + n2 + n3), 0.01), thF, 0.84 * A, -0.04);
      n1 = Math.max(6, Math.round((1.9 * dist(pB, pLow)) / vLowMag / DT));
      n2 = Math.max(3, Math.round(dist(pLow, pR) / (0.5 * (vLowMag + speed0)) / DT));
      n3 = Math.max(7, Math.round(((2.1 * dist(pR, pF)) / speed0 / DT) * Ts.followLen));
    }
    return {
      ox,
      oz,
      yaw,
      nLoad,
      n1,
      n2,
      n3,
      hold: Ts.followHold,
      thB,
      leanB,
      shY,
      dropB: Ts.loadCrouch * 0.8 + 0.03,
      pB,
      pLow,
      pR,
      pF,
      vLow,
      v0,
      back,
      fwd: forward,
      released: false,
    };
  }

  // ------------------------------------------------------------------ prop

  private updateProp(J: Record<JointName, Vec3>): void {
    const p = this.prop;
    const t = this.task;
    if (this.propState === 'held') {
      const side = p.heldBy as Side;
      const A = this.arms[side];
      const palm = J[`hand${side}`];
      const pv = mul(sub(A.palm, A.palmPrev), 1 / DT);
      // RELEASE: on exactly this step the bag takes the palm's position and velocity.
      if (t && t.kind === 'toss' && t.plan && !t.plan.released && t.n - 1 === t.plan.nLoad + t.plan.n1 + t.plan.n2) {
        t.plan.released = true;
        p.pos = { ...palm };
        p.vel = { ...pv };
        p.heldBy = null;
        this.propState = 'air';
        this.propSpin = 5;
        this.propAxis = rgt(t.plan.yaw); // tumbles forward, end over end
        this.openTimer = 26;
        this.squashS.kick(0.35);
        this.events.push({
          step: this.n,
          type: 'release',
          posMismatch: dist(p.pos, palm),
          velMismatch: dist(p.vel, pv),
          launchError: dist(pv, t.plan.v0),
        });
        return;
      }
      p.pos = { ...palm };
      p.vel = pv;
      p.basis = applyBasis(A.basis, this.propRel); // rigid in the hand: position AND orientation
      return;
    }
    if (this.propState === 'air') {
      p.vel.y -= G * DT;
      p.pos = madd(p.pos, p.vel, DT);
      p.basis = rotateBasis(p.basis, this.propAxis, this.propSpin * DT);
      if (p.pos.y <= BAG_REST && p.vel.y < 0) {
        p.pos.y = BAG_REST;
        p.vel.y = 0;
        p.vel.x *= 0.5;
        p.vel.z *= 0.5;
        this.propSpin *= 0.2;
        this.propState = 'ground';
        this.events.push({ step: this.n, type: 'land' });
      }
      return;
    }
    if (this.propState === 'ground') {
      const s = Math.hypot(p.vel.x, p.vel.z);
      if (s > 1e-6) {
        const dec = Math.min(s, 0.6 * G * DT);
        p.vel.x -= (p.vel.x / s) * dec;
        p.vel.z -= (p.vel.z / s) * dec;
        p.pos.x += p.vel.x * DT;
        p.pos.z += p.vel.z * DT;
      } else {
        p.vel = v3();
      }
      // a bean bag flops flat: its face normal settles onto the ground normal (either face)
      const up = p.basis.y.y >= 0 ? UP : v3(0, -1, 0);
      const ax = cross(p.basis.y, up);
      const sn = Math.hypot(ax.x, ax.y, ax.z);
      if (sn > 1e-6) {
        const ang = Math.asin(Math.min(1, sn));
        p.basis = rotateBasis(p.basis, mul(ax, 1 / sn), Math.min(ang, Math.max(ang * 0.3, 0.02)));
      }
      if (s > 1e-6) p.basis = rotateBasis(p.basis, UP, this.propSpin * 0.2 * DT);
    }
  }
}

function limit(s: Spring, lo: number, hi: number): void {
  if (s.x < lo) {
    s.x = lo;
    if (s.v < 0) s.v = 0;
  } else if (s.x > hi) {
    s.x = hi;
    if (s.v > 0) s.v = 0;
  }
}

export function createSim(options: SimOptions): Sim {
  return new CharacterSim(options);
}
