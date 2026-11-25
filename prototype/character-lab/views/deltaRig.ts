// Delta-driven view rig: the drawing's own hierarchy, moved only by CHANGES of
// the projected 3D skeleton from a calibrated rest stance.
//
//   bind pose        = the source drawing (render at rest == the drawing)
//   rotation delta   = projected 3D bone angle now  -  the same at rest
//   along-bone scale = projected 3D bone length now /  the same at rest
//   children         = attached at the parent's DRAWN joint (hierarchical FK)
//   legs             = 2D two-bone IK to (drawn rest ankle + projected ankle movement)
//   shoulders        = the drawn socket, moved by the change of the projected
//                      shoulder offset from the chest (shrug, twist)
//
//   sleeve helpers  = bones listed in `meta.lab.helpers`: they sit on the shoulder
//                      pivot and turn by a FRACTION of the upper arm's rotation
//                      relative to the shoulder girdle, so cloth weighted across
//                      girdle -> helpers -> arm bends round the joint instead of
//                      collapsing into it (linear blending of two far-apart
//                      rotations shrinks toward the pivot)
//   border           = none baked in: the posed figure goes to an offscreen target
//                      and a constant-width border is drawn from its silhouette
//
// Nothing is placed absolutely from the projection, so a neutral frame cannot
// re-assemble the figure, and a planted foot (whose projection does not move)
// keeps its drawn place exactly. The same driver runs the profile rig (its
// spine has two lumbar bones and its hand drawings are placed along +x, so the
// hand alone is set absolutely there).
import type { Rig } from '../../motion/rig/rig';
import { project as coreProject } from '../core/camera';
import { OutlineTarget, type OutlineSpec } from './outline';
import { RigLayers } from './renderer';
import type { JointName, ProjectFn, Proportions, Side, ViewCamera, ViewFrame } from './contract';
import type { Placement } from './poser';

export const DELTA = {
  along: [0.45, 1.3], // limits of the along-bone scale
  spineAlong: [0.8, 1.2],
  across: [0.7, 1.25], // limits of the trunk's width scale (twist)
  footAlong: [0.75, 1.15],
};

type P2 = [number, number];
interface BoneState {
  rot: number; // world angle delta
  along: number;
  across: number;
  origin: P2; // figure px
  linear: [number, number, number, number];
}
export interface DeltaDebug {
  /** Canvas px. */
  feet: Record<Side, { heel: P2; projectedHeel: P2; offset: P2 }>;
  joints: Record<string, P2>;
  /** Canvas px: where each bone's drawn tip is now. */
  tips: Record<string, P2>;
  scale: Record<string, number>;
  ikStretch: Record<Side, number>;
}

const clamp = (v: number, [a, b]: number[]) => Math.min(b, Math.max(a, v));

