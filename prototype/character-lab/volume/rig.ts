// Drawing on volume, run time half 1: load a volume rig (rigs/<id>/volume*/) and
// skin it in 3D to a Frame.
//
// Every bone moves a vertex by  p' = origin_now + D (p - origin_bind)  with
// D = B_now * B_bind^T, where B are the segment bases of the Frame contract
// (core/types.ts). The BIND bases are not re-derived here: they are the frame
// source's own neutral-stance bases, swung by the difference between the neutral
// stance's bone directions and the drawing's fitted bone directions. So whatever
// roll convention the frame source uses (core/sim.ts puts the upper arm's z on
// the elbow point, views/synthetic.ts on the chest front), bind and run time
// agree and a neutral frame cannot twist a limb.
//
// Beyond the 16 contract segments there are derived bones (see prep/views.mjs BONES):
//   neck          halfway (slerp) between chest and head, at the neck joint
//   girdleS       at the shoulder joint: the chest's rotation plus a fraction of the
//                 arm's swing, so the shirt's shoulder line travels with the joint
//   upperS0..N    twist chain: 0 = the arm's swing from the chest with no roll,
//                 N = the full upper-arm basis; the roll is spread along the bone
//   foreS0..N     the same from the upper arm to the forearm basis (pronation)
//   thighS0..N    the same from the pelvis to the thigh basis
// Limb bones are also scaled along their axis by frame length / drawn length, so
// two drawn limbs of slightly different length both meet the frame's joints.
import { add, cross, dot, len, mul, norm, rotate, sub } from '../core/math';
import type { Basis, JointName, SegmentName, Vec3 } from '../core/types';

export interface PoseFrame {
  joints: Record<JointName, Vec3>;
  basis: Record<SegmentName, Basis>;
  yaw: { pelvis: number; chest: number; head: number };
  squash?: number;
}

export interface VolumePart {
  name: string;
  id: number;
  vertexCount: number;
  indexCount: number;
  positions: Float32Array; // bind, world
  uvs: Float32Array;
  weights: Float32Array;
  bones: Uint8Array;
  indices: Uint16Array;
}

export interface VolumeRigData {
  id: string;
  volume: string;
  view: { angleDeg: number; yawDeg: number; cameraYaw: number; cameraPitchDeg: number };
  pxPerMetre: number;
  inkWidth: number;
  stickerWidth: number;
  stickerColour: [number, number, number];
  inkColour: [number, number, number];
  atlas: { file: string; size: number };
  mesh: { file: string; bytes: number };
  bindJoints: Record<string, [number, number, number]>;
  bones: string[];
  parts: { name: string; id: number; vertexCount: number; indexCount: number; positions: number; uvs: number; weights: number; bones: number; indices: number }[];
  notes: string[];
}

export interface VolumeRig {
  data: VolumeRigData;
  parts: VolumePart[];
  atlas: HTMLImageElement;
  bind: Record<string, Vec3>;
  vertexCount: number;
}

export async function loadVolumeRig(base: string): Promise<VolumeRig> {
  const response = await fetch(`${base}/rig.json`);
  if (!response.ok) throw new Error(`${base}/rig.json: HTTP ${response.status}`);
  const data = (await response.json()) as VolumeRigData,
    buffer = await (await fetch(`${base}/${data.mesh.file}`)).arrayBuffer(),
    atlas = new Image();
  atlas.src = `${base}/${data.atlas.file}`;
  await atlas.decode();
  const parts = data.parts.map((p) => ({
      name: p.name,
      id: p.id,
      vertexCount: p.vertexCount,
      indexCount: p.indexCount,
      positions: new Float32Array(buffer, p.positions, p.vertexCount * 3),
      uvs: new Float32Array(buffer, p.uvs, p.vertexCount * 2),
      weights: new Float32Array(buffer, p.weights, p.vertexCount * 4),
      bones: new Uint8Array(buffer, p.bones, p.vertexCount * 4),
      indices: new Uint16Array(buffer, p.indices, p.indexCount),
    })),
    bind = Object.fromEntries(Object.entries(data.bindJoints).map(([name, [x, y, z]]) => [name, { x, y, z }]));
  return { data, parts, atlas, bind, vertexCount: parts.reduce((n, p) => n + p.vertexCount, 0) };
}

