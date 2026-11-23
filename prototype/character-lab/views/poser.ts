// The 2.5D poser: draws a character's hand-drawn cut-out view rigs posed from
// the PROJECTED joints of the 3D skeleton. Nothing here owns position, timing
// or results; every drawn bone is placed from the projection, so both views of
// a block share their joints and a planted foot cannot move at a view switch.
//
// Rules (also in SUBMISSION.md and viewtest):
// - View per block (trunk, head, each arm, each leg) from the block's facing
//   relative to the camera: 0 deg = profile facing screen-right, +90 = front,
//   -90 = back, 180 = mirrored profile. Front art inside (40, 140) deg, back
//   art inside (-140, -40), profile art elsewhere; 6 deg of hysteresis.
// - A view change cross-dissolves over POSER.dissolveSteps steps: the incoming
//   drawing fades in on top of the opaque outgoing one, which then fades out.
// - Each 2D bone starts at its projected joint, points along the projected 3D
//   bone and is scaled along its length by the foreshortening, floored at
//   MIN_ALONG (see `setBone`): below that the drawing stops shrinking and
//   overshoots the far joint, which the next segment or the hand covers.
// - Draw order from projected depth; see `layerOf*`.
import { loadRig, type Rig } from '../../motion/rig/rig';
import { project as coreProject } from '../core/camera';
import { RigLayers, drawFan } from './renderer';
import {
  facing,
  viewAngleOf,
  type Basis,
  type HandPose,
  type JointName,
  type ProjectFn,
  type Proportions,
  type SegmentName,
  type Side,
  type Vec3,
  type ViewCamera,
  type ViewFrame,
  type ViewKind,
  type ViewProp,
} from './contract';

export const POSER = {
  frontFrom: 40, // deg: front art inside (frontFrom, 180 - frontFrom)
  hysteresis: 6, // deg
  headFlipHysteresis: 8, // deg around dead-on front, where the 3/4 head mirrors
  dissolveSteps: 6, // steps of 1/60 s
  minAlong: 0.3, // floor of the along-bone scale (limb pointing at the camera)
  maxAlong: 1.5,
  minAcross: 0.56, // floor of the front/back trunk's width scale (edge-on)
  maxAcross: 1.25,
  sideSocketReach: 0.03, // m a profile arm root may sit from the drawn shoulder
  sideHipReach: 0.035, // m a profile leg root may sit from the pelvis centre
  frontFootTurn: 0.35, // share of the projected turn-out applied to a front/back shoe drawing
  armBehind: 0.05, // m behind the trunk before a front-view arm goes behind it
  legOver: 0.2, // m a knee must lead the pelvis before a front-view leg covers the trunk
  bag: { half: 0.075, thick: 0.02, inPalm: 0.012 },
  handMinAlong: 0.45, // floor of the hand drawing's length when the fingers point at the camera
};

export interface Placement {
  /** Canvas pixel of the world origin's ground point. */
  x: number;
  y: number;
  /** Pixels per metre. */
  scale: number;
}

export interface CharacterRigs {
  id: string;
  proportions: Proportions;
  info: { views: Record<string, { standIn?: boolean; reason?: string; replaceWith?: string } | null> };
  rigs: Partial<Record<ViewKind, Rig>>;
}

export async function loadCharacterRigs(base: string, id: string): Promise<CharacterRigs> {
  const json = async (name: string) => {
    const response = await fetch(`${base}/${id}/${name}`);
    if (!response.ok) throw new Error(`${id}/${name}: HTTP ${response.status}`);
    return response.json();
  };
  const [proportions, info] = await Promise.all([json('proportions.json'), json('views.json')]),
    rigs: Partial<Record<ViewKind, Rig>> = {};
  for (const kind of ['side', 'sideRear', 'front', 'back'] as const)
    if (info.views[kind]) rigs[kind] = await loadRig(`${base}/${id}/${kind}/rig.json`);
  return { id, proportions, info, rigs };
}

type BlockName = 'trunk' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
const BLOCKS: BlockName[] = ['trunk', 'head', 'armL', 'armR', 'legL', 'legR'];

export interface BlockDebug {
  kind: ViewKind;
  mirrored: boolean;
  angle: number; // deg
  canonical: string;
  standIn: boolean;
  fading: number; // 0..1, 1 = settled
}
export interface PoserDebug {
  blocks: Record<BlockName, BlockDebug>;
  /** Canvas px. `heel`/`ankle` are where the DRAWN foot has them. */
  feet: Record<Side, { ankle: [number, number]; heel: [number, number]; toe: [number, number]; projectedHeel: [number, number]; planted: boolean }>;
  /** Along-bone scale per limb segment and whether the floor was hit. */
  along: Record<string, { scale: number; clamped: boolean }>;
  order: string[];
  nearArm: Side;
  nearLeg: Side;
  hands: Record<Side, { art: string; mirrored: boolean; palmToCamera: number }>;
  label: string;
}

