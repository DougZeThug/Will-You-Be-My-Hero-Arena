// Headless checks for the authored shot.
//   node --import ./prototype/character-lab/core/ts-loader.mjs prototype/character-lab/shot/checks.mjs [--all]
// Limits are stated in LIMITS below. Contact convention is core's (core/checks.ts): while a
// foot is flagged planted its ground-contact point is world-locked: the TOE joint while the
// heel is up, the HEEL joint while the toes are up, both when the foot is flat; the foot's
// yaw never changes while planted.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const { buildShot, segmentBases, SHOT_BEATS, SHOT_CAMERA, SHOT_START_VIEW, SHOT_END_VIEW, T } =
  await import('./shot.ts');
const { buildReach, REACH_BEATS } = await import('./reach.ts');
const { defaultProportions, lankyProportions, sanitizeProportions } =
  await import('../core/proportions.ts');
const { viewAngle } = await import('../core/camera.ts');
const { basisAngle, cross, dot, sub, len, norm } = await import('../core/math.ts');
const { JOINT_NAMES, SEGMENT_NAMES } = await import('../core/types.ts');
const { createSim } = await import('../core/sim.ts');
const { dougStyle } = await import('../styles/doug.ts');

const LIMITS = {
  frames: [198, 228], // 3.3 .. 3.8 s at 60 fps
  reachFrames: [88, 112], // hold 20, load 12, extend 24, recover 24, settled 20
  loop: 1e-9, // reach: first frame against last frame (m)
  loopBasis: 1e-6, // and their bases (rad; the angle comes from an acos, so 1e-8 is its noise floor)
  readyMatch: 0.004, // reach frame 0 against buildShot frame 76 (m): only the breath differs
  plantDrift: 1e-9, // m
  plantYaw: 1e-9, // rad
  ground: 1e-9, // m a foot joint may be below the floor
  bone: 1e-6, // m
  ortho: 1e-9,
  coreBasis: 1e-6, // rad between our basis and core's for the same joints
  // Speed and smoothness, m per frame (and per frame^2) at 60 fps for a 1.73 m body with
  // 0.86 m legs, scaled up for a taller body or longer legs. Stated separately for the snap turn (frames TURN_WINDOW), because the brief
  // asks for about 135 deg in 7-9 frames: that is 0.3 rad per frame on average and about
  // 0.5 at the peak, so an elbow 0.45 m from the spine has to do about 0.2 m per frame.
  stepHand: 0.15, // wrist / palm outside the turn (9 m/s: a sprinter's arm pump)
  stepBody: 0.1, // every other joint outside the turn (6 m/s)
  accel: 0.07, // second difference outside the turn (the peak is the stomp); a pop is a one-frame spike above this
  // the reach uses buildShot's reach keys (0.097 there) and adds the weight transfer from the
  // rear foot to the lead foot while the arm goes out, so its elbow peaks a little higher
  reachStepBody: 0.11,
  turnStepHand: 0.26,
  turnStepBody: 0.2,
  turnAccel: 0.13,
  legReach: 0.9951, // hip->ankle over thigh+shin while planted (IK clamps at 0.995)
  bendTurn: 50, // deg per frame the knee / elbow bend plane may turn about its limb
  kneeMin: 3, // deg: a knee never locks straight or bends backwards
  front: 78, // deg: no block's view angle goes further toward the front than this (start is 45)
  squash: [0.93, 1.06],
};
const DEG = 180 / Math.PI;
const TURN_WINDOW = [T.turn, T.settle + 6];
const args = process.argv.slice(2);
const showAll = args.includes('--all');
const lines = [];
const add = (name, measured, limit, ok, where = '') =>
  lines.push({ name, measured, limit, ok, where });

const rig = (file) =>
  fs.existsSync(here(file))
    ? sanitizeProportions(JSON.parse(fs.readFileSync(here(file), 'utf8')))
    : null;
const configs = [
  ['default', defaultProportions()],
  ['lanky', lankyProportions()],
];
for (const [label, file] of [
  ['doug-rig', '../rigs/doug/proportions.json'],
  ['doug-volume', '../rigs/doug/volume/proportions.json'],
]) {
  const p = rig(file);
  if (p) configs.push([label, p]);
}