// ---- 3x3 matrices as three columns.
type M3 = Basis;
const IDENTITY: M3 = { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } };
const apply = (m: M3, v: Vec3): Vec3 => ({
  x: m.x.x * v.x + m.y.x * v.y + m.z.x * v.z,
  y: m.x.y * v.x + m.y.y * v.y + m.z.y * v.z,
  z: m.x.z * v.x + m.y.z * v.y + m.z.z * v.z,
});
const matMul = (a: M3, b: M3): M3 => ({ x: apply(a, b.x), y: apply(a, b.y), z: apply(a, b.z) });
const transpose = (m: M3): M3 => ({ x: { x: m.x.x, y: m.y.x, z: m.z.x }, y: { x: m.x.y, y: m.y.y, z: m.z.y }, z: { x: m.x.z, y: m.y.z, z: m.z.z } });
const rotation = (axis: Vec3, angle: number): M3 => ({ x: rotate(IDENTITY.x, axis, angle), y: rotate(IDENTITY.y, axis, angle), z: rotate(IDENTITY.z, axis, angle) });
/** now * bind^T: the rotation that carries the bind basis onto the current one. */
const delta = (now: Basis, bind: Basis): M3 => matMul(now, transpose(bind));
/** Minimal rotation taking unit a onto unit b; null when they are opposite. */
function swing(a: Vec3, b: Vec3): M3 | null {
  const c = dot(a, b);
  if (c > 1 - 1e-9) return IDENTITY;
  if (c < -0.985) return null;
  const axis = cross(a, b);
  return rotation(norm(axis), Math.atan2(len(axis), c));
}
/** Rotation a fraction t of the way from a to b (both rotations). */
function slerp(a: M3, b: M3, t: number): M3 {
  const rel = matMul(b, transpose(a)),
    trace = rel.x.x + rel.y.y + rel.z.z,
    angle = Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2)));
  if (angle < 1e-6) return a;
  const axis = norm({ x: rel.y.z - rel.z.y, y: rel.z.x - rel.x.z, z: rel.x.y - rel.y.x });
  if (angle > Math.PI - 1e-3) return t < 0.5 ? a : b;
  return matMul(rotation(axis, angle * t), a);
}
/** m * (I + (s - 1) u u^T): stretch by s along the bind-space unit axis u, then rotate. */
function scaledAlong(m: M3, u: Vec3, s: number): M3 {
  if (Math.abs(s - 1) < 1e-6) return m;
  const mu = mul(apply(m, u), s - 1);
  return { x: add(m.x, mul(mu, u.x)), y: add(m.y, mul(mu, u.y)), z: add(m.z, mul(mu, u.z)) };
}

const SEGMENTS: { name: SegmentName; from: string; to: string; origin: JointName; scaled: boolean; dirFrom?: string }[] = [
  { name: 'pelvis', from: 'pelvis', to: 'spine', origin: 'pelvis', scaled: false },
  { name: 'spine', from: 'spine', to: 'chest', origin: 'spine', scaled: false },
  { name: 'chest', from: 'chest', to: 'head', origin: 'chest', scaled: false },
  { name: 'head', from: 'head', to: 'headTop', origin: 'head', scaled: false },
  ...(['L', 'R'] as const).flatMap((s) => [
    { name: `upperArm${s}` as SegmentName, from: `shoulder${s}`, to: `elbow${s}`, origin: `shoulder${s}` as JointName, scaled: true },
    { name: `forearm${s}` as SegmentName, from: `elbow${s}`, to: `wrist${s}`, origin: `elbow${s}` as JointName, scaled: true },
    { name: `hand${s}` as SegmentName, from: `wrist${s}`, to: `hand${s}`, origin: `wrist${s}` as JointName, scaled: false },
    { name: `thigh${s}` as SegmentName, from: `hip${s}`, to: `knee${s}`, origin: `hip${s}` as JointName, scaled: true },
    { name: `shin${s}` as SegmentName, from: `knee${s}`, to: `ankle${s}`, origin: `knee${s}` as JointName, scaled: true },
    { name: `foot${s}` as SegmentName, from: `heel${s}`, to: `toe${s}`, origin: `ankle${s}` as JointName, scaled: false },
  ]),
];

export const SOLVER = {
  girdleFollow: 0.3, // share of the arm's swing the shoulder girdle takes
  neckShare: 0.5,
};

export interface Solved {
  /** 12 floats per bone: rotation columns (9) then translation (3); p' = R p + t. */
  matrices: Float32Array;
  /** Roll (rad) spread along each twist chain, for review. */
  twist: Record<string, number>;
}

/**
 * @param reference a NEUTRAL standing frame from the same source as the frames
 *                  that will be drawn (any yaw). It only supplies the basis convention.
 */