interface Ctx {
  kind: ViewKind;
  rig: Rig;
  layers: RigLayers;
  pxPerM: number;
  k: number;
  sets: Record<string, Float32Array>;
  isSide: boolean;
  trunkMirror: number;
  joints: Record<string, [number, number]>; // bind joints (front/back)
  spine: Record<string, [number, number]>;
  wristWidth: number;
}
interface BlockState {
  kind: ViewKind;
  mirror: number;
  prevKind: ViewKind;
  prevMirror: number;
  t: number;
}
interface Item {
  key: number;
  order: number;
  draw: () => void;
  name: string;
}
type P2 = [number, number];

const DEG = 180 / Math.PI;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function createCharacterView(
  gl: WebGLRenderingContext,
  character: CharacterRigs,
  options: { project?: ProjectFn } = {},
) {
  const project = options.project ?? (coreProject as ProjectFn),
    height = character.proportions.height,
    contexts: Partial<Record<ViewKind, Ctx>> = {};
  for (const kind of Object.keys(character.rigs) as ViewKind[]) {
    const rig = character.rigs[kind]!,
      lab = (rig.data.meta.lab ?? {}) as { joints?: Record<string, [number, number]>; spine?: Record<string, [number, number]>; wristWidth?: number };
    contexts[kind] = {
      kind,
      rig,
      layers: new RigLayers(gl, rig),
      pxPerM: rig.data.meta.heightPx / height,
      k: 1,
      sets: {},
      isSide: kind === 'side' || kind === 'sideRear',
      trunkMirror: 1,
      joints: lab.joints ?? {},
      spine: lab.spine ?? {},
      wristWidth: lab.wristWidth ?? 0,
    };
  }
  const state: Partial<Record<BlockName, BlockState>> = {};
  let lastStep: number | null = null,
    nearArm: Side = 'R',
    nearLeg: Side = 'R';
  const armOver: Record<Side, boolean> = { L: true, R: true },
    handMirror: Record<Side, number> = { L: 1, R: 1 };

  const setOf = (ctx: Ctx, name: string) => (ctx.sets[name] ??= new Float32Array(ctx.rig.data.bones.length * 6));
  const boneOf = (ctx: Ctx, name: string) => {
    const i = ctx.rig.boneIndex[name];
    if (i === undefined) throw new Error(`${ctx.kind}: no bone ${name}`);
    return i;
  };

  /**
   * Place one bone: its bind origin goes to (ox, oy) and its bind direction
   * turns to point at (tx, ty). Along-bone scale = projected length / drawn
   * length, clamped to [min, max]; across-bone scale = `across`; `mirror` -1
   * reflects the drawing across the bone. Returns the unclamped scale.
   */
  function setBone(
    ctx: Ctx, set: Float32Array, name: string, ox: number, oy: number, tx: number, ty: number,
    o: { across?: number; mirror?: number; min?: number; max?: number; rigid?: boolean; anchorEnd?: boolean; bind?: { x: number; y: number; rotation: number; length: number }; fallback?: P2 } = {},
  ): number {
    const i = boneOf(ctx, name),
      bone = o.bind ?? ctx.rig.data.bones[i],
      k = ctx.k,
      dx = tx - ox,
      dy = ty - oy,
      length = Math.hypot(dx, dy),
      raw = bone.length > 0 ? length / (bone.length * k) : 1,
      along = o.rigid ? 1 : clamp(raw, o.min ?? POSER.minAlong, o.max ?? POSER.maxAlong),
      across = o.across ?? 1,
      m = o.mirror ?? 1;
    let ux = 0,
      uy = 1;
    if (length > 1e-4) {
      ux = dx / length;
      uy = dy / length;
    } else if (o.fallback) [ux, uy] = o.fallback;
    // At the floor a distal segment keeps its FAR joint true and hides the
    // surplus length back under its parent (the hand or foot covers the rest).
    if (o.anchorEnd && raw < (o.min ?? POSER.minAlong)) {
      if (length < 0.35 * bone.length * k * along && o.fallback) [ux, uy] = blend([ux, uy], o.fallback, length / (0.35 * bone.length * k * along));
      ox = tx - ux * bone.length * k * along;
      oy = ty - uy * bone.length * k * along;
    }
    const wa = ux * along * k,
      wb = uy * along * k,
      wc = -uy * across * k * m,
      wd = ux * across * k * m,
      c = Math.cos(bone.rotation),
      s = Math.sin(bone.rotation),
      a = wa * c - wc * s,
      b = wb * c - wd * s,
      cc = wa * s + wc * c,
      d = wb * s + wd * c,
      q = i * 6;
    set[q] = a;
    set[q + 1] = b;
    set[q + 2] = cc;
    set[q + 3] = d;
    set[q + 4] = ox - (a * bone.x + cc * bone.y);
    set[q + 5] = oy - (b * bone.x + d * bone.y);
    return raw;
  }
  const copyBone = (ctx: Ctx, set: Float32Array, to: string, from: string, source = set) => {
    const a = boneOf(ctx, to) * 6,
      b = boneOf(ctx, from) * 6;
    for (let n = 0; n < 6; n++) set[a + n] = source[b + n];
  };
  /** Like `copyBone`, then translated so the bind point (x, y) lands on `at`. */
  const copyBoneTo = (ctx: Ctx, set: Float32Array, to: string, from: string, x: number, y: number, at: P2) => {
    copyBone(ctx, set, to, from);
    const q = boneOf(ctx, to) * 6;
    set[q + 4] = at[0] - (set[q] * x + set[q + 2] * y);
    set[q + 5] = at[1] - (set[q + 1] * x + set[q + 3] * y);
  };
  const through = (ctx: Ctx, set: Float32Array, bone: string, x: number, y: number): P2 => {
    const q = boneOf(ctx, bone) * 6;
    return [set[q] * x + set[q + 2] * y + set[q + 4], set[q + 1] * x + set[q + 3] * y + set[q + 5]];
  };
  const bindOf = (ctx: Ctx, name: string) => ctx.rig.data.bones[boneOf(ctx, name)];
  const socketOf = (ctx: Ctx, name: string): P2 => {
    const socket = ctx.rig.data.sockets[ctx.rig.socketIndex[name]];
    return [socket.x, socket.y];
  };

  function chooseKind(previous: ViewKind | null, angle: number): ViewKind {
    const a = angle * DEG,
      from = POSER.frontFrom,
      h = POSER.hysteresis,
      front = (slack: number) => a > from - slack && a < 180 - from + slack,
      back = (slack: number) => a < -from + slack && a > -180 + from - slack,
      // Profile art: the plain profile when the block is turned a little toward
      // the camera and faces screen-right; the rear-garment profile when it is
      // turned away, and for the whole mirrored (left-facing) half so a chest
      // print is never shown mirrored.
      rear = contexts.sideRear && (Math.cos(angle) < 0 || (previous === 'sideRear' ? a < h : a < -h)),
      profile = (): ViewKind => (rear ? 'sideRear' : 'side');
    if (previous === 'front' && front(h)) return 'front';
    if (previous === 'back' && back(h)) return 'back';
    if ((previous === 'side' || previous === 'sideRear') && !front(-h) && !back(-h)) return profile();
    return front(0) ? 'front' : back(0) ? 'back' : profile();
  }
  const canonical = (angle: number) => {
    const a = angle * DEG,
      d = (x: number) => Math.abs(((a - x + 540) % 360) - 180);
    if (d(0) <= 22.5 || d(180) <= 22.5) return 'side';
    if (d(90) <= 22.5) return 'front';
    if (d(-90) <= 22.5) return 'back';
    return a > 0 ? 'threeQuarterFront' : 'threeQuarterBack';
  };

  let debug: PoserDebug | null = null;

  function draw(frame: ViewFrame, camera: ViewCamera, place: Placement): void {
    const S = place.scale,
      J = frame.joints,
      squash = frame.squash ?? 1,
      squashX = 1 / Math.sqrt(squash),
      pivot = project({ x: J.pelvis.x, y: 0, z: J.pelvis.z }, camera),
      pivotX = place.x + pivot.x * S,
      pivotY = place.y - pivot.y * S;
    // World -> canvas px, root-level squash about the ground point under the pelvis.
    const screen = (p: Vec3): P2 => {
      const q = project(p, camera);
      return [pivotX + (place.x + q.x * S - pivotX) * squashX, pivotY + (place.y - q.y * S - pivotY) * squash];
    };
    const depth = (p: Vec3) => project(p, camera).depth;
    const P = {} as Record<JointName, P2>,
      D = {} as Record<JointName, number>;
    for (const name of Object.keys(J) as JointName[]) {
      P[name] = screen(J[name]);
      D[name] = depth(J[name]);
    }
    const vector = (at: Vec3, v: Vec3, metres: number): P2 => {
      const a = screen(at),
        b = screen({ x: at.x + v.x * metres, y: at.y + v.y * metres, z: at.z + v.z * metres });
      return [b[0] - a[0], b[1] - a[1]];
    };
    const front = (segment: SegmentName, yaw: number): Vec3 => frame.basis?.[segment]?.z ?? facing(yaw);
    const flat = (v: Vec3) => Math.hypot(v.x, v.z);

    // ---- Facing of each block relative to the camera.
    const pelvisFront = front('pelvis', frame.yaw.pelvis),
      chestFront = front('chest', frame.yaw.chest),
      trunkFront = { x: pelvisFront.x + chestFront.x, y: 0, z: pelvisFront.z + chestFront.z },
      legFront = (s: Side) => {
        const z = frame.basis?.[`thigh${s}`]?.z;
        return z && flat(z) > 0.6 ? z : pelvisFront;
      },
      angles: Record<BlockName, number> = {
        trunk: viewAngleOf(trunkFront, camera, project),
        head: viewAngleOf(front('head', frame.yaw.head), camera, project),
        armL: viewAngleOf(chestFront, camera, project),
        armR: viewAngleOf(chestFront, camera, project),
        legL: viewAngleOf(legFront('L'), camera, project),
        legR: viewAngleOf(legFront('R'), camera, project),
      };

    // ---- View state per block, with hysteresis and a dissolve on change.
    const steps = lastStep === null ? Infinity : Math.abs(frame.step - lastStep),
      snap = steps > 30;
    lastStep = frame.step;
    for (const block of BLOCKS) {
      const angle = angles[block],
        previous = state[block],
        kind = chooseKind(previous?.kind ?? null, angle);
      let mirror = Math.cos(angle) < 0 ? -1 : 1;
      if (block === 'head' && (kind === 'front' || kind === 'back') && previous && previous.kind === kind) {
        // The three-quarter head mirrors at dead-on; keep it until clearly past.
        const edge = Math.cos(angle) * DEG; // ~deg from dead-on for small angles
        if (Math.abs(edge) < POSER.headFlipHysteresis) mirror = previous.mirror;
      }
      if (kind === 'front' && block !== 'head') mirror = 1;
      if (kind === 'back' && block !== 'head') mirror = -1;
      if (!previous || snap) state[block] = { kind, mirror, prevKind: kind, prevMirror: mirror, t: 1 };
      else {
        if (previous.kind !== kind || (block === 'head' && previous.mirror !== mirror)) {
          previous.prevKind = previous.kind;
          previous.prevMirror = previous.mirror;
          previous.kind = kind;
          previous.t = 0;
        } else if (previous.t < 1) previous.t = Math.min(1, previous.t + steps / POSER.dissolveSteps);
        previous.mirror = mirror;
      }
    }

    // ---- Which anatomical side is nearer the camera (profile art has near/far limbs).
    if (D.shoulderL - D.shoulderR > 0.02) nearArm = 'L';
    else if (D.shoulderR - D.shoulderL > 0.02) nearArm = 'R';
    if (D.hipL - D.hipR > 0.01) nearLeg = 'L';
    else if (D.hipR - D.hipL > 0.01) nearLeg = 'R';

    const along: PoserDebug['along'] = {},
      note = (name: string, raw: number, min = POSER.minAlong) => (along[name] = { scale: raw, clamped: raw < min });
    const spinePoints = [P.pelvis, P.spine, P.chest, P.neck, P.head],
      spineAt = (t: number): P2 => {
        const i = Math.min(3, Math.max(0, Math.floor(t))),
          f = t - i;
        return [spinePoints[i][0] + (spinePoints[i + 1][0] - spinePoints[i][0]) * f, spinePoints[i][1] + (spinePoints[i + 1][1] - spinePoints[i][1]) * f];
      };
    const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');
    const feet = {} as PoserDebug['feet'];
    const sideMirror = Math.cos(angles.trunk) < 0 ? -1 : 1;

    // ---- Pose every rig that is on screen this frame.
    const needed = new Set<ViewKind>();
    for (const block of BLOCKS) {
      needed.add(state[block]!.kind);
      if (state[block]!.t < 1) needed.add(state[block]!.prevKind);
    }
    needed.add('side'); // hand drawings live on the profile sheet

    const armData = {} as Record<ViewKind, Record<Side, { set: Float32Array; parts: string[]; hand: string | null; key: number }>>;
    const legData = {} as Record<ViewKind, Record<Side, { parts: string[]; key: number }>>;
    for (const kind of needed) {
      const ctx = contexts[kind];
      if (!ctx) continue;
      ctx.k = S / ctx.pxPerM;
      const base = setOf(ctx, 'base'),
        k = ctx.k;
      // -- Trunk: spine bones sample the projected pelvis..head polyline.
      let m = sideMirror,
        hipAcross = 1,
        shoulderAcross = 1;
      if (!ctx.isSide) {
        const ux = P.chest[0] - P.pelvis[0],
          uy = P.chest[1] - P.pelvis[1],
          ul = Math.hypot(ux, uy) || 1,
          px = -uy / ul,
          py = ux / ul,
          shoulders = (P.shoulderL[0] - P.shoulderR[0]) * px + (P.shoulderL[1] - P.shoulderR[1]) * py,
          hips = (P.hipL[0] - P.hipR[0]) * px + (P.hipL[1] - P.hipR[1]) * py,
          bindShoulders = Math.abs(ctx.joints.shoulderL[0] - ctx.joints.shoulderR[0]) * k,
          bindHips = Math.abs(ctx.joints.hipL[0] - ctx.joints.hipR[0]) * k;
        m = kind === 'front' ? 1 : -1;
        // The drawn L side is on the bone's +perp side; follow the projection's sign when it is clear.
        if (Math.abs(shoulders) > 0.08 * S) m = shoulders > 0 ? 1 : -1;
        shoulderAcross = clamp(Math.abs(shoulders) / bindShoulders, POSER.minAcross, POSER.maxAcross);
        hipAcross = clamp(Math.abs(hips) / bindHips, POSER.minAcross, POSER.maxAcross);
        note(`${kind}.trunkWidth`, Math.abs(shoulders) / bindShoulders, POSER.minAcross);
      }
      ctx.trunkMirror = m;
      for (const [name, [t0, t1]] of Object.entries(ctx.spine)) {
        const a = spineAt(t0),
          b = spineAt(t1),
          mid = (t0 + t1) / 2,
          across = ctx.isSide ? 1 : mid <= 2.5 ? hipAcross + (shoulderAcross - hipAcross) * clamp(mid / 2, 0, 1) : Math.max(shoulderAcross, 0.85);
        setBone(ctx, base, name, a[0], a[1], b[0], b[1], { across, mirror: m, min: 0.5, max: 1.7, fallback: [0, -1] });
      }
      copyBone(ctx, base, 'root', 'pelvis');
      // The trunk drawing reaches a little past the head joint; the head part overrides this below.
      setBone(ctx, base, 'head', P.head[0], P.head[1], P.headTop[0], P.headTop[1], { rigid: true, mirror: m, fallback: [0, -1] });
      // -- Legs.
      legData[kind] = {} as Record<Side, { parts: string[]; key: number }>;
      for (const s of ['L', 'R'] as Side[]) {
        const tag = ctx.isSide ? (s === nearLeg ? 'near' : 'far') : s,
          hip = `hip${s}` as JointName,
          knee = `knee${s}` as JointName,
          ankle = `ankle${s}` as JointName,
          heel = `heel${s}` as JointName,
          toe = `toe${s}` as JointName,
          legMirror = ctx.isSide ? (Math.cos(angles[`leg${s}`]) < 0 ? -1 : 1) : m,
          root: P2 = ctx.isSide
            ? reachFrom(P.pelvis, [P[hip][0] - P.pelvis[0], P[hip][1] - P.pelvis[1]], POSER.sideHipReach * S)
            : through(ctx, base, 'pelvis', ctx.joints[hip][0], ctx.joints[hip][1]),
          dx = root[0] - P[hip][0],
          dy = root[1] - P[hip][1],
          kneeAt: P2 = [P[knee][0] + dx * 0.4, P[knee][1] + dy * 0.4];
        // Foot first: the drawn heel sits on the projected heel, so the sole
        // stays put whatever drawing is used.
        const bindHeel = socketOf(ctx, `heel_${tag}`),
          bindToe = socketOf(ctx, `toe_${tag}`),
          footBone = bindOf(ctx, `foot_${tag}`),
          bind = {
            x: bindHeel[0],
            y: bindHeel[1],
            rotation: Math.atan2(bindToe[1] - bindHeel[1], bindToe[0] - bindHeel[0]),
            length: Math.hypot(bindToe[0] - bindHeel[0], bindToe[1] - bindHeel[1]),
          };
        let fx = P[toe][0] - P[heel][0],
          fy = P[toe][1] - P[heel][1];
        if (!ctx.isSide) {
          // Front/back shoes are drawn toes-toward-camera: keep the drawing's own
          // angle and only turn it by (part of) the foot's projected turn-out.
          const turn = -POSER.frontFootTurn * Math.asin(clamp(fx / (character.proportions.footLen * S), -1, 1)),
            bx = Math.cos(bind.rotation) * legMirror,
            by = Math.sin(bind.rotation);
          fx = bx * Math.cos(turn) - by * Math.sin(turn);
          fy = bx * Math.sin(turn) + by * Math.cos(turn);
        }
        const raw = setBone(ctx, base, `foot_${tag}`, P[heel][0], P[heel][1], P[heel][0] + fx, P[heel][1] + fy, {
          bind, mirror: legMirror, rigid: !ctx.isSide, min: 0.6, max: 1.15, fallback: [legMirror, 0],
        });
        const drawnAnkle = through(ctx, base, `foot_${tag}`, footBone.x, footBone.y);
        if (state[`leg${s}`]!.kind === kind) {
          note(`foot${s}`, raw, 0.6);
          feet[s] = {
            ankle: drawnAnkle,
            heel: through(ctx, base, `foot_${tag}`, bindHeel[0], bindHeel[1]),
            toe: through(ctx, base, `foot_${tag}`, bindToe[0], bindToe[1]),
            projectedHeel: P[heel],
            planted: frame.contacts?.[`foot${s}`] ?? false,
          };
        }
        const thigh = setBone(ctx, base, `thigh_${tag}`, root[0], root[1], kneeAt[0], kneeAt[1], { mirror: legMirror, fallback: [0, 1] }),
          shin = setBone(ctx, base, `shin_${tag}`, kneeAt[0], kneeAt[1], drawnAnkle[0], drawnAnkle[1], {
            mirror: legMirror, anchorEnd: true, fallback: unit([drawnAnkle[0] - root[0], drawnAnkle[1] - root[1] + 0.02 * S]),
          });
        if (state[`leg${s}`]!.kind === kind) {
          note(`thigh${s}`, thigh);
          note(`shin${s}`, shin);
        }
        const pelvisDepth = D.pelvis;
        let key: number;
        if (ctx.isSide) key = s === nearLeg ? 50 : 40;
        else {
          const lead = (D[knee] - pelvisDepth) * (kind === 'back' ? 1 : 1);
          key = lead > POSER.legOver ? 104 : 48 + (D[knee] > D[`knee${other(s)}` as JointName] ? 1 : 0);
        }
        legData[kind][s] = { parts: ctx.isSide ? [`leg_${tag}`] : [`leg_${s}`], key };
      }

      // -- Arms. Profile art has one complete arm (the near one, with its
      // sleeve); both anatomical arms use it, each with its own matrices.
      armData[kind] = {} as Record<Side, { set: Float32Array; parts: string[]; hand: string | null; key: number }>;
      const trunkDepth = (D.chest + D.pelvis) / 2;
      for (const s of [nearArm, other(nearArm)]) {
        const shoulder = `shoulder${s}` as JointName,
          elbow = `elbow${s}` as JointName,
          wrist = `wrist${s}` as JointName,
          names = ctx.isSide ? ['upper_arm_near', 'forearm_near', 'hand_near'] : [`upper_arm_${s}`, `forearm_${s}`, `hand_${s}`],
          set = ctx.isSide && s !== nearArm ? setOf(ctx, 'armFar') : base;
        if (set !== base) set.set(base);
        const armMirror = ctx.isSide ? (Math.cos(angles[`arm${s}`]) < 0 ? -1 : 1) : m;
        let root: P2;
        if (ctx.isSide) {
          // The drawn shoulder, moved only by how far the 3D shoulder sits off the
          // chest centre on screen (zero in a pure profile), within a short reach.
          const b = bindOf(ctx, 'upper_arm_near'),
            drawn = through(ctx, base, 'chest', b.x, b.y);
          root = reachFrom(drawn, [P[shoulder][0] - P.chest[0], P[shoulder][1] - P.chest[1]], POSER.sideSocketReach * S);
          copyBoneTo(ctx, set, 'clavicle_near', 'chest', b.x, b.y, root);
        } else root = through(ctx, base, 'chest', ctx.joints[shoulder][0], ctx.joints[shoulder][1]);
        const dx = root[0] - P[shoulder][0],
          dy = root[1] - P[shoulder][1],
          elbowAt: P2 = [P[elbow][0] + dx * 0.5, P[elbow][1] + dy * 0.5],
          upper = setBone(ctx, set, names[0], root[0], root[1], elbowAt[0], elbowAt[1], { mirror: armMirror, fallback: [0, 1] }),
          fore = setBone(ctx, set, names[1], elbowAt[0], elbowAt[1], P[wrist][0], P[wrist][1], {
            mirror: armMirror, anchorEnd: true, fallback: unit([P[wrist][0] - root[0], P[wrist][1] - root[1] + 0.02 * S]),
          });
        // Baked (front/back) hand: follows the hand direction, rigid.
        const hd = handDirection(s),
          foreDir: P2 = [P[wrist][0] - elbowAt[0], P[wrist][1] - elbowAt[1]];
        setBone(ctx, set, names[2], P[wrist][0], P[wrist][1], P[wrist][0] + hd[0], P[wrist][1] + hd[1], {
          rigid: true, mirror: armMirror, fallback: unit(foreDir),
        });
        if (state[`arm${s}`]!.kind === kind) {
          note(`upperArm${s}`, upper);
          note(`forearm${s}`, fore);
        }
        const armDepth = (D[elbow] + D[wrist]) / 2;
        let key: number;
        if (ctx.isSide) key = s === nearArm ? 130 : 20;
        else {
          const behind = trunkDepth - armDepth;
          if (armOver[s] && behind > POSER.armBehind + 0.03) armOver[s] = false;
          else if (!armOver[s] && behind < POSER.armBehind - 0.03) armOver[s] = true;
          key = (armOver[s] ? 130 : 20) + (armDepth > (D[`elbow${other(s)}` as JointName] + D[`wrist${other(s)}` as JointName]) / 2 ? 1 : 0);
        }
        armData[kind][s] = {
          set,
          parts: ctx.isSide ? ['sleeve_near_back', 'arm_near', 'sleeve_near'] : [`arm_${s}`],
          hand: ctx.isSide ? null : `hand_${s}`,
          key,
        };
      }
      if (ctx.isSide) {
        copyBone(ctx, base, 'clavicle_far', 'chest');
        for (const name of ['upper_arm_far', 'forearm_far', 'hand_far']) copyBone(ctx, base, name, 'chest');
      }
      // -- Head: rigid, from the head joint toward the crown.
      const headState = state.head!,
        headMirror = headState.kind === kind ? headState.mirror : headState.prevKind === kind ? headState.prevMirror : m,
        headSet = setOf(ctx, 'head');
      headSet.set(base);
      setBone(ctx, headSet, 'head', P.head[0], P.head[1], P.headTop[0], P.headTop[1], { rigid: true, mirror: headMirror, fallback: [0, -1] });
      if (ctx.isSide && headMirror !== m)
        for (const name of ['neck', 'chest']) {
          // The profile head part carries a little neck; keep it under the head.
          const bone = bindOf(ctx, name === 'neck' ? 'head' : 'neck');
          copyBoneTo(ctx, headSet, name, 'head', bone.x, bone.y, P.head);
        }
      if (!ctx.isSide) {
        const old = setOf(ctx, 'headOld');
        old.set(base);
        setBone(ctx, old, 'head', P.head[0], P.head[1], P.headTop[0], P.headTop[1], { rigid: true, mirror: headState.prevMirror, fallback: [0, -1] });
      }

    }

    // ---- Hands from the profile sheet (grip / open / relaxed), any view.
    function handDirection(s: Side): P2 {
      const wrist = `wrist${s}` as JointName,
        x = frame.basis?.[`hand${s}`]?.x,
        fore: P2 = [P[wrist][0] - P[`elbow${s}` as JointName][0], P[wrist][1] - P[`elbow${s}` as JointName][1]],
        fl = Math.hypot(fore[0], fore[1]) || 1;
      let d: P2 = x ? vector(J[wrist], x, 0.1) : [P[`hand${s}` as JointName][0] - P[wrist][0], P[`hand${s}` as JointName][1] - P[wrist][1]];
      const expected = (x ? 0.1 : character.proportions.hand / 2) * S,
        l = Math.hypot(d[0], d[1]);
      // Pointing at the camera: the screen direction is meaningless, lean on the forearm's.
      if (l < 0.5 * expected) d = [d[0] + (fore[0] / fl) * (0.5 * expected - l), d[1] + (fore[1] / fl) * (0.5 * expected - l)];
      return d;
    }
    const side = contexts.side!,
      hands = {} as PoserDebug['hands'],
      handSets = {} as Record<Side, Float32Array>;
    for (const s of ['L', 'R'] as Side[]) {
      const wrist = `wrist${s}` as JointName,
        d = unit(handDirection(s)),
        z = frame.basis?.[`hand${s}`]?.z,
        set = setOf(side, `hand${s}`);
      let palmToCamera = 0;
      if (z) {
        const n = vector(J[wrist], z, 0.1),
          // The open/grip drawings show the palm on the bone's -perp side (palm up, fingers right).
          sideways = -(n[0] * -d[1] + n[1] * d[0]) / (0.1 * S);
        palmToCamera = depth({ x: z.x, y: z.y, z: z.z }) - depth({ x: 0, y: 0, z: 0 });
        if (Math.abs(sideways) > 0.25) handMirror[s] = sideways > 0 ? 1 : -1;
      } else handMirror[s] = Math.cos(angles[`arm${s}`]) < 0 ? -1 : 1;
      // Size the profile sheet's hand to the wrist of the arm drawing it sits on,
      // and shorten it (to a floor) when the fingers point at the camera.
      const armCtx = contexts[state[`arm${s}`]!.kind]!,
        fit = armCtx.isSide || !armCtx.wristWidth || !side.wristWidth ? 1 : clamp((armCtx.wristWidth / armCtx.pxPerM) / (side.wristWidth / side.pxPerM), 0.8, 1.7),
        x = frame.basis?.[`hand${s}`]?.x,
        seen = x ? Math.hypot(...vector(J[wrist], x, 0.1)) / (0.1 * S) : 1,
        handBone = bindOf(side, 'hand_near'),
        reach = handBone.length * side.k * fit * clamp(seen, POSER.handMinAlong, 1);
      along[`hand${s}`] = { scale: seen, clamped: seen < POSER.handMinAlong };
      side.k *= fit;
      setBone(side, set, 'hand_near', P[wrist][0], P[wrist][1], P[wrist][0] + d[0] * reach, P[wrist][1] + d[1] * reach, {
        min: POSER.handMinAlong / 1, max: 1, mirror: handMirror[s], fallback: [0, 1], bind: { ...handBone, length: handBone.length * fit / fit },
      });
      side.k /= fit;
      handSets[s] = set;
      hands[s] = { art: '', mirrored: handMirror[s] < 0, palmToCamera };
    }

    // ---- Draw list.
    const items: Item[] = [];
    let order = 0;
    const push = (key: number, name: string, drawItem: () => void) => items.push({ key, order: order++, name, draw: drawItem });
    const part = (ctx: Ctx, name: string, set: Float32Array, opacity: number, key: number) => {
      if (ctx.layers.has(name)) push(key, `${ctx.kind}:${name}`, () => ctx.layers.drawPart(name, set, opacity));
    };
    const passes = (block: BlockName): [ViewKind, number, boolean][] => {
      const st = state[block]!;
      // Incoming drawing fades in over the first half on top of the opaque outgoing
      // one, which then fades out underneath: never a see-through body.
      return st.t < 1 ? [[st.prevKind, Math.min(1, 2 - 2 * st.t), true], [st.kind, Math.min(1, 2 * st.t), false]] : [[st.kind, 1, false]];
    };
    for (const [kind, opacity] of passes('trunk')) {
      const ctx = contexts[kind]!;
      part(ctx, 'trunk', ctx.sets.base, opacity, 100);
      if (ctx.isSide) part(ctx, 'shorts_far', ctx.sets.base, opacity, 45);
    }
    for (const [kind, opacity, old] of passes('head')) {
      const ctx = contexts[kind]!;
      part(ctx, 'head', old && !ctx.isSide && state.head!.prevKind === state.head!.kind ? ctx.sets.headOld : ctx.sets.head, opacity, 110);
    }
    for (const s of ['L', 'R'] as Side[]) {
      for (const [kind, opacity] of passes(`leg${s}`)) {
        const ctx = contexts[kind]!,
          leg = legData[kind][s];
        for (const name of leg.parts) part(ctx, name, ctx.sets.base, opacity, leg.key);
      }
      const pose: HandPose = frame.hands[s];
      for (const [kind, opacity] of passes(`arm${s}`)) {
        const ctx = contexts[kind]!,
          arm = armData[kind][s];
        arm.parts.forEach((name, i) => part(ctx, name, arm.set, opacity, arm.key + i * 0.01));
        // Baked front hand only when relaxed; otherwise the profile sheet's hand.
        const handKey = arm.key + 0.6;
        if (arm.hand && pose === 'relaxed') {
          part(ctx, arm.hand, arm.set, opacity, handKey);
          hands[s].art = `${kind}:${arm.hand}`;
        } else {
          part(side, `hand_${pose}`, handSets[s], opacity, handKey);
          hands[s].art = `side:hand_${pose}`;
        }
        // Held prop: in front of or behind the fingers by depth.
        for (const prop of frame.props ?? [])
          if (prop.heldBy === s) {
            const inFront = depth(prop.pos) > D[`hand${s}` as JointName] + 0.004;
            push(handKey + (inFront ? 0.3 : -0.3), `prop:${prop.id}`, () => drawBag(prop));
          }
      }
    }
    for (const prop of frame.props ?? [])
      if (!prop.heldBy) push(depth(prop.pos) > (D.chest + D.pelvis) / 2 ? 200 : 10, `prop:${prop.id}`, () => drawBag(prop));

    function drawBag(prop: ViewProp): void {
      const b: Basis = prop.basis ?? (() => {
          const a = prop.angle ?? 0;
          return { x: { x: Math.cos(a), y: 0, z: -Math.sin(a) }, y: { x: 0, y: 1, z: 0 }, z: { x: Math.sin(a), y: 0, z: Math.cos(a) } };
        })(),
        c = screen(prop.pos),
        X = vector(prop.pos, b.x, POSER.bag.half),
        Z = vector(prop.pos, b.z, POSER.bag.half),
        Y = vector(prop.pos, b.y, POSER.bag.thick),
        topSign = depth(b.y) - depth({ x: 0, y: 0, z: 0 }) >= 0 ? 1 : -1,
        ring = (lift: number, grow: number, colour: number[]) => {
          const out = [c[0] + Y[0] * lift, c[1] + Y[1] * lift, ...colour];
          for (let i = 0; i <= 24; i++) {
            const a = (i / 24) * Math.PI * 2,
              // Rounded square (superellipse).
              cx = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.55,
              sz = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.55,
              px = X[0] * cx + Z[0] * sz,
              py = X[1] * cx + Z[1] * sz,
              l = Math.hypot(px, py) || 1;
            out.push(c[0] + Y[0] * lift + px * (1 + grow / l), c[1] + Y[1] * lift + py * (1 + grow / l), ...colour);
          }
          return out;
        },
        line = Math.max(1, S * 0.006),
        ink = [0.09, 0.08, 0.1, 1];
      // The slab between the two faces, then the face toward the camera.
      for (let n = -4; n <= 4; n++) drawFan(gl, ring((topSign * n) / 4, line, ink));
      for (let n = -4; n < 4; n++) drawFan(gl, ring((topSign * n) / 4, 0, [0.1, 0.42, 0.42, 1]));
      drawFan(gl, ring(topSign, 0, [0.16, 0.66, 0.63, 1]));
    }

    // ---- Soft contact shadow under the feet.
    {
      const mid = { x: (J.ankleL.x + J.ankleR.x) / 2, y: 0, z: (J.ankleL.z + J.ankleR.z) / 2 },
        c = screen(mid),
        spread = Math.hypot(P.ankleL[0] - P.ankleR[0], P.ankleL[1] - P.ankleR[1]),
        rx = 0.2 * S + spread * 0.5,
        ry = 0.055 * S,
        fan = [c[0], c[1], 0, 0, 0, 0.3];
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        fan.push(c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, 0, 0, 0, 0);
      }
      drawFan(gl, fan);
    }
    items.sort((a, b) => a.key - b.key || a.order - b.order);
    for (const item of items) item.draw();

    // ---- Debug.
    const blocks = {} as Record<BlockName, BlockDebug>;
    for (const block of BLOCKS) {
      const st = state[block]!,
        name = canonical(angles[block]),
        drawnProfile = st.kind === 'side' || st.kind === 'sideRear';
      blocks[block] = {
        kind: st.kind,
        mirrored: st.mirror < 0,
        angle: angles[block] * DEG,
        canonical: name,
        // Real only when the drawing was made for this angle.
        standIn: !(
          (name === 'side' && drawnProfile) ||
          (name === 'front' && st.kind === 'front' && block !== 'head') ||
          (name === 'threeQuarterFront' && st.kind === 'front' && block === 'head')
        ),
        fading: st.t,
      };
    }
    const t = blocks.trunk;
    debug = {
      blocks,
      feet,
      along,
      order: items.map((item) => item.name),
      nearArm,
      nearLeg,
      hands,
      label: `${t.canonical}${t.standIn ? ` (stand-in: ${t.kind} art)` : ''}`,
    };
  }

  return {
    draw,
    /** Forget the view state (the next draw snaps instead of dissolving). */
    reset(): void {
      for (const block of BLOCKS) delete state[block];
      lastStep = null;
    },
    get debug(): PoserDebug | null {
      return debug;
    },
  };
}

function reachFrom(origin: P2, offset: P2, reach: number): P2 {
  const l = Math.hypot(offset[0], offset[1]),
    f = l > reach ? reach / l : 1;
  return [origin[0] + offset[0] * f, origin[1] + offset[1] * f];
}
/** `a` when t = 1, `b` when t = 0 (directions). */
function blend(a: P2, b: P2, t: number): P2 {
  return unit([a[0] * t + b[0] * (1 - t), a[1] * t + b[1] * (1 - t)]);
}
function unit(v: P2): P2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}