class Max {
  v = 0;
  at = '';
  add(x, at) {
    if (!(x <= this.v)) {
      this.v = x;
      this.at = at;
    }
  }
}
const fmt = (x) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : x.toFixed(4));
const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

for (const [label, P] of configs) {
for (const kind of ['shot', 'reach']) {
  const isShot = kind === 'shot';
  const build = isShot ? buildShot : buildReach;
  const BEATS = isShot ? SHOT_BEATS : REACH_BEATS;
  const tag = (s) => `${label} ${kind}: ${s}`;
  const frames = build(P);
  const again = build(P);
  add(tag('deterministic (two builds identical)'), '', 'equal', JSON.stringify(frames) === JSON.stringify(again));
  const range = isShot ? LIMITS.frames : LIMITS.reachFrames;
  add(tag('frame count'), String(frames.length), `${range[0]}..${range[1]}`, frames.length >= range[0] && frames.length <= range[1]);

  // beats cover the shot, phases name them
  let beatsOk = BEATS[0].from === 0 && BEATS[BEATS.length - 1].to === frames.length;
  for (let i = 1; i < BEATS.length; i++) beatsOk &&= BEATS[i].from === BEATS[i - 1].to;
  beatsOk &&= frames.every((f, i) => f.step === i && BEATS.some((b) => b.name === f.phase && i >= b.from && i < b.to));
  add(tag('beats contiguous, phase = beat name, step = index'), '', 'true', beatsOk);

  // finite everywhere
  let nan = 0;
  const num = (x) => {
    if (!Number.isFinite(x)) nan++;
  };
  for (const f of frames) {
    for (const j of JOINT_NAMES) for (const k of 'xyz') num(f.joints[j][k]);
    for (const s of SEGMENT_NAMES) for (const a of 'xyz') for (const k of 'xyz') num(f.basis[s][a][k]);
    num(f.yaw.pelvis); num(f.yaw.chest); num(f.yaw.head); num(f.lean.pitch); num(f.lean.roll); num(f.squash);
  }
  add(tag('no NaN / missing joint or basis'), String(nan), '0', nan === 0);

  // bone lengths
  const bones = [
    ['pelvis', 'spine', P.spine], ['spine', 'chest', P.chestLen], ['chest', 'head', P.neck],
    ['chest', 'neck', P.neck * 0.35], ['head', 'headTop', P.headLen], ['hipL', 'hipR', P.hipWidth],
  ];
  for (const s of 'LR')
    bones.push(
      [`shoulder${s}`, `elbow${s}`, P.upperArm], [`elbow${s}`, `wrist${s}`, P.forearm],
      [`wrist${s}`, `hand${s}`, P.hand * 0.5], [`hip${s}`, `knee${s}`, P.thigh],
      [`knee${s}`, `ankle${s}`, P.shin],
      [`ankle${s}`, `heel${s}`, Math.hypot(0.25 * P.footLen, P.ankleHeight)],
    );
  const bone = new Max();
  const toeLen = new Max();
  const girdle = new Max();
  frames.forEach((f, i) => {
    for (const [a, b, l] of bones) bone.add(Math.abs(len(sub(f.joints[a], f.joints[b])) - l), `frame ${i} ${a}-${b}`);
    for (const s of 'LR') toeLen.add(len(sub(f.joints[`toe${s}`], f.joints[`heel${s}`])) - P.footLen, `frame ${i}`);
    girdle.add(Math.abs(len(sub(f.joints.shoulderL, f.joints.shoulderR)) - P.shoulderWidth), `frame ${i}`);
  });
  add(tag('bone length error (m)'), fmt(bone.v), `<= ${LIMITS.bone}`, bone.v <= LIMITS.bone, bone.at);
  add(tag('heel->toe never longer than the foot (toes bend, m over)'), fmt(toeLen.v), `<= ${LIMITS.bone}`, toeLen.v <= LIMITS.bone, toeLen.at);
  add(tag('shoulder-to-shoulder change from the girdle offsets (m, by design)'), fmt(girdle.v), 'info', true, girdle.at);

  // planted feet
  const drift = new Max();
  const yawDrift = new Max();
  const under = new Max();
  const floating = new Max();
  const reach = new Max();
  let plantedPairs = 0;
  frames.forEach((f, i) => {
    for (const s of 'LR') {
      const key = `foot${s}`;
      const heel = f.joints[`heel${s}`];
      const toe = f.joints[`toe${s}`];
      under.add(-Math.min(heel.y, toe.y, f.joints[`ankle${s}`].y), `frame ${i} ${s}`);
      if (!f.contacts[key]) continue;
      floating.add(Math.min(heel.y, toe.y), `frame ${i} ${s}`);
      reach.add(len(sub(f.joints[`ankle${s}`], f.joints[`hip${s}`])) / (P.thigh + P.shin), `frame ${i} ${s}`);
      if (i === 0 || !frames[i - 1].contacts[key]) continue;
      plantedPairs++;
      const g = frames[i - 1];
      const h0 = g.joints[`heel${s}`];
      const t0 = g.joints[`toe${s}`];
      let checked = false;
      if (heel.y <= 1e-12 && h0.y <= 1e-12) {
        drift.add(len(sub(heel, h0)), `frame ${i} heel${s}`);
        checked = true;
      }
      if (toe.y <= 1e-12 && t0.y <= 1e-12) {
        drift.add(len(sub(toe, t0)), `frame ${i} toe${s}`);
        checked = true;
      }
      if (!checked) drift.add(Infinity, `frame ${i} ${s}: contact point changed between frames`);
      const a0 = Math.atan2(-(t0.z - h0.z), t0.x - h0.x);
      const a1 = Math.atan2(-(toe.z - heel.z), toe.x - heel.x);
      yawDrift.add(Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))), `frame ${i} ${s}`);
    }
  });
  add(tag(`planted contact-point world drift (m, ${plantedPairs} frame pairs)`), fmt(drift.v), `<= ${LIMITS.plantDrift}`, drift.v <= LIMITS.plantDrift, drift.at);
  add(tag('planted foot yaw drift (rad)'), fmt(yawDrift.v), `<= ${LIMITS.plantYaw}`, yawDrift.v <= LIMITS.plantYaw, yawDrift.at);
  add(tag('planted foot off the floor (m)'), fmt(floating.v), `<= ${LIMITS.ground}`, floating.v <= LIMITS.ground, floating.at);
  add(tag('any foot joint below the floor (m)'), fmt(under.v), `<= ${LIMITS.ground}`, under.v <= LIMITS.ground, under.at);
  add(tag('planted leg reach (hip->ankle / leg length)'), fmt(reach.v), `<= ${LIMITS.legReach}`, reach.v <= LIMITS.legReach, reach.at);

  // bases
  const ortho = new Max();
  const alongBone = new Max();
  const boneOf = {
    spine: ['pelvis', 'spine'], chest: ['spine', 'chest'], head: ['head', 'headTop'],
  };
  for (const s of 'LR')
    Object.assign(boneOf, {
      [`upperArm${s}`]: [`shoulder${s}`, `elbow${s}`], [`forearm${s}`]: [`elbow${s}`, `wrist${s}`],
      [`hand${s}`]: [`wrist${s}`, `hand${s}`], [`thigh${s}`]: [`hip${s}`, `knee${s}`],
      [`shin${s}`]: [`knee${s}`, `ankle${s}`],
    });
  frames.forEach((f, i) => {
    for (const s of SEGMENT_NAMES) {
      const b = f.basis[s];
      const at = `frame ${i} ${s}`;
      for (const a of 'xyz') ortho.add(Math.abs(len(b[a]) - 1), at);
      ortho.add(Math.abs(dot(b.x, b.y)), at);
      ortho.add(Math.abs(dot(b.x, b.z)), at);
      ortho.add(Math.abs(dot(b.y, b.z)), at);
      ortho.add(len(sub(cross(b.z, b.x), b.y)), at);
      if (boneOf[s]) alongBone.add(1 - dot(b.x, norm(sub(f.joints[boneOf[s][1]], f.joints[boneOf[s][0]]))), at);
    }
  });
  add(tag('bases orthonormal, y = z cross x (max error)'), fmt(ortho.v), `<= ${LIMITS.ortho}`, ortho.v <= LIMITS.ortho, ortho.at);
  add(tag('basis x runs parent -> child (1 - cos)'), fmt(alongBone.v), `<= ${LIMITS.ortho}`, alongBone.v <= LIMITS.ortho, alongBone.at);

  // the core convention: core/sim frames (standing with the arms hanging, then walking and a
  // turn) put through OUR basis builder must give core's bases back. The only thing taken
  // from core's bases is the palm normal (hand z), which joints alone cannot determine.
  for (const [what, script] of !isShot ? [] : [
    ['standing, arms hanging', []],
    ['walking then turning to the back view', [[5, { type: 'move', x: 1, z: 0 }], [80, { type: 'stop' }], [110, { type: 'turnTo', view: 'back' }]]],
  ]) {
    const sim = createSim({ proportions: P, style: dougStyle, seed: 'shot-check', start: { x: 0, z: 0, yaw: -Math.PI / 4 } });
    const worst = new Max();
    let compared = 0;
    let skipped = 0;
    for (let i = 0; i < 200; i++) {
      for (const [at, cmd] of script) if (at === i) sim.command(cmd);
      const cf = sim.step();
      const ours = segmentBases(cf.joints, cf.yaw, P, { L: cf.basis.handL.z, R: cf.basis.handR.z });
      for (const s of SEGMENT_NAMES) {
        // core clamps a swinging foot's toe JOINT to the floor without moving the ball its
        // basis is built from, so on those frames the joints do not determine core's foot
        // basis. The shot never clamps (it lifts the whole foot), so they are not comparable.
        const side = s === 'footL' ? 'L' : s === 'footR' ? 'R' : null;
        if (side && !cf.contacts[s] && cf.joints[`toe${side}`].y === 0) {
          skipped++;
          continue;
        }
        compared++;
        worst.add(basisAngle(ours[s], cf.basis[s]), `core step ${i} ${s}`);
      }
    }
    add(tag(`bases match core/sim for core's own joints: ${what} (rad; ${compared} compared, ${skipped} toe-clamped foot frames skipped)`), fmt(worst.v), `<= ${LIMITS.coreBasis}`, worst.v <= LIMITS.coreBasis, worst.at);
  }

  // frame 0 is the relaxed three-quarter stance; the last frame is the back view
  if (isShot) {
    const f = frames[0];
    const v0 = ['pelvis', 'chest', 'head'].map((b) => viewAngle(f.yaw[b], SHOT_CAMERA.camYaw));
    add(tag('frame 0 view angle of pelvis/chest/head (deg)'), v0.map((v) => (v * DEG).toFixed(2)).join(' '), `${SHOT_START_VIEW * DEG} each`, v0.every((v) => Math.abs(v - SHOT_START_VIEW) < 1e-9));
    const hang = ['L', 'R'].every((s) => f.joints[`hand${s}`].y < f.joints[`elbow${s}`].y && f.joints[`elbow${s}`].y < f.joints[`shoulder${s}`].y && horiz(f.joints[`wrist${s}`], f.joints[`shoulder${s}`]) < 0.2 * (P.upperArm + P.forearm) / 0.55);
    add(tag('frame 0 arms hanging'), '', 'true', hang);
    const gap = horiz(f.joints.ankleL, f.joints.ankleR);
    add(tag('frame 0 feet about hip width (ankle gap / hip width)'), fmt(gap / P.hipWidth), '0.9..1.8', gap / P.hipWidth > 0.9 && gap / P.hipWidth < 1.8);
    const l = frames[frames.length - 1];
    const v1 = ['pelvis', 'chest', 'head'].map((b) => viewAngle(l.yaw[b], SHOT_CAMERA.camYaw));
    add(tag('last frame view angle of pelvis/chest/head (deg)'), v1.map((v) => (v * DEG).toFixed(2)).join(' '), `${SHOT_END_VIEW * DEG} each`, v1.every((v) => Math.abs(v - SHOT_END_VIEW) < 1e-6));
    add(tag('last frame both feet planted and flat'), '', 'true', l.contacts.footL && l.contacts.footR && ['heelL', 'toeL', 'heelR', 'toeR'].every((j) => Math.abs(l.joints[j].y) < 1e-9));
    const still = new Max();
    for (const j of JOINT_NAMES) still.add(len(sub(l.joints[j], frames[frames.length - 2].joints[j])), j);
    add(tag('last frame is near rest (max joint step, m)'), fmt(still.v), '<= 0.002', still.v <= 0.002, still.at);
  }

  // the turn: never through the front; head, then chest, then hips
  if (isShot) {
    const front = new Max();
    const cross0 = {};
    frames.forEach((f, i) => {
      for (const b of ['pelvis', 'chest', 'head']) {
        const v = viewAngle(f.yaw[b], SHOT_CAMERA.camYaw) * DEG;
        front.add(v, `frame ${i} ${b}`);
        // half way round: the three-quarter back view (-45 deg)
        if (cross0[b] === undefined && v < -45) {
          const p = viewAngle(frames[i - 1].yaw[b], SHOT_CAMERA.camYaw) * DEG;
          cross0[b] = i - 1 + (p + 45) / (p - v);
        }
      }
    });
    add(tag('largest view angle toward the front, any block (deg)'), front.v.toFixed(1), `<= ${LIMITS.front}`, front.v <= LIMITS.front, front.at);
    add(tag('frame each block is half way round the turn (view angle -45 deg): head, chest, pelvis'), `${cross0.head.toFixed(2)} ${cross0.chest.toFixed(2)} ${cross0.pelvis.toFixed(2)}`, 'head < chest < pelvis', cross0.head < cross0.chest && cross0.chest < cross0.pelvis);
    let airborne = 0;
    let first = -1;
    frames.forEach((f, i) => {
      if (!f.contacts.footL && !f.contacts.footR) {
        airborne++;
        if (first < 0) first = i;
      }
    });
    add(tag('frames with both feet off the floor'), `${airborne} from frame ${first}`, 'info', true);
  }

  // the reach: starts where buildShot's ready key is, ends where it started, never steps
  if (!isShot) {
    const first = frames[0];
    const last = frames[frames.length - 1];
    const loop = new Max();
    const ready = new Max();
    const shotReady = buildShot(P)[T.reach];
    for (const j of JOINT_NAMES) {
      loop.add(len(sub(first.joints[j], last.joints[j])), j);
      ready.add(len(sub(first.joints[j], shotReady.joints[j])), j);
    }
    const loopBasis = new Max();
    for (const sname of SEGMENT_NAMES) loopBasis.add(basisAngle(first.basis[sname], last.basis[sname]), sname);
    add(tag('first and last frame the same pose (max joint distance, m)'), fmt(loop.v), `<= ${LIMITS.loop}`, loop.v <= LIMITS.loop, loop.at);
    add(tag('first and last frame the same bases (rad)'), fmt(loopBasis.v), `<= ${LIMITS.loopBasis}`, loopBasis.v <= LIMITS.loopBasis, loopBasis.at);
    add(tag('frame 0 against buildShot frame 76 (max joint distance, m; breath phase differs)'), fmt(ready.v), `<= ${LIMITS.readyMatch}`, ready.v <= LIMITS.readyMatch, ready.at);
    const feetSame = new Max();
    for (const j of ['heelL', 'toeL', 'ankleL', 'heelR', 'toeR', 'ankleR']) feetSame.add(len(sub(first.joints[j], shotReady.joints[j])), j);
    add(tag('feet stand on buildShot frame 76 plants (m)'), fmt(feetSame.v), `<= ${LIMITS.plantDrift}`, feetSame.v <= LIMITS.plantDrift, feetSame.at);
    add(tag('both feet flagged planted on every frame'), '', 'true', frames.every((f) => f.contacts.footL && f.contacts.footR));
    const lead = new Max();
    const rearToe = new Max();
    const rearHeel = new Max();
    frames.forEach((f, i) => {
      for (const j of ['heelL', 'toeL', 'ankleL']) lead.add(len(sub(f.joints[j], first.joints[j])), `frame ${i} ${j}`);
      rearToe.add(len(sub(f.joints.toeR, first.joints.toeR)), `frame ${i}`);
      rearHeel.add(f.joints.heelR.y, `frame ${i}`);
    });
    add(tag('lead (left) foot heel, toe and ankle against frame 0, every frame (m)'), fmt(lead.v), `<= ${LIMITS.plantDrift}`, lead.v <= LIMITS.plantDrift, lead.at);
    add(tag('rear (right) foot toe against frame 0, every frame (m)'), fmt(rearToe.v), `<= ${LIMITS.plantDrift}`, rearToe.v <= LIMITS.plantDrift, rearToe.at);
    add(tag('rear heel peel while unloaded (max height, m; toes stay locked)'), fmt(rearHeel.v), 'info', true, rearHeel.at);
    let lo = Infinity;
    let curlOk = true;
    for (const f of frames) {
      curlOk &&= !!f.curl && [f.curl.L, f.curl.R].every((c) => c >= 0 && c <= 1);
      if (f.curl) lo = Math.min(lo, f.curl.R);
    }
    add(tag('curl present, 0..1, same at both ends; reaching hand opens to'), lo.toFixed(2), '<= 0.15', curlOk && lo <= 0.15 && first.curl.R === last.curl.R && first.curl.L === last.curl.L);
    const front = new Max();
    frames.forEach((f, i) => {
      for (const b of ['pelvis', 'chest', 'head']) front.add(viewAngle(f.yaw[b], SHOT_CAMERA.camYaw) * DEG, `frame ${i} ${b}`);
    });
    add(tag('largest view angle toward the front, any block (deg)'), front.v.toFixed(1), `<= ${LIMITS.front}`, front.v <= LIMITS.front, front.at);
  }

  // speed and smoothness
  {
    const isHand = (j) => /^(hand|wrist)/.test(j);
    // travel, dips and step heights scale with the legs (shot.ts K), so the limits do too
    const scale = Math.max(P.height / 1.73, (P.thigh + P.shin) / 0.86);
    for (const [what, inside, lim] of [
      [isShot ? 'outside the turn' : 'all frames', false, [LIMITS.stepHand, isShot ? LIMITS.stepBody : LIMITS.reachStepBody, LIMITS.accel]],
      ...(isShot ? [[`in the turn (frames ${TURN_WINDOW[0]}..${TURN_WINDOW[1]})`, true, [LIMITS.turnStepHand, LIMITS.turnStepBody, LIMITS.turnAccel]]] : []),
    ]) {
      const hand = new Max();
      const body = new Max();
      const acc = new Max();
      for (let i = 1; i < frames.length; i++) {
        if ((isShot && i >= TURN_WINDOW[0] && i <= TURN_WINDOW[1]) !== inside) continue;
        for (const j of JOINT_NAMES) {
          const v = len(sub(frames[i].joints[j], frames[i - 1].joints[j]));
          (isHand(j) ? hand : body).add(v, `frame ${i} ${j}`);
          if (i > 1) {
            const a = frames[i].joints[j];
            const b = frames[i - 1].joints[j];
            const c = frames[i - 2].joints[j];
            acc.add(Math.hypot(a.x - 2 * b.x + c.x, a.y - 2 * b.y + c.y, a.z - 2 * b.z + c.z), `frame ${i} ${j}`);
          }
        }
      }
      add(tag(`max wrist/hand step ${what} (m per frame)`), `${fmt(hand.v)} = ${(hand.v * 60).toFixed(1)} m/s`, `<= ${lim[0]}`, hand.v <= lim[0] * scale, hand.at);
      add(tag(`max step, every other joint, ${what} (m per frame)`), `${fmt(body.v)} = ${(body.v * 60).toFixed(1)} m/s`, `<= ${lim[1]}`, body.v <= lim[1] * scale, body.at);
      add(tag(`max second difference, any joint, ${what} (m per frame^2)`), fmt(acc.v), `<= ${lim[2]}`, acc.v <= lim[2] * scale, acc.at);
    }
  }

  // knees and elbows never flip
  {
    const kneeTurn = new Max();
    const elbowTurn = new Max();
    let kneeMin = Infinity;
    let kneeAt = '';
    const bendDir = (root, mid, end) => {
      const d = norm(sub(end, root));
      const m = sub(mid, root);
      return sub(m, { x: d.x * dot(m, d), y: d.y * dot(m, d), z: d.z * dot(m, d) });
    };
    for (let i = 0; i < frames.length; i++)
      for (const s of 'LR') {
        const J = frames[i].joints;
        const k = bendDir(J[`hip${s}`], J[`knee${s}`], J[`ankle${s}`]);
        const flex = Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(norm(sub(J[`hip${s}`], J[`knee${s}`])), norm(sub(J[`ankle${s}`], J[`knee${s}`]))))));
        // forward of the leg = between where the pelvis and the foot point
        const fwdLeg = norm({ x: frames[i].basis.pelvis.z.x + frames[i].basis[`foot${s}`].x.x, y: 0, z: frames[i].basis.pelvis.z.z + frames[i].basis[`foot${s}`].x.z });
        const signed = dot(norm(k), fwdLeg) >= 0 ? flex : -flex;
        if (signed * DEG < kneeMin) {
          kneeMin = signed * DEG;
          kneeAt = `frame ${i} ${s}`;
        }
        if (i === 0) continue;
        const G = frames[i - 1].joints;
        const k0 = bendDir(G[`hip${s}`], G[`knee${s}`], G[`ankle${s}`]);
        if (len(k) > 0.02 && len(k0) > 0.02) kneeTurn.add(Math.acos(Math.max(-1, Math.min(1, dot(norm(k), norm(k0))))) * DEG, `frame ${i} ${s}`);
        const e = bendDir(J[`shoulder${s}`], J[`elbow${s}`], J[`wrist${s}`]);
        const e0 = bendDir(G[`shoulder${s}`], G[`elbow${s}`], G[`wrist${s}`]);
        if (len(e) > 0.02 && len(e0) > 0.02) elbowTurn.add(Math.acos(Math.max(-1, Math.min(1, dot(norm(e), norm(e0))))) * DEG, `frame ${i} ${s}`);
      }
    add(tag('smallest knee bend, forward positive (deg)'), kneeMin.toFixed(1), `>= ${LIMITS.kneeMin}`, kneeMin >= LIMITS.kneeMin, kneeAt);
    add(tag('knee bend direction turn per frame (deg, world)'), kneeTurn.v.toFixed(1), `<= ${LIMITS.bendTurn}`, kneeTurn.v <= LIMITS.bendTurn, kneeTurn.at);
    add(tag('elbow bend direction turn per frame (deg, world)'), elbowTurn.v.toFixed(1), `<= ${LIMITS.bendTurn}`, elbowTurn.v <= LIMITS.bendTurn, elbowTurn.at);
  }

  // root squash, hands, props
  {
    let lo = Infinity;
    let hi = -Infinity;
    for (const f of frames) {
      lo = Math.min(lo, f.squash);
      hi = Math.max(hi, f.squash);
    }
    add(tag('root squash range'), `${lo.toFixed(3)}..${hi.toFixed(3)}`, `${LIMITS.squash[0]}..${LIMITS.squash[1]}, rest 1 at both ends`, lo >= LIMITS.squash[0] && hi <= LIMITS.squash[1] && frames[0].squash === 1 && Math.abs(frames[frames.length - 1].squash - 1) < 1e-9);
    add(tag('props empty, hand poses valid'), '', 'true', frames.every((f) => f.props.length === 0 && ['relaxed', 'open', 'grip'].includes(f.hands.L) && ['relaxed', 'open', 'grip'].includes(f.hands.R)));
  }
}
}

let pass = 0;
let ok = true;
for (const l of lines) {
  if (l.ok) pass++;
  else ok = false;
  if (!l.ok || showAll || l.limit === 'info')
    console.log(`${l.ok ? (l.limit === 'info' ? 'info' : 'ok  ') : 'FAIL'}  ${l.name}: ${l.measured}  [${l.limit}]${l.where && (!l.ok || showAll) ? `  at ${l.where}` : ''}`);
}
console.log(`\n${pass}/${lines.length} checks passed -> ${ok ? 'PASS' : 'FAIL'}`);
process.exitCode = ok ? 0 : 1;
