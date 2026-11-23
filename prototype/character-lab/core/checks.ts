// Headless checks for the Character Lab core. Pure TypeScript, no DOM:
//   node --import ./prototype/character-lab/core/ts-loader.mjs prototype/character-lab/core/run-checks.mjs
// Every limit below is a stated threshold; the report prints the measured value
// next to it so a pass is never just "true".
import { facing, makeCamera, project, viewAngle } from './camera';
import {
  basisAngle,
  cross,
  dist,
  dot,
  len,
  makeRng,
  relBasis,
  sub,
  wrap,
} from './math';
import { SEQUENCES } from './sequence';
import type { SequenceInfo, SequenceName } from './sequence';
import type { SimFrame, SimOptions } from './sim';
import type { MotionStyle } from './style';
import { Timeline } from './timeline';
import { JOINT_NAMES, SEGMENT_NAMES } from './types';
import type {
  Basis,
  Command,
  JointName,
  Proportions,
  SegmentName,
  Vec3,
} from './types';

export interface CheckLine {
  name: string;
  ok: boolean;
  measured: string;
  limit: string;
  where?: string;
}

export interface CheckReport {
  ok: boolean;
  lines: CheckLine[];
}

export interface CheckConfig {
  label: string;
  proportions: Proportions;
  style: MotionStyle;
}

/** Thresholds (per 1/60 s step unless stated). */
export const LIMITS = {
  plantDrift: 1e-6, // m, world drift of a planted foot's locked point
  plantYaw: 1e-9, // rad, yaw drift of a planted foot
  boneLength: 1e-6, // m, any limb bone length error
  legReach: 0.995, // hip->ankle distance / (thigh + shin)
  armReach: 0.9851, // shoulder->palm distance / (upperArm + forearm-with-hand), never over-stretched
  propPos: 1e-9, // m, palm vs prop at grip / place / release and while held
  propVel: 1e-9, // m/s, palm vs prop velocity at grip / release
  propBasis: 1e-9, // max element drift of the prop's basis inside the hand's basis while held
  launchError: 0.05, // m/s, palm velocity at release vs the planned launch velocity
  orthonormal: 1e-9,
  // continuity: max change per step
  trunkStep: 0.09, // m (pelvis, spine, chest, neck, head, headTop): 5.4 m/s, reached only by the head in a heavy hit
  hipKneeStep: 0.12, // m
  footStep: 0.15, // m (ankle, heel, toe): a stagger catch-step peaks near 9 m/s
  elbowStep: 0.14, // m (shoulder, elbow)
  handStep: 0.24, // m (wrist, palm): a hard toss moves the hand at ~9 m/s
  // second difference (a pop shows up here even when the speed is legal)
  trunkAccel: 0.012, // m/step^2 (pelvis, spine, chest)
  headAccel: 0.025, // m/step^2 (neck, head, headTop: the head is allowed to snap round, it leads every turn)
  limbAccel: 0.06, // m/step^2
  handAccel: 0.075, // m/step^2
  yawStep: 0.2, // rad (pelvis, chest, head yaw)
  leanStep: 0.09, // rad (trunk pitch / roll)
  hingeStep: 0.45, // rad (knee and elbow interior angle)
  trunkBasisStep: 0.22, // rad (pelvis, spine, chest, head)
  limbBasisStep: 0.6, // rad (thigh, shin, foot, upper arm)
  handBasisStep: 0.8, // rad (forearm roll, hand)
} as const;

const TRUNK: JointName[] = [
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  'headTop',
];

function limitFor(j: JointName): [number, number] {
  if (j === 'neck' || j === 'head' || j === 'headTop')
    return [LIMITS.trunkStep, LIMITS.headAccel];
  if (TRUNK.includes(j)) return [LIMITS.trunkStep, LIMITS.trunkAccel];
  if (j.startsWith('hip') || j.startsWith('knee'))
    return [LIMITS.hipKneeStep, LIMITS.limbAccel];
  if (j.startsWith('ankle') || j.startsWith('heel') || j.startsWith('toe'))
    return [LIMITS.footStep, LIMITS.limbAccel];
  if (j.startsWith('shoulder') || j.startsWith('elbow'))
    return [LIMITS.elbowStep, LIMITS.limbAccel];
  return [LIMITS.handStep, LIMITS.handAccel];
}