export function createDeltaView(
  gl: WebGLRenderingContext,
  rig: Rig,
  proportions: Proportions,
  rest: { frame: ViewFrame; camera: ViewCamera },
  options: { project?: ProjectFn; outline?: OutlineSpec | null } = {},
) {
  const project = options.project ?? (coreProject as ProjectFn),
    layers = new RigLayers(gl, rig),
    bones = rig.data.bones,
    lab = rig.data.meta.lab as {
      view?: string;
      nearSide?: Side;
      helpers?: { name: string; girdle: string; follows: string; fraction: number }[];
      outline?: { widthPx: number; colour: [number, number, number] };
    },
    profile = lab.view === 'side' || lab.view === 'sideRear',
    // Depth-true side: a rig that faces +x shows the camera the character's right.
    near: Side = profile ? 'R' : (lab.nearSide ?? 'R'),
    outline: OutlineSpec | null =
      options.outline !== undefined
        ? options.outline
        : lab.outline
          ? { width: (lab.outline.widthPx * proportions.height) / rig.data.meta.heightPx, colour: lab.outline.colour }
          : null,
    target = outline ? new OutlineTarget(gl) : null,
    hasBone = (name: string) => name in rig.boneIndex,
    lastArm: Record<string, number> = { near: 0, far: 0 },
    far: Side = near === 'R' ? 'L' : 'R',
    ppm = rig.data.meta.heightPx / proportions.height,
    skin = new Float32Array(bones.length * 6),
    state: BoneState[] = bones.map((b) => ({ rot: 0, along: 1, across: 1, origin: [b.x, b.y], linear: [1, 0, 0, 1] })),
    index = rig.boneIndex,
    sideOf = (tag: string): Side => (tag === 'near' ? near : far);
  /** Projected joints in figure pixels (x right, y down), origin arbitrary but shared with the rest. */
  const flat = (frame: ViewFrame, camera: ViewCamera) => {
    const out = {} as Record<JointName, P2>;
    for (const name of Object.keys(frame.joints) as JointName[]) {
      const q = project(frame.joints[name], camera);
      out[name] = [q.x * ppm, -q.y * ppm];
    }
    return out;
  };
  const R = flat(rest.frame, rest.camera),
    socket = (name: string): P2 => {
      const s = rig.data.sockets[rig.socketIndex[name]];
      return [s.x, s.y];
    },
    angle = (a: P2, b: P2) => Math.atan2(b[1] - a[1], b[0] - a[0]),
    dist = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1]),
    wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  // Where the rig root sits so that, at rest, the drawn heels are centred on the projected heels.
  const drawnHeelMean: P2 = [(socket('heel_near')[0] + socket('heel_far')[0]) / 2, (socket('heel_near')[1] + socket('heel_far')[1]) / 2],
    restHeelMean: P2 = [(R.heelL[0] + R.heelR[0]) / 2, (R.heelL[1] + R.heelR[1]) / 2];
  /** 2D two-bone IK: thigh and shin angles reaching `A` from `H`; `K` hints the knee side. */
  function solveLeg(H: P2, A: P2, l1: number, l2: number, K: P2 | null, tag: string) {
    const thigh = index[`thigh_${tag}`],
      shin = index[`shin_${tag}`],
      foot = index[`foot_${tag}`],
      bindCross = (bones[foot].x - bones[thigh].x) * (bones[shin].y - bones[thigh].y) - (bones[foot].y - bones[thigh].y) * (bones[shin].x - bones[thigh].x),
      cross = K ? (A[0] - H[0]) * (K[1] - H[1]) - (A[1] - H[1]) * (K[0] - H[0]) : bindCross,
      d = Math.max(1e-3, dist(H, A)),
      over = d > l1 + l2 ? d / (l1 + l2) : 1,
      a1 = l1 * over,
      a2 = l2 * over,
      cosine = Math.min(1, Math.max(-1, (a1 * a1 + d * d - a2 * a2) / (2 * a1 * d))),
      bend = Math.acos(cosine) * (Math.abs(cross) > 0.002 * d * l1 ? Math.sign(cross) : Math.sign(bindCross) || 1),
      thighAngle = angle(H, A) + bend,
      knee: P2 = [H[0] + Math.cos(thighAngle) * a1, H[1] + Math.sin(thighAngle) * a1];
    return { thigh: thighAngle, shin: angle(knee, A), a1, a2, over };
  }
  const restLeg = Object.fromEntries(
    ['near', 'far'].map((tag) => {
      const t = bones[index[`thigh_${tag}`]],
        f = bones[index[`foot_${tag}`]];
      return [tag, solveLeg([t.x, t.y], [f.x, f.y], t.length, bones[index[`shin_${tag}`]].length, null, tag)];
    }),
  );
  let debug: DeltaDebug | null = null;

  function setLinear(i: number): void {
    const b = bones[i],
      s = state[i],
      c = Math.cos(b.rotation + s.rot),
      sn = Math.sin(b.rotation + s.rot),
      c0 = Math.cos(b.rotation),
      s0 = Math.sin(b.rotation),
      // R(now) * diag(along, across) * R(-bind)
      a = c * s.along,
      bb = sn * s.along,
      cc = -sn * s.across,
      d = c * s.across;
    s.linear = [a * c0 - cc * s0, bb * c0 - d * s0, a * s0 + cc * c0, bb * s0 + d * c0];
  }
  const through = (i: number, x: number, y: number): P2 => {
    const b = bones[i],
      s = state[i],
      dx = x - b.x,
      dy = y - b.y;
    return [s.origin[0] + s.linear[0] * dx + s.linear[2] * dy, s.origin[1] + s.linear[1] * dx + s.linear[3] * dy];
  };

  function pose(frame: ViewFrame, camera: ViewCamera): { C: Record<JointName, P2>; stretch: Record<Side, number> } {
    const C = flat(frame, camera),
      move = (name: JointName): P2 => [C[name][0] - R[name][0], C[name][1] - R[name][1]],
      delta = (a: JointName, b: JointName) => wrap(angle(C[a], C[b]) - angle(R[a], R[b])),
      ratio = (a: JointName, b: JointName, limits: number[]) => clamp(dist(C[a], C[b]) / Math.max(1e-6, dist(R[a], R[b])), limits),
      attach = (name: string) => {
        const i = index[name],
          p = index[bones[i].parent!];
        state[i].origin = through(p, bones[i].x, bones[i].y);
      },
      set = (name: string, rot: number, along = 1, across = 1) => {
        const s = state[index[name]];
        s.rot = rot;
        s.along = along;
        s.across = across;
        setLinear(index[name]);
      };
    // Width of the trunk across its axis, now over rest (a twist narrows or widens the drawing).
    const span = (P: Record<JointName, P2>, a: JointName, b: JointName, from: JointName, to: JointName) => {
        const u = [P[to][0] - P[from][0], P[to][1] - P[from][1]],
          l = Math.hypot(u[0], u[1]) || 1;
        return ((P[a][0] - P[b][0]) * -u[1] + (P[a][1] - P[b][1]) * u[0]) / l;
      },
      // (A profile has no width across the camera to scale.)
      shoulders = profile ? 1 : clamp(span(C, 'shoulderL', 'shoulderR', 'spine', 'chest') / span(R, 'shoulderL', 'shoulderR', 'spine', 'chest'), DELTA.across),
      hips = profile ? 1 : clamp(span(C, 'hipL', 'hipR', 'pelvis', 'spine') / span(R, 'hipL', 'hipR', 'pelvis', 'spine'), DELTA.across);
    // Root and spine.
    state[index.root].origin = [0, 0];
    set('root', 0);
    const pelvis = index.pelvis,
      m = move('pelvis');
    state[pelvis].origin = [bones[pelvis].x + m[0], bones[pelvis].y + m[1]];
    set('pelvis', delta('pelvis', 'spine'), ratio('pelvis', 'spine', DELTA.spineAlong), hips);
    if (hasBone('spine')) {
      attach('spine');
      set('spine', delta('spine', 'chest'), ratio('spine', 'chest', DELTA.spineAlong), (hips + shoulders) / 2);
      attach('chest');
      set('chest', delta('chest', 'neck'), ratio('chest', 'neck', DELTA.spineAlong), shoulders);
    } else {
      // Profile rig: pelvis, two lumbar bones, then a chest bone that runs through the shoulder line.
      attach('spine_lower');
      set('spine_lower', (delta('pelvis', 'spine') + delta('spine', 'chest')) / 2, ratio('pelvis', 'spine', DELTA.spineAlong));
      attach('spine_mid');
      set('spine_mid', delta('spine', 'chest'), ratio('spine', 'chest', DELTA.spineAlong));
      attach('chest');
      set('chest', delta('spine', 'chest'));
    }
    attach('neck');
    set('neck', delta('neck', 'head'), ratio('neck', 'head', DELTA.spineAlong));
    attach('head');
    set('head', delta('head', 'headTop'));
    // Arms.
    const chest = index.chest,
      chestRot = state[chest].rot,
      rotate = (p: P2, a: number): P2 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
    for (const tag of ['near', 'far']) {
      const s = sideOf(tag),
        shoulder = `shoulder${s}` as JointName,
        elbow = `elbow${s}` as JointName,
        wrist = `wrist${s}` as JointName,
        hand = `hand${s}` as JointName,
        clavicle = index[`clavicle_${tag}`],
        upper = index[`upper_arm_${tag}`],
        // The drawn socket rides the chest rigidly; add only the CHANGE of the projected offset.
        restOffset = rotate([R[shoulder][0] - R.chest[0], R[shoulder][1] - R.chest[1]], chestRot),
        change: P2 = [C[shoulder][0] - C.chest[0] - restOffset[0], C[shoulder][1] - C.chest[1] - restOffset[1]],
        drawn = rotate([bones[upper].x - bones[chest].x, bones[upper].y - bones[chest].y], chestRot),
        at: P2 = [state[chest].origin[0] + drawn[0] + change[0], state[chest].origin[1] + drawn[1] + change[1]];
      // Clavicle: the chest's rotation, carried so that the drawn shoulder lands on `at`.
      state[clavicle].rot = chestRot;
      state[clavicle].along = 1;
      state[clavicle].across = 1;
      setLinear(clavicle);
      const l = state[clavicle].linear,
        dx = bones[upper].x - bones[clavicle].x,
        dy = bones[upper].y - bones[clavicle].y;
      state[clavicle].origin = [at[0] - (l[0] * dx + l[2] * dy), at[1] - (l[1] * dx + l[3] * dy)];
      state[upper].origin = at;
      // Keep the arm's rotation continuous through +-180 deg (an arm raised overhead).
      let turn = delta(shoulder, elbow);
      while (turn - lastArm[tag] > Math.PI) turn -= 2 * Math.PI;
      while (turn - lastArm[tag] < -Math.PI) turn += 2 * Math.PI;
      lastArm[tag] = turn;
      set(`upper_arm_${tag}`, turn, ratio(shoulder, elbow, DELTA.along));
      attach(`forearm_${tag}`);
      set(`forearm_${tag}`, turn + wrap(delta(elbow, wrist) - turn), ratio(elbow, wrist, DELTA.along));
      attach(`hand_${tag}`);
      const forearmRot = state[index[`forearm_${tag}`]].rot,
        handSeen = dist(R[wrist], R[hand]) > 1 && dist(C[wrist], C[hand]) > 0.3 * dist(R[wrist], R[hand]);
      if (profile && tag === 'near')
        // The profile's hand drawings lie along +x in the bind, not on the drawn arm: set absolutely.
        set(`hand_${tag}`, handSeen ? angle(C[wrist], C[hand]) - bones[index[`hand_${tag}`]].rotation : forearmRot + bones[index[`forearm_${tag}`]].rotation - bones[index[`hand_${tag}`]].rotation);
      else set(`hand_${tag}`, handSeen ? forearmRot + wrap(delta(wrist, hand) - forearmRot) : forearmRot);
    }
    // Sleeve helpers: on the shoulder pivot, a fraction of the way from the girdle to the arm.
    for (const helper of lab.helpers ?? []) {
      const h = state[index[helper.name]],
        girdle = state[index[helper.girdle]],
        arm = state[index[helper.follows]];
      h.origin = arm.origin;
      h.rot = girdle.rot + helper.fraction * (arm.rot - girdle.rot);
      h.along = 1 + helper.fraction * (arm.along - 1);
      h.across = 1;
      setLinear(index[helper.name]);
    }
    // Legs: FK from the deltas, then two-bone IK onto the drawn ankle moved by the projection.
    const stretch = {} as Record<Side, number>;
    for (const tag of ['near', 'far']) {
      const s = sideOf(tag),
        hip = `hip${s}` as JointName,
        knee = `knee${s}` as JointName,
        ankle = `ankle${s}` as JointName,
        thigh = index[`thigh_${tag}`],
        shin = index[`shin_${tag}`],
        foot = index[`foot_${tag}`];
      attach(`thigh_${tag}`);
      const H = state[thigh].origin,
        l1 = bones[thigh].length * ratio(hip, knee, DELTA.along),
        l2 = bones[shin].length * ratio(knee, ankle, DELTA.along),
        am = move(ankle),
        A: P2 = [bones[foot].x + am[0], bones[foot].y + am[1]],
        // Which way the knee bends: as the FK from the deltas has it.
        fkThigh = bones[thigh].rotation + delta(hip, knee),
        K: P2 = [H[0] + Math.cos(fkThigh) * l1, H[1] + Math.sin(fkThigh) * l1],
        now = solveLeg(H, A, l1, l2, K, tag),
        // The same solver on the drawing itself: apply only the difference, so
        // the rest pose is the drawing to the last bit.
        was = restLeg[tag];
      stretch[s] = now.over;
      set(`thigh_${tag}`, wrap(now.thigh - was.thigh), now.a1 / was.a1);
      attach(`shin_${tag}`);
      set(`shin_${tag}`, wrap(now.shin - was.shin), now.a2 / was.a2);
      attach(`foot_${tag}`);
      set(`foot_${tag}`, delta(`heel${s}` as JointName, `toe${s}` as JointName), ratio(`heel${s}` as JointName, `toe${s}` as JointName, DELTA.footAlong));
    }
    return { C, stretch };
  }

  /**
   * `origin` (canvas px of the rig root) and `scale` (canvas px per drawing px)
   * may be forced: the bind test draws the rig 1:1 over the source sheet.
   */
  function draw(frame: ViewFrame, camera: ViewCamera, place: Placement, force?: { origin: P2; scale: number }): void {
    const { C, stretch } = pose(frame, camera),
      k = force?.scale ?? place.scale / ppm,
      // Rest: drawn heel centre on the projected heel centre.
      origin: P2 = force?.origin ?? [place.x + (restHeelMean[0] - drawnHeelMean[0]) * k, place.y + (restHeelMean[1] - drawnHeelMean[1]) * k];
    for (let i = 0; i < bones.length; i++) {
      const s = state[i],
        b = bones[i],
        o = i * 6;
      skin[o] = s.linear[0] * k;
      skin[o + 1] = s.linear[1] * k;
      skin[o + 2] = s.linear[2] * k;
      skin[o + 3] = s.linear[3] * k;
      skin[o + 4] = origin[0] + (s.origin[0] - (s.linear[0] * b.x + s.linear[2] * b.y)) * k;
      skin[o + 5] = origin[1] + (s.origin[1] - (s.linear[1] * b.x + s.linear[3] * b.y)) * k;
    }
    const handArt = `hand_${frame.hands[near] === 'grip' ? 'grip' : frame.hands[near] === 'open' ? 'open' : 'relaxed'}`;
    target?.begin();
    for (const part of rig.data.parts) {
      if (part.group === 'hand' ? part.name !== handArt : !part.visible) continue;
      layers.drawPart(part.name, skin, 1);
    }
    if (target && outline) target.end(outline.width * ppm * k, outline.colour);
    const toCanvas = (p: P2): P2 => [origin[0] + p[0] * k, origin[1] + p[1] * k],
      feet = {} as DeltaDebug['feet'];
    for (const tag of ['near', 'far']) {
      const s = sideOf(tag),
        h = socket(`heel_${tag}`),
        heel = toCanvas(through(index[`foot_${tag}`], h[0], h[1])),
        c = C[`heel${s}` as JointName],
        projectedHeel: P2 = [place.x + c[0] * k, place.y + c[1] * k];
      feet[s] = { heel, projectedHeel, offset: [heel[0] - projectedHeel[0], heel[1] - projectedHeel[1]] };
    }
    const joints: Record<string, P2> = {},
      tips: Record<string, P2> = {},
      scale: Record<string, number> = {};
    bones.forEach((b, i) => {
      joints[b.name] = toCanvas(state[i].origin);
      tips[b.name] = toCanvas(through(i, b.x + Math.cos(b.rotation) * b.length, b.y + Math.sin(b.rotation) * b.length));
      scale[b.name] = state[i].along;
    });
    debug = { feet, joints, tips, scale, ikStretch: stretch };
  }

  return {
    draw,
    ppm,
    get debug(): DeltaDebug | null {
      return debug;
    },
  };
}