export function createSolver(rig: VolumeRig, reference: PoseFrame) {
  const bind = rig.bind,
    names = rig.data.bones,
    index = Object.fromEntries(names.map((name, i) => [name, i])),
    steps = names.filter((name) => /^upperR\d+$/.test(name)).length - 1,
    bindYaw = (rig.data.view.yawDeg * Math.PI) / 180,
    turn = bindYaw - reference.yaw.pelvis,
    Y = { x: 0, y: 1, z: 0 },
    bindBasis = {} as Record<SegmentName, Basis>,
    bindLength = {} as Record<SegmentName, number>,
    info = Object.fromEntries(SEGMENTS.map((s) => [s.name, s])) as Record<SegmentName, (typeof SEGMENTS)[number]>;
  for (const segment of SEGMENTS) {
    const ref = reference.basis[segment.name],
      turned: Basis = { x: rotate(ref.x, Y, turn), y: rotate(ref.y, Y, turn), z: rotate(ref.z, Y, turn) },
      refDir = norm(rotate(sub(reference.joints[segment.to as JointName], reference.joints[segment.from as JointName]), Y, turn)),
      bindDir = norm(sub(bind[segment.to], bind[segment.from])),
      s = swing(refDir, bindDir) ?? IDENTITY;
    bindBasis[segment.name] = matMul(s, turned);
    bindLength[segment.name] = len(sub(bind[segment.to], bind[segment.from]));
  }
  const matrices = new Float32Array(names.length * 12),
    twist: Record<string, number> = {};
  function put(name: string, m: M3, originBind: Vec3, originNow: Vec3): void {
    const i = index[name];
    if (i === undefined) return;
    const t = sub(originNow, apply(m, originBind));
    matrices.set([m.x.x, m.x.y, m.x.z, m.y.x, m.y.y, m.y.z, m.z.x, m.z.y, m.z.z, t.x, t.y, t.z], i * 12);
  }
  /** A twist chain from the parent's rotation to this segment's full basis. */
  function chain(prefix: string, segment: SegmentName, parent: M3, frame: PoseFrame): M3 {
    const s = info[segment],
      now = frame.basis[segment],
      bindB = bindBasis[segment],
      full = delta(now, bindB),
      carried = norm(apply(parent, bindB.x)),
      sw = swing(carried, now.x),
      base = sw ? matMul(sw, parent) : full,
      rolled = apply(base, bindB.y),
      roll = sw ? Math.atan2(dot(cross(rolled, now.y), now.x), dot(rolled, now.y)) : 0,
      stretch = len(sub(frame.joints[s.to as JointName], frame.joints[s.from as JointName])) / bindLength[segment];
    twist[prefix] = roll;
    for (let k = 0; k <= steps; k++) put(`${prefix}${k}`, scaledAlong(matMul(rotation(now.x, (roll * k) / steps), base), bindB.x, stretch), bind[s.origin], frame.joints[s.origin]);
    return full;
  }
  function solve(frame: PoseFrame): Solved {
    const D = (segment: SegmentName) => delta(frame.basis[segment], bindBasis[segment]),
      pelvis = D('pelvis'),
      chest = D('chest'),
      head = D('head');
    put('pelvis', pelvis, bind.pelvis, frame.joints.pelvis);
    put('spine', D('spine'), bind.spine, frame.joints.spine);
    put('chest', chest, bind.chest, frame.joints.chest);
    put('head', head, bind.head, frame.joints.head);
    put('neck', slerp(chest, head, SOLVER.neckShare), bind.neck, frame.joints.neck);
    for (const s of ['L', 'R'] as const) {
      const upperNow = frame.basis[`upperArm${s}`],
        carried = norm(apply(chest, bindBasis[`upperArm${s}`].x)),
        sw = swing(carried, upperNow.x),
        armSwing = sw ? matMul(sw, chest) : chest;
      put(`girdle${s}`, slerp(chest, armSwing, SOLVER.girdleFollow), bind[`shoulder${s}`], frame.joints[`shoulder${s}`]);
      const upper = chain(`upper${s}`, `upperArm${s}`, chest, frame);
      chain(`fore${s}`, `forearm${s}`, upper, frame);
      put(`hand${s}`, D(`hand${s}`), bind[`wrist${s}`], frame.joints[`wrist${s}`]);
      chain(`thigh${s}`, `thigh${s}`, pelvis, frame);
      const shin = info[`shin${s}`],
        stretch = len(sub(frame.joints[shin.to as JointName], frame.joints[shin.from as JointName])) / bindLength[`shin${s}`];
      put(`shin${s}`, scaledAlong(D(`shin${s}`), bindBasis[`shin${s}`].x, stretch), bind[`knee${s}`], frame.joints[`knee${s}`]);
      put(`foot${s}`, D(`foot${s}`), bind[`ankle${s}`], frame.joints[`ankle${s}`]);
    }
    return { matrices, twist };
  }
  /** The drawing's own pose as a frame-like set of bases (identity skinning when solved). */
  const bindFrame = (): PoseFrame => ({
    joints: bind as Record<JointName, Vec3>,
    basis: bindBasis,
    yaw: { pelvis: bindYaw, chest: bindYaw, head: bindYaw },
  });
  return { solve, bindFrame, bindBasis };
}

/** Linear blend skinning of one part into `out` (world xyz per vertex). */
export function skinPart(part: VolumePart, matrices: Float32Array, out: Float32Array): void {
  const { positions, weights, bones, vertexCount } = part;
  for (let v = 0; v < vertexCount; v++) {
    const px = positions[v * 3],
      py = positions[v * 3 + 1],
      pz = positions[v * 3 + 2];
    let x = 0,
      y = 0,
      z = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[v * 4 + k];
      if (w === 0) continue;
      const m = bones[v * 4 + k] * 12;
      x += w * (matrices[m] * px + matrices[m + 3] * py + matrices[m + 6] * pz + matrices[m + 9]);
      y += w * (matrices[m + 1] * px + matrices[m + 4] * py + matrices[m + 7] * pz + matrices[m + 10]);
      z += w * (matrices[m + 2] * px + matrices[m + 5] * py + matrices[m + 8] * pz + matrices[m + 11]);
    }
    out[v * 3] = x;
    out[v * 3 + 1] = y;
    out[v * 3 + 2] = z;
  }
}