function basisLimit(s: SegmentName): number {
  if (s === 'pelvis' || s === 'spine' || s === 'chest' || s === 'head')
    return LIMITS.trunkBasisStep;
  if (s.startsWith('forearm') || s.startsWith('hand'))
    return LIMITS.handBasisStep;
  return LIMITS.limbBasisStep;
}

class Max {
  v = -Infinity;
  where = '';
  add(v: number, where: string): void {
    if (!(v <= this.v)) {
      // also catches NaN
      this.v = v;
      this.where = where;
    }
  }
}

function hinge(a: Vec3, b: Vec3, c: Vec3): number {
  const u = sub(a, b);
  const v = sub(c, b);
  return Math.acos(
    Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v) || 1))),
  );
}

function finite(o: unknown): boolean {
  if (typeof o === 'number') return Number.isFinite(o);
  if (o && typeof o === 'object') {
    for (const k in o as Record<string, unknown>)
      if (!finite((o as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export function runSequence(options: SimOptions, seq: SequenceInfo): Timeline {
  const t = new Timeline({ ...options, start: seq.start });
  let c = 0;
  for (let i = 0; i < seq.length; i++) {
    while (c < seq.schedule.length && seq.schedule[c].step <= i)
      t.command(seq.schedule[c++].cmd);
    t.step();
  }
  return t;
}

/** The contract's known-angle test for facing() and viewAngle(). */
export function checkAngles(): CheckLine[] {
  const near = (a: number, b: number) => Math.abs(wrap(a - b)) < 1e-12;
  const yawOfDir = (x: number, z: number) => Math.atan2(-z, x);
  const f = facing(-Math.PI / 2);
  const lines: CheckLine[] = [];
  const add = (name: string, ok: boolean, measured: string, limit: string) =>
    lines.push({ name, ok, measured, limit });
  add(
    'facing(0) = +X, facing(+90deg) = -Z, facing(-90deg) = +Z',
    Math.abs(facing(0).x - 1) < 1e-12 &&
      Math.abs(facing(Math.PI / 2).z + 1) < 1e-12 &&
      Math.abs(f.z - 1) < 1e-12,
    `${facing(0).x},${facing(Math.PI / 2).z},${f.z}`,
    '1,-1,1',
  );
  const cases: [string, number, number, number][] = [
    ['facing +Z at camYaw 0 is front (+90deg)', 0, 1, Math.PI / 2],
    ['facing +X at camYaw 0 is side facing screen-right (0)', 1, 0, 0],
    ['facing -Z at camYaw 0 is back (-90deg)', 0, -1, -Math.PI / 2],
    ['facing -X at camYaw 0 is side mirrored (180deg)', -1, 0, Math.PI],
  ];
  for (const [name, x, z, want] of cases) {
    const a = viewAngle(yawOfDir(x, z), 0);
    add(name, near(a, want), a.toFixed(6), want.toFixed(6));
  }
  // viewAngle must agree with the projection itself: a facing vector drawn on screen.
  let worst = 0;
  let worstOrbit = 0;
  for (let i = 0; i < 48; i++) {
    const yaw = -3 + i * 0.131;
    for (let k = 0; k < 12; k++) {
      const camYaw = -3.1 + k * 0.55;
      const cam = makeCamera(camYaw, 0);
      const o = project({ x: 0, y: 0, z: 0 }, cam);
      const p = project(facing(yaw), cam);
      const onScreen = Math.atan2(p.depth - o.depth, p.x - o.x);
      worst = Math.max(
        worst,
        Math.abs(wrap(onScreen - viewAngle(yaw, camYaw))),
      );
      const a = 0.37 + k * 0.2;
      worstOrbit = Math.max(
        worstOrbit,
        Math.abs(wrap(viewAngle(yaw, camYaw + a) - viewAngle(yaw - a, camYaw))),
      );
    }
  }
  add(
    'viewAngle equals the on-screen angle of the projected facing vector',
    worst < 1e-9,
    worst.toExponential(2),
    '1e-9',
  );
  add(
    'orbiting the camera by +a equals turning the character by -a',
    worstOrbit < 1e-9,
    worstOrbit.toExponential(2),
    '1e-9',
  );
  return lines;
}

/** All per-frame invariants over one recorded run. */
export function checkFrames(
  label: string,
  options: SimOptions,
  timeline: Timeline,
  camYawAt?: (step: number) => number,
): CheckLine[] {
  const frames = timeline.frames;
  const P = options.proportions;
  const leg = P.thigh + P.shin;
  const drift = new Max();
  const yawDrift = new Max();
  const contactDrift = new Max();
  const orbitRound = new Max();
  const bone = new Max();
  const legReach = new Max();
  const armReach = new Max();
  const propPos = new Max();
  const propVel = new Max();
  const propBasis = new Max();
  const launch = new Max();
  const ortho = new Max();
  const prevOff: Record<string, Vec3> = {};
  const kneeFlip = new Max();
  const kneeToe = new Max();
  const elbowFlip = new Max();
  const yawStep = new Max();
  const leanStep = new Max();
  const hingeStep = new Max();
  const posStep: Record<string, Max> = {};
  const posAcc: Record<string, Max> = {};
  const posOver = new Max();
  const accOver = new Max();
  const basisStep: Record<string, Max> = {
    trunk: new Max(),
    limb: new Max(),
    hand: new Max(),
  };
  const basisOver = new Max();
  let nan = -1;
  let events = { grip: 0, release: 0, place: 0, drop: 0 };
  let armClamped = 0;
  let heldRel: Basis | null = null;
  const commandSteps = new Set(timeline.commands.map((c) => c.step));
  const boundary = new Max(); // worst position step within 2 steps after any command, as a fraction of its limit
  const impact = new Max(); // 2nd difference on the step a hit lands, as a fraction of 6x the normal limit
  const hitSteps = new Set(
    timeline.commands.filter((c) => c.cmd.type === 'hit').map((c) => c.step),
  );

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const at = `${label} step ${i} (${f.phase})`;
    if (
      nan < 0 &&
      !finite({
        j: f.joints,
        b: f.basis,
        y: f.yaw,
        l: f.lean,
        p: f.props,
        s: f.squash,
      })
    )
      nan = i;
    const J = f.joints;
    // bone lengths never change
    for (const s of ['L', 'R'] as const) {
      bone.add(Math.abs(dist(J[`hip${s}`], J[`knee${s}`]) - P.thigh), at);
      bone.add(Math.abs(dist(J[`knee${s}`], J[`ankle${s}`]) - P.shin), at);
      bone.add(
        Math.abs(dist(J[`shoulder${s}`], J[`elbow${s}`]) - P.upperArm),
        at,
      );
      bone.add(Math.abs(dist(J[`elbow${s}`], J[`wrist${s}`]) - P.forearm), at);
      bone.add(
        Math.abs(dist(J[`wrist${s}`], J[`hand${s}`]) - P.hand * 0.5),
        at,
      );
      legReach.add(dist(J[`hip${s}`], J[`ankle${s}`]) / leg, at);
      legReach.add(f.debug.legAsked[s], at);
      const l2 = dist(J[`elbow${s}`], J[`hand${s}`]);
      armReach.add(
        dist(J[`shoulder${s}`], J[`hand${s}`]) / (P.upperArm + l2),
        at,
      );
      if (f.debug.armAsked[s] > 0.985 + 1e-9) armClamped++;
      // knee: bends toward the kneecap side, and the kneecap never points behind the toes
      const hip = J[`hip${s}`];
      const an = J[`ankle${s}`];
      const ax = sub(an, hip);
      const t = dot(sub(J[`knee${s}`], hip), ax) / dot(ax, ax);
      const off = sub(J[`knee${s}`], {
        x: hip.x + ax.x * t,
        y: hip.y + ax.y * t,
        z: hip.z + ax.z * t,
      });
      if (len(off) > 0.015 && prevOff[`k${s}`] && len(prevOff[`k${s}`]) > 0.015)
        kneeFlip.add(
          -dot(off, prevOff[`k${s}`]) / (len(off) * len(prevOff[`k${s}`])),
          at,
        );
      prevOff[`k${s}`] = off;
      const fd = f.debug.feet[s];
      const toe = facing(fd.yaw);
      // the knee sits on the toe side of the hip-ankle line (m behind it; must stay <= 1 cm)
      kneeToe.add(-(off.x * toe.x + off.z * toe.z), at);
      // elbow: bends toward the elbow-point side
      const sh = J[`shoulder${s}`];
      const hd = J[`hand${s}`];
      const ex = sub(hd, sh);
      const te = dot(sub(J[`elbow${s}`], sh), ex) / dot(ex, ex);
      const eoff = sub(J[`elbow${s}`], {
        x: sh.x + ex.x * te,
        y: sh.y + ex.y * te,
        z: sh.z + ex.z * te,
      });
      if (
        len(eoff) > 0.015 &&
        prevOff[`e${s}`] &&
        len(prevOff[`e${s}`]) > 0.015
      )
        elbowFlip.add(
          -dot(eoff, prevOff[`e${s}`]) / (len(eoff) * len(prevOff[`e${s}`])),
          at,
        );
      prevOff[`e${s}`] = eoff;
    }
    // bases orthonormal, right-handed with y = z cross x
    const allBases: Basis[] = [
      ...SEGMENT_NAMES.map((s) => f.basis[s]),
      ...f.props.map((p) => p.basis),
    ];
    for (const b of allBases) {
      ortho.add(Math.abs(len(b.x) - 1), at);
      ortho.add(Math.abs(len(b.y) - 1), at);
      ortho.add(Math.abs(len(b.z) - 1), at);
      ortho.add(Math.abs(dot(b.x, b.y)), at);
      ortho.add(Math.abs(dot(b.x, b.z)), at);
      ortho.add(dist(cross(b.z, b.x), b.y), at);
    }
    // prop: rigid in the hand while held (position AND orientation)
    const bag = f.props[0];
    if (bag.heldBy) {
      propPos.add(dist(bag.pos, J[`hand${bag.heldBy}`]), at);
      const rel = relBasis(f.basis[`hand${bag.heldBy}`], bag.basis);
      if (heldRel && i > 0 && frames[i - 1].props[0].heldBy === bag.heldBy) {
        for (const a of ['x', 'y', 'z'] as const)
          for (const c of ['x', 'y', 'z'] as const)
            propBasis.add(Math.abs(rel[a][c] - heldRel[a][c]), at);
      } else {
        heldRel = rel;
      }
    } else {
      heldRel = null;
    }
    for (const e of f.debug.events) {
      if (e.type === 'grip' || e.type === 'release' || e.type === 'place') {
        events = { ...events, [e.type]: events[e.type] + 1 };
        propPos.add(e.posMismatch ?? NaN, `${at} ${e.type}`);
        if (e.type !== 'place')
          propVel.add(e.velMismatch ?? NaN, `${at} ${e.type}`);
        else
          propVel.add(
            e.velMismatch ?? NaN,
            `${at} place (palm speed when letting go)`,
          );
        if (e.type === 'release') launch.add(e.launchError ?? NaN, at);
      }
      if (e.type === 'drop') events.drop++;
    }
    if (i === 0) continue;
    const g = frames[i - 1];
    // planted feet are world-locked
    for (const s of ['L', 'R'] as const) {
      const key = s === 'L' ? 'footL' : 'footR';
      const a = g.debug.feet[s];
      const b = f.debug.feet[s];
      if (
        g.contacts[key] &&
        f.contacts[key] &&
        !f.debug.events.some((e) => e.type === 'footPlant' && e.note === s)
      ) {
        drift.add(Math.hypot(a.x - b.x, a.z - b.z), at);
        yawDrift.add(Math.abs(a.yaw - b.yaw), at);
        // the point actually on the ground: the toe while the heel is up, the heel while the toes are up
        if (a.pitch >= 0 && b.pitch >= 0)
          contactDrift.add(
            dist(g.joints[`toe${s}`], f.joints[`toe${s}`]),
            `${at} toe${s}`,
          );
        if (a.pitch <= 0 && b.pitch <= 0)
          contactDrift.add(
            dist(g.joints[`heel${s}`], f.joints[`heel${s}`]),
            `${at} heel${s}`,
          );
        if (camYawAt) {
          // camera orbit: the locked point's world position recovered from its projection is the same point
          for (const [fr, st] of [
            [g, i - 1],
            [f, i],
          ] as [SimFrame, number][]) {
            const cam = makeCamera(camYawAt(st));
            const w = { x: fr.debug.feet[s].x, y: 0, z: fr.debug.feet[s].z };
            const p = project(w, cam);
            const toward = p.depth / Math.cos(cam.pitch);
            const c = Math.cos(cam.yaw);
            const sn = Math.sin(cam.yaw);
            const back = {
              x: p.x * c + toward * sn,
              y: 0,
              z: -p.x * sn + toward * c,
            };
            orbitRound.add(Math.hypot(back.x - a.x, back.z - a.z), at);
          }
        }
      }
    }
    // continuity
    yawStep.add(
      Math.abs(wrap(f.yaw.pelvis - g.yaw.pelvis)),
      `${at} pelvis yaw`,
    );
    yawStep.add(Math.abs(wrap(f.yaw.chest - g.yaw.chest)), `${at} chest yaw`);
    yawStep.add(Math.abs(wrap(f.yaw.head - g.yaw.head)), `${at} head yaw`);
    leanStep.add(Math.abs(f.lean.pitch - g.lean.pitch), `${at} pitch`);
    leanStep.add(Math.abs(f.lean.roll - g.lean.roll), `${at} roll`);
    for (const s of ['L', 'R'] as const) {
      hingeStep.add(
        Math.abs(
          hinge(J[`hip${s}`], J[`knee${s}`], J[`ankle${s}`]) -
            hinge(
              g.joints[`hip${s}`],
              g.joints[`knee${s}`],
              g.joints[`ankle${s}`],
            ),
        ),
        `${at} knee${s}`,
      );
      hingeStep.add(
        Math.abs(
          hinge(J[`shoulder${s}`], J[`elbow${s}`], J[`wrist${s}`]) -
            hinge(
              g.joints[`shoulder${s}`],
              g.joints[`elbow${s}`],
              g.joints[`wrist${s}`],
            ),
        ),
        `${at} elbow${s}`,
      );
    }
    const afterCommand =
      commandSteps.has(i) || commandSteps.has(i - 1) || commandSteps.has(i - 2);
    for (const j of JOINT_NAMES) {
      const [lim, alim] = limitFor(j);
      const d = dist(J[j], g.joints[j]);
      (posStep[j] ??= new Max()).add(d, at);
      posOver.add(d / lim, `${at} ${j} ${d.toFixed(4)} m`);
      if (afterCommand) boundary.add(d / lim, `${at} ${j} ${d.toFixed(4)} m`);
      if (i > 1) {
        const h = frames[i - 2].joints[j];
        const acc = Math.hypot(
          J[j].x - 2 * g.joints[j].x + h.x,
          J[j].y - 2 * g.joints[j].y + h.y,
          J[j].z - 2 * g.joints[j].z + h.z,
        );
        (posAcc[j] ??= new Max()).add(acc, at);
        if (hitSteps.has(i) || hitSteps.has(i - 1) || hitSteps.has(i - 2)) {
          // the blow itself is an impulse: a velocity jump is the point, but it is still bounded
          impact.add(
            acc / (alim * 6),
            `${at} ${j} impulse ${acc.toFixed(4)} m/step^2`,
          );
        } else {
          accOver.add(acc / alim, `${at} ${j} ${acc.toFixed(4)} m/step^2`);
          if (afterCommand)
            boundary.add(acc / alim, `${at} ${j} accel ${acc.toFixed(4)}`);
        }
      }
    }
    for (const s of SEGMENT_NAMES) {
      const a = basisAngle(g.basis[s], f.basis[s]);
      const lim = basisLimit(s);
      basisStep[
        lim === LIMITS.trunkBasisStep
          ? 'trunk'
          : lim === LIMITS.handBasisStep
            ? 'hand'
            : 'limb'
      ].add(a, `${at} ${s}`);
      basisOver.add(a / lim, `${at} ${s} ${a.toFixed(3)} rad`);
    }
  }

  const L: CheckLine[] = [];
  const add = (
    name: string,
    m: Max | number,
    limit: number,
    where = '',
    fmt: (v: number) => string = (v) => v.toExponential(2),
  ) => {
    const v = typeof m === 'number' ? m : m.v;
    L.push({
      name: `${label}: ${name}`,
      ok: v <= limit,
      measured: fmt(v),
      limit: `<= ${fmt(limit)}`,
      where: typeof m === 'number' ? where : m.where,
    });
  };
  const f3 = (v: number) => v.toFixed(4);
  L.push({
    name: `${label}: no NaN / infinity in any frame`,
    ok: nan < 0,
    measured: nan < 0 ? 'none' : `step ${nan}`,
    limit: 'none',
  });
  add('planted-foot world drift (m)', drift, LIMITS.plantDrift);
  add(
    'planted-foot ground-contact point drift (heel or toe joint, m)',
    contactDrift,
    LIMITS.plantDrift,
  );
  add('planted-foot yaw drift (rad)', yawDrift, LIMITS.plantYaw);
  if (camYawAt)
    add(
      'planted-foot world position recovered through the orbiting camera (m)',
      orbitRound,
      1e-9,
    );
  add('limb bone length error (m)', bone, LIMITS.boneLength);
  add('leg reach asked / leg length', legReach, LIMITS.legReach, '', f3);
  add('arm reach solved / arm length', armReach, LIMITS.armReach, '', f3);
  add(
    'knee bend direction change per step, -cos (flip = +1; must stay < -0.5, i.e. under 60 deg)',
    kneeFlip,
    -0.5,
    '',
    f3,
  );
  add(
    'knee behind the hip-ankle line against the toe direction (m; knee tracks over toes)',
    kneeToe,
    0.01,
    '',
    f3,
  );
  add(
    'elbow bend direction change per step, -cos (flip = +1; must stay < -0.5, i.e. under 60 deg)',
    elbowFlip,
    -0.5,
    '',
    f3,
  );
  add('basis orthonormality error', ortho, LIMITS.orthonormal);
  add(
    'palm-prop position mismatch while held and at grip/place/release (m)',
    propPos,
    LIMITS.propPos,
  );
  add(
    'palm-prop velocity mismatch at grip/place/release (m/s)',
    propVel,
    LIMITS.propVel,
  );
  add(
    'held prop basis drift inside the hand basis',
    propBasis,
    LIMITS.propBasis,
  );
  if (events.release)
    add(
      'palm velocity at release vs planned launch velocity (m/s)',
      launch,
      LIMITS.launchError,
      '',
      f3,
    );
  add('worst joint position step / its limit', posOver, 1, '', f3);
  add('worst joint position 2nd difference / its limit', accOver, 1, '', f3);
  add(
    'worst step or 2nd difference within 2 steps after a command / its limit',
    boundary,
    1,
    '',
    f3,
  );
  if (hitSteps.size)
    add('hit impulse 2nd difference / (6 x its limit)', impact, 1, '', f3);
  add('yaw step (rad)', yawStep, LIMITS.yawStep, '', f3);
  add('trunk lean step (rad)', leanStep, LIMITS.leanStep, '', f3);
  add('knee/elbow angle step (rad)', hingeStep, LIMITS.hingeStep, '', f3);
  add(
    'trunk basis angular step (rad)',
    basisStep.trunk,
    LIMITS.trunkBasisStep,
    '',
    f3,
  );
  add(
    'leg/upper-arm basis angular step (rad)',
    basisStep.limb,
    LIMITS.limbBasisStep,
    '',
    f3,
  );
  add(
    'forearm/hand basis angular step (rad)',
    basisStep.hand,
    LIMITS.handBasisStep,
    '',
    f3,
  );
  void basisOver;
  L.push({
    name: `${label}: events`,
    ok: true,
    measured: `grip ${events.grip}, place ${events.place}, release ${events.release}, drop ${events.drop}, arm-clamped frames ${armClamped}/${frames.length}`,
    limit: 'info',
  });
  return L;
}

/** Two independent runs and a re-simulation from the command log must be byte-identical. */
export function checkDeterminism(
  label: string,
  options: SimOptions,
  seq: SequenceInfo,
  first: Timeline,
): CheckLine[] {
  const a = Timeline.serialize(first.frames);
  const b = Timeline.serialize(runSequence(options, seq).frames);
  const c = Timeline.serialize(first.resimulate());
  return [
    {
      name: `${label}: two runs byte-identical`,
      ok: a === b,
      measured: a === b ? `${a.length} bytes equal` : 'DIFFERENT',
      limit: 'equal',
    },
    {
      name: `${label}: re-simulation from the command log byte-identical`,
      ok: a === c,
      measured: a === c ? 'equal' : 'DIFFERENT',
      limit: 'equal',
    },
  ];
}

function allCommands(f: SimFrame, rng: () => number): Command[] {
  const y = f.yaw.pelvis;
  return [
    { type: 'move', x: Math.cos(y + 2.6), z: -Math.sin(y + 2.6) },
    { type: 'move', x: rng() * 2 - 1, z: rng() * 2 - 1 },
    { type: 'stop' },
    { type: 'face', yaw: y + 2.2 },
    { type: 'turnTo', view: 'back', camYaw: 0.4 },
    { type: 'reach' },
    { type: 'grip' },
    { type: 'place' },
    { type: 'toss', power: 0.8 },
    { type: 'toss', power: 0.3, yaw: y - 1.5 },
    { type: 'hit', dirYaw: y + 1, strength: 'light' },
    { type: 'hit', dirYaw: y + Math.PI, strength: 'heavy' },
    { type: 'placeProp', x: 0.3, z: 0.7, relative: true },
  ];
}

/**
 * Every command in every phase: for each distinct phase label seen in a
 * sequence, rewind to a step in that phase, issue each command, run on, and
 * require finite frames that still satisfy every invariant and continuity limit.
 */
export function checkEveryCommandEveryPhase(
  label: string,
  options: SimOptions,
  seq: SequenceInfo,
  base: Timeline,
): CheckLine[] {
  const seen = new Map<string, number>();
  base.frames.forEach((f, i) => {
    if (!seen.has(f.phase))
      seen.set(f.phase, Math.min(base.frames.length - 1, i + 3));
  });
  const rng = makeRng(`${label}-fuzz`);
  let runs = 0;
  let bad = 0;
  const examples = new Map<string, string>();
  const failing = new Map<string, number>();
  for (const [phase, step] of seen) {
    const probe = base.frames[step];
    for (const cmd of allCommands(probe, rng)) {
      const t = new Timeline({ ...options, start: seq.start });
      let c = 0;
      for (let i = 0; i < step; i++) {
        while (c < seq.schedule.length && seq.schedule[c].step <= i)
          t.command(seq.schedule[c++].cmd);
        t.step();
      }
      t.command(cmd);
      for (let i = 0; i < 150; i++) t.step();
      // and a second, different command on top while the first is still playing out
      const again = allCommands(t.last, rng);
      t.command(again[Math.floor(rng() * again.length)]);
      for (let i = 0; i < 150; i++) t.step();
      runs++;
      const lines = checkFrames(`${phase} + ${cmd.type}`, options, t).filter(
        (l) => !l.ok,
      );
      if (lines.length) {
        bad++;
        for (const l of lines) {
          const key = l.name.split(': ').slice(1).join(': ');
          failing.set(key, (failing.get(key) ?? 0) + 1);
        }
        for (const l of lines) {
          const key = l.name.split(': ').slice(1).join(': ');
          if (!examples.has(key))
            examples.set(
              key,
              `${l.name} = ${l.measured} (${l.limit}) @ ${l.where ?? ''}`,
            );
        }
      }
    }
  }
  const summary = [...failing].map(([k, n]) => `${n}x ${k}`).join('; ');
  return [
    {
      name: `${label}: every command in every phase (${seen.size} phases x 13 commands, then a second command)`,
      ok: bad === 0,
      measured: `${runs - bad}/${runs} clean${bad ? ` | ${summary}` : ''}`,
      limit: 'all clean',
      where: [...examples.values()].join('\n           '),
    },
  ];
}

/** Random command storms: nothing may produce a NaN or break a hard invariant. */
export function checkStorm(
  label: string,
  options: SimOptions,
  seeds = 4,
  steps = 2400,
): CheckLine[] {
  let bad = '';
  let count = 0;
  for (let s = 0; s < seeds; s++) {
    const rng = makeRng(`${label}-storm-${s}`);
    const t = new Timeline(options);
    for (let i = 0; i < steps; i++) {
      if (rng() < 0.06) {
        const cmds = allCommands(t.last, rng);
        t.command(cmds[Math.floor(rng() * cmds.length)]);
        count++;
      }
      t.step();
    }
    const lines = checkFrames(`storm ${s}`, options, t).filter((l) => !l.ok);
    if (lines.length && !bad)
      bad = lines
        .map((l) => `${l.name} = ${l.measured} @ ${l.where ?? ''}`)
        .join(' | ');
  }
  return [
    {
      name: `${label}: random command storm (${count} commands at random steps)`,
      ok: !bad,
      measured: bad || 'clean',
      limit: 'all invariants hold',
    },
  ];
}

export function runChecks(
  configs: CheckConfig[],
  opts: { deep?: boolean } = {},
): CheckReport {
  const lines: CheckLine[] = [...checkAngles()];
  for (const cfg of configs) {
    const options: SimOptions = {
      proportions: cfg.proportions,
      style: cfg.style,
      seed: `${cfg.style.id}-lab`,
    };
    for (const name of Object.keys(SEQUENCES) as SequenceName[]) {
      const seq = SEQUENCES[name](0.3);
      const label = `${cfg.label} / ${name}`;
      const t = runSequence(options, seq);
      lines.push(
        ...checkFrames(
          label,
          { ...options, start: seq.start },
          t,
          seq.camYawAt,
        ),
      );
      lines.push(...checkDeterminism(label, options, seq, t));
      if (opts.deep && (name === 'test' || name === 'proof'))
        lines.push(...checkEveryCommandEveryPhase(label, options, seq, t));
    }
    lines.push(...checkStorm(cfg.label, options));
  }
  return { ok: lines.every((l) => l.ok), lines };
}
