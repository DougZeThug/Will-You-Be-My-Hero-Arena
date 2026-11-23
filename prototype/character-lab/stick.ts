// Debug viewer for the Character Lab core: draws the Frame as a volumetric
// mannequin (capsules with widths, depth-sorted, left/right tinted) so that
// orientation is readable, not just joint positions: nose and cap brim, chest
// plate, kneecaps, palm side of the hands, feet with heel/toe, and the bean bag
// as a flat two-faced pillow.
//   /stick.html?c=doug&p=rig&cam=35&seq=proof
import {
  CAMERA_PITCH,
  makeCamera,
  project,
  screenToGround,
  yawForViewAngle,
} from './core/camera';
import type { Camera } from './core/camera';
import {
  defaultProportions,
  lankyProportions,
  sanitizeProportions,
} from './core/proportions';
import { SEQUENCES } from './core/sequence';
import type { SequenceInfo, SequenceName } from './core/sequence';
import type { SimFrame, SimOptions } from './core/sim';
import type { MotionStyle } from './core/style';
import { Timeline } from './core/timeline';
import { VIEW_ANGLE } from './core/types';
import type { Basis, Command, Proportions, Vec3, ViewName } from './core/types';
import { danStyle } from './styles/dan';
import { dougStyle } from './styles/doug';

const STYLES: Record<string, MotionStyle> = { doug: dougStyle, dan: danStyle };
const query = new URLSearchParams(location.search);
const canvas = document.getElementById('view') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

let cam: Camera = makeCamera(
  ((Number(query.get('cam')) || 0) * Math.PI) / 180,
  CAMERA_PITCH,
);
let charId = query.get('c') ?? 'doug';
let propsId = query.get('p') ?? 'rig';
let timeline: Timeline;
let view = 0; // step being shown
let live = true;
let paused = false;
let speed = 1;
let acc = 0;
let sequence: SequenceInfo | null = null;
let seqCursor = 0;
let orbiting = false;
let heldMove: { x: number; y: number } | null = null;
let ready = false;
const rigProps: Record<string, Proportions | null> = {};
let centers: { x: number; z: number }[] = [];
const PX = 250; // pixels per metre

async function loadRigProportions(id: string): Promise<Proportions | null> {
  if (id in rigProps) return rigProps[id];
  try {
    const r = await fetch(`./rigs/${id}/proportions.json`);
    rigProps[id] = r.ok ? sanitizeProportions(await r.json()) : null;
  } catch {
    rigProps[id] = null;
  }
  return rigProps[id];
}

function proportionsFor(): Proportions {
  if (propsId === 'lanky') return lankyProportions();
  if (propsId === 'rig' && rigProps[charId])
    return rigProps[charId] as Proportions;
  if (propsId.startsWith('rig:') && rigProps[propsId.slice(4)])
    return rigProps[propsId.slice(4)] as Proportions;
  return defaultProportions();
}

function reset(seq: SequenceInfo | null = null): void {
  const style = STYLES[charId] ?? dougStyle;
  const options: SimOptions = {
    proportions: proportionsFor(),
    style,
    seed: `${style.id}-lab`,
  };
  if (seq) options.start = seq.start;
  else
    options.start = {
      x: 0,
      z: 0,
      yaw: yawForViewAngle(VIEW_ANGLE.side, cam.yaw),
    };
  timeline = new Timeline(options);
  sequence = seq;
  seqCursor = 0;
  view = 0;
  live = true;
  acc = 0;
  centers = [];
}

function advance(): SimFrame {
  if (sequence) {
    while (
      seqCursor < sequence.schedule.length &&
      sequence.schedule[seqCursor].step <= timeline.length
    ) {
      timeline.command(sequence.schedule[seqCursor++].cmd);
    }
  } else if (heldMove) {
    // held keys keep steering relative to the CURRENT camera
    const g = screenToGround(heldMove.x, heldMove.y, cam);
    const last = lastMove;
    if (!last || Math.abs(last.x - g.x) + Math.abs(last.z - g.z) > 1e-3)
      send({ type: 'move', x: g.x, z: g.z });
  }
  const f = timeline.step();
  const r = f.debug.root;
  const prev = centers.length
    ? centers[centers.length - 1]
    : { x: r.x, z: r.z };
  centers.push({
    x: prev.x + (r.x - prev.x) * 0.045,
    z: prev.z + (r.z - prev.z) * 0.045,
  });
  return f;
}

let lastMove: { x: number; z: number } | null = null;
function send(cmd: Command): void {
  if (!live) {
    // commands always act at the live head: jump back to it first
    live = true;
  }
  lastMove =
    cmd.type === 'move'
      ? { x: cmd.x, z: cmd.z }
      : cmd.type === 'stop'
        ? null
        : lastMove;
  timeline.command(cmd);
}

// ---------------------------------------------------------------- drawing

interface Item {
  depth: number;
  draw: () => void;
}

const COL = {
  L: { fill: '#3f7fbf', dark: '#2c5f93' }, // anatomical left: blue
  R: { fill: '#d9603b', dark: '#a8431f' }, // anatomical right: orange
  mid: { fill: '#8a8f99', dark: '#646973' },
};

function drawFrame(f: SimFrame): void {
  const w = canvas.width;
  const h = canvas.height;
  const ci = Math.min(centers.length - 1, Math.max(0, f.step));
  const centre = centers.length
    ? centers[ci]
    : { x: f.debug.root.x, z: f.debug.root.z };
  const c0 = project({ x: centre.x, y: 0.85, z: centre.z }, cam);
  const P = (p: Vec3) => {
    const q = project(p, cam);
    return {
      x: w / 2 + (q.x - c0.x) * PX,
      y: h * 0.47 - (q.y - c0.y) * PX,
      d: q.depth,
    };
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f1ead9';
  ctx.fillRect(0, 0, w, h);

  // ground grid (world-fixed, 0.5 m)
  ctx.lineWidth = 1;
  const gx = Math.round(centre.x * 2) / 2;
  const gz = Math.round(centre.z * 2) / 2;
  for (let i = -8; i <= 8; i++) {
    const major = Math.abs((gx + i * 0.5) % 1) < 1e-6;
    ctx.strokeStyle = major ? '#cdbf9f' : '#e0d6bd';
    let a = P({ x: gx + i * 0.5, y: 0, z: gz - 4 });
    let b = P({ x: gx + i * 0.5, y: 0, z: gz + 4 });
    line(a, b);
    const majorZ = Math.abs((gz + i * 0.5) % 1) < 1e-6;
    ctx.strokeStyle = majorZ ? '#cdbf9f' : '#e0d6bd';
    a = P({ x: gx - 4, y: 0, z: gz + i * 0.5 });
    b = P({ x: gx + 4, y: 0, z: gz + i * 0.5 });
    line(a, b);
  }
  // world axes at the origin
  ctx.strokeStyle = '#c0504d';
  line(P({ x: 0, y: 0, z: 0 }), P({ x: 0.3, y: 0, z: 0 }));
  ctx.strokeStyle = '#4f81bd';
  line(P({ x: 0, y: 0, z: 0 }), P({ x: 0, y: 0, z: 0.3 }));

  const J = f.joints;
  const B = f.basis;
  const prop = timeline.options.proportions;

  // contact shadow under the pelvis and planted-foot markers (world-fixed sole outlines)
  ellipseGround(
    P,
    { x: J.pelvis.x, y: 0, z: J.pelvis.z },
    0.26,
    0.17,
    'rgba(60,50,30,0.16)',
  );
  for (const side of ['L', 'R'] as const) {
    const fd = f.debug.feet[side];
    if (!fd.planted) continue;
    const fx = Math.cos(fd.yaw);
    const fz = -Math.sin(fd.yaw);
    const rx = Math.sin(fd.yaw);
    const rz = Math.cos(fd.yaw);
    const L = prop.footLen;
    const pts = [
      [-0.25 * L, -0.045],
      [0.75 * L, -0.05],
      [0.75 * L, 0.05],
      [-0.25 * L, 0.045],
    ].map(([u, v]) =>
      P({ x: fd.x + fx * u + rx * v, y: 0, z: fd.z + fz * u + rz * v }),
    );
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = side === 'L' ? '#2c5f93' : '#a8431f';
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = P({ x: fd.x, y: 0, z: fd.z });
    ctx.beginPath();
    ctx.moveTo(a.x - 4, a.y);
    ctx.lineTo(a.x + 4, a.y);
    ctx.moveTo(a.x, a.y - 3);
    ctx.lineTo(a.x, a.y + 3);
    ctx.stroke();
  }

  const items: Item[] = [];
  const capsule = (
    a: Vec3,
    b: Vec3,
    ra: number,
    rb: number,
    col: { fill: string; dark: string },
    bias = 0,
  ) => {
    const pa = P(a);
    const pb = P(b);
    items.push({
      depth: (pa.d + pb.d) / 2 + bias,
      draw: () => {
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l;
        const ny = dx / l;
        const wa = ra * PX;
        const wb = rb * PX;
        ctx.beginPath();
        ctx.moveTo(pa.x + nx * wa, pa.y + ny * wa);
        ctx.lineTo(pb.x + nx * wb, pb.y + ny * wb);
        ctx.arc(pb.x, pb.y, wb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
        ctx.lineTo(pa.x - nx * wa, pa.y - ny * wa);
        ctx.arc(pa.x, pa.y, wa, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
        ctx.closePath();
        ctx.fillStyle = col.fill;
        ctx.fill();
        ctx.strokeStyle = col.dark;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      },
    });
  };
  const blob = (p: Vec3, r: number, fill: string, stroke: string, bias = 0) => {
    const q = P(p);
    items.push({
      depth: q.d + bias,
      draw: () => {
        ctx.beginPath();
        ctx.arc(q.x, q.y, r * PX, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      },
    });
  };
  const poly = (pts: Vec3[], fill: string, stroke: string, bias = 0) => {
    const q = pts.map(P);
    items.push({
      depth: q.reduce((s, p) => s + p.d, 0) / q.length + bias,
      draw: () => {
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      },
    });
  };
  const along = (o: Vec3, b: Basis, x: number, y: number, z: number): Vec3 => ({
    x: o.x + b.x.x * x + b.y.x * y + b.z.x * z,
    y: o.y + b.x.y * x + b.y.y * y + b.z.y * z,
    z: o.z + b.x.z * x + b.y.z * y + b.z.z * z,
  });
  const toward = { x: Math.sin(cam.yaw), y: 0, z: Math.cos(cam.yaw) };
  const facesCam = (n: Vec3) => n.x * toward.x + n.y * 0.14 + n.z * toward.z;

  // trunk: pelvis block, belly, chest slab with a front plate
  const sw = prop.shoulderWidth;
  const hw = prop.hipWidth;
  capsule(
    along(J.pelvis, B.pelvis, -0.02, -hw * 0.42, 0),
    along(J.pelvis, B.pelvis, -0.02, hw * 0.42, 0),
    0.105,
    0.105,
    COL.mid,
  );
  capsule(J.pelvis, J.spine, 0.115, 0.12, COL.mid);
  capsule(J.spine, J.chest, 0.125, 0.11, COL.mid, 0.001);
  capsule(
    along(J.chest, B.chest, -0.05, -sw * 0.36, 0),
    along(J.chest, B.chest, -0.05, sw * 0.36, 0),
    0.095,
    0.095,
    COL.mid,
    0.002,
  );
  {
    // chest plate: only meaningful from the front, so it tells front from back
    const n = B.chest.z;
    const o = along(J.chest, B.chest, -0.1, 0, 0.1);
    const s = facesCam(n);
    poly(
      [
        along(o, B.chest, 0.07, -0.09, 0),
        along(o, B.chest, 0.07, 0.09, 0),
        along(o, B.chest, -0.09, 0.07, 0),
        along(o, B.chest, -0.09, -0.07, 0),
      ],
      s > 0 ? '#f3d27a' : '#5b5f69',
      '#6b6250',
      s > 0 ? 0.2 : -0.2,
    );
    const bo = along(J.pelvis, B.pelvis, 0.0, 0, 0.1);
    poly(
      [
        along(bo, B.pelvis, 0.03, -0.05, 0),
        along(bo, B.pelvis, 0.03, 0.05, 0),
        along(bo, B.pelvis, -0.03, 0.05, 0),
        along(bo, B.pelvis, -0.03, -0.05, 0),
      ],
      facesCam(B.pelvis.z) > 0 ? '#e8b04a' : '#4d5059',
      '#6b6250',
      facesCam(B.pelvis.z) > 0 ? 0.2 : -0.2,
    );
  }
  capsule(J.chest, J.head, 0.05, 0.05, COL.mid);
  // head: skull, face disc with nose, cap brim
  {
    const hb = B.head;
    const c = along(J.head, hb, prop.headLen * 0.52, 0, 0.01);
    const r = prop.headLen * 0.5;
    blob(c, r, '#e9c9a4', '#8d6f4f');
    const s = facesCam(hb.z);
    blob(
      along(c, hb, -0.01, 0, r * 0.98),
      r * 0.2,
      '#d98f6a',
      '#8d5a3a',
      s > 0 ? 0.3 : -0.3,
    ); // nose
    const brim = [
      along(c, hb, r * 0.42, -r * 0.6, r * 0.75),
      along(c, hb, r * 0.42, r * 0.6, r * 0.75),
      along(c, hb, r * 0.36, r * 0.42, r * 1.55),
      along(c, hb, r * 0.36, -r * 0.42, r * 1.55),
    ];
    poly(brim, '#3d7a4c', '#27522f', s > 0 ? 0.3 : -0.3);
    capsule(
      along(c, hb, r * 0.5, 0, -0.01),
      along(c, hb, r * 0.92, 0, -0.02),
      r * 0.86,
      r * 0.5,
      { fill: '#4c9a5f', dark: '#27522f' },
      0.05,
    );
    // eyes
    blob(
      along(c, hb, r * 0.12, -r * 0.36, r * 0.9),
      r * 0.09,
      '#222',
      '#222',
      s > 0 ? 0.31 : -0.31,
    );
    blob(
      along(c, hb, r * 0.12, r * 0.36, r * 0.9),
      r * 0.09,
      '#222',
      '#222',
      s > 0 ? 0.31 : -0.31,
    );
  }
  for (const side of ['L', 'R'] as const) {
    const col = COL[side];
    // leg
    capsule(J[`hip${side}`], J[`knee${side}`], 0.085, 0.062, col);
    capsule(J[`knee${side}`], J[`ankle${side}`], 0.058, 0.04, col);
    const tb = B[`thigh${side}`];
    const kn = along(J[`knee${side}`], tb, -0.01, 0, 0.055);
    blob(kn, 0.032, '#fff4d6', col.dark, facesCam(tb.z) > 0 ? 0.08 : -0.08); // kneecap
    // foot: a wedge box, heel dark, toe light
    const fb = B[`foot${side}`];
    const heel = J[`heel${side}`];
    const toe = J[`toe${side}`];
    const L = prop.footLen;
    const ball = along(heel, fb, L * 0.7, 0, 0);
    const an = J[`ankle${side}`];
    const wv = 0.045;
    const sole = [
      along(heel, fb, 0, -wv, 0),
      along(heel, fb, 0, wv, 0),
      along(ball, fb, 0, wv * 1.15, 0),
      along(ball, fb, 0, -wv * 1.15, 0),
    ];
    poly(sole, col.dark, '#333', -0.02);
    poly(
      [
        along(heel, fb, 0, -wv, 0),
        along(heel, fb, 0, wv, 0),
        along(an, fb, -0.02, wv * 0.8, 0),
        along(an, fb, -0.02, -wv * 0.8, 0),
      ],
      '#3a3a3a',
      '#222',
    );
    poly(
      [
        along(an, fb, -0.02, -wv * 0.8, 0),
        along(an, fb, -0.02, wv * 0.8, 0),
        along(ball, fb, 0, wv * 1.15, 0.03),
        along(ball, fb, 0, -wv * 1.15, 0.03),
      ],
      col.fill,
      col.dark,
      0.01,
    );
    const tdir = norm3({
      x: toe.x - ball.x,
      y: toe.y - ball.y,
      z: toe.z - ball.z,
    });
    const tp = (v: number, up: number): Vec3 => ({
      x: ball.x + fb.y.x * v,
      y: ball.y + up,
      z: ball.z + fb.y.z * v,
    });
    const tt = (v: number): Vec3 => ({
      x: toe.x + fb.y.x * v - tdir.x * 0.01,
      y: toe.y + 0.012,
      z: toe.z + fb.y.z * v - tdir.z * 0.01,
    });
    poly(
      [tp(-wv * 1.15, 0.03), tp(wv * 1.15, 0.03), tt(wv * 0.9), tt(-wv * 0.9)],
      '#f7f1e3',
      col.dark,
      0.012,
    );
    // arm
    capsule(J[`shoulder${side}`], J[`elbow${side}`], 0.056, 0.045, col);
    capsule(J[`elbow${side}`], J[`wrist${side}`], 0.044, 0.032, col);
    blob(J[`shoulder${side}`], 0.062, col.fill, col.dark, 0.003);
    // hand: a flat paddle in the hand basis; palm side light, back of hand dark
    const hbs = B[`hand${side}`];
    const wr = J[`wrist${side}`];
    const hl = prop.hand;
    const pose = f.hands[side];
    const spread = pose === 'open' ? 0.05 : pose === 'grip' ? 0.03 : 0.038;
    const lenK = pose === 'grip' ? 0.62 : 1;
    const palmSeen = facesCam(hbs.z) > 0;
    const paddle = [
      along(wr, hbs, 0, -0.026, 0),
      along(wr, hbs, 0, 0.026, 0),
      along(wr, hbs, hl * lenK, spread, 0),
      along(wr, hbs, hl * lenK, -spread, 0),
    ];
    poly(paddle, palmSeen ? '#ffe9c9' : col.dark, '#5d4630', 0.004);
    // palm normal tick, so the facing reads even edge-on
    const pc = J[`hand${side}`];
    capsule(
      pc,
      along(pc, hbs, 0, 0, pose === 'grip' ? 0.035 : 0.03),
      0.012,
      0.008,
      { fill: '#ffe9c9', dark: '#5d4630' },
      palmSeen ? 0.02 : -0.02,
    );
    if (pose === 'grip') {
      // curled fingers
      capsule(
        along(wr, hbs, hl * 0.62, -0.03, 0),
        along(wr, hbs, hl * 0.62, 0.03, 0.035),
        0.016,
        0.016,
        { fill: '#e9c9a4', dark: '#5d4630' },
        palmSeen ? 0.03 : -0.03,
      );
    }
  }
  // stand + bag
  for (const p of f.props) {
    if (p.id === 'stand') {
      capsule(
        { x: p.pos.x, y: 0, z: p.pos.z },
        { x: p.pos.x, y: p.pos.y - 0.02, z: p.pos.z },
        0.03,
        0.03,
        { fill: '#b9a680', dark: '#7d6d4c' },
      );
      const s = 0.13;
      poly(
        [
          { x: p.pos.x - s, y: p.pos.y, z: p.pos.z - s },
          { x: p.pos.x + s, y: p.pos.y, z: p.pos.z - s },
          { x: p.pos.x + s, y: p.pos.y, z: p.pos.z + s },
          { x: p.pos.x - s, y: p.pos.y, z: p.pos.z + s },
        ],
        '#d6c59b',
        '#7d6d4c',
        -0.03,
      );
      ellipseGround(
        P,
        { x: p.pos.x, y: 0, z: p.pos.z },
        0.14,
        0.14,
        'rgba(60,50,30,0.14)',
      );
    } else {
      // bean bag: a flat pillow, top face red with a stripe, bottom face navy
      const b = p.basis;
      const s = 0.075;
      const t = 0.022;
      const up = facesCam(b.y) > 0;
      const face = (k: number) => [
        along(p.pos, b, -s, k * t, -s),
        along(p.pos, b, s, k * t, -s),
        along(p.pos, b, s, k * t, s),
        along(p.pos, b, -s, k * t, s),
      ];
      poly(
        face(up ? -1 : 1),
        up ? '#27406b' : '#c0392b',
        '#1c1c1c',
        p.heldBy ? 0.035 : 0,
      );
      poly(
        face(up ? 1 : -1),
        up ? '#c0392b' : '#27406b',
        '#1c1c1c',
        p.heldBy ? 0.04 : 0.001,
      );
      if (up)
        poly(
          [
            along(p.pos, b, -s * 0.25, t, -s),
            along(p.pos, b, s * 0.25, t, -s),
            along(p.pos, b, s * 0.25, t, s),
            along(p.pos, b, -s * 0.25, t, s),
          ],
          '#f5e6c8',
          '#1c1c1c',
          p.heldBy ? 0.041 : 0.002,
        );
      if (!p.heldBy)
        ellipseGround(
          P,
          {
            x: p.pos.x,
            y:
              p.pos.y > 0.4 &&
              Math.hypot(p.pos.x - f.debug.stand.x, p.pos.z - f.debug.stand.z) <
                0.14
                ? f.debug.stand.y
                : 0,
            z: p.pos.z,
          },
          0.07,
          0.07,
          'rgba(40,30,20,0.25)',
        );
    }
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();

  // HUD
  ctx.fillStyle = '#3b3423';
  ctx.font = '13px ui-monospace, monospace';
  const beat = sequence
    ? (sequence.beats.find((b) => f.step >= b.from && f.step < b.to)?.name ??
      '')
    : '';
  ctx.fillText(
    `step ${f.step}   ${f.phase}   cam ${Math.round((cam.yaw * 180) / Math.PI)} deg   ${charId}/${propsId}${live ? '' : '   [scrub]'}`,
    12,
    20,
  );
  if (beat) ctx.fillText(beat, 12, 38);
  ctx.fillText(
    `L ${f.contacts.footL ? 'planted' : 'swing  '}  R ${f.contacts.footR ? 'planted' : 'swing  '}  hands ${f.hands.L}/${f.hands.R}  squash ${f.squash.toFixed(3)}`,
    12,
    h - 12,
  );
}

function norm3(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function line(a: { x: number; y: number }, b: { x: number; y: number }): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function ellipseGround(
  P: (p: Vec3) => { x: number; y: number },
  c: Vec3,
  rx: number,
  rz: number,
  fill: string,
): void {
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const p = P({
      x: c.x + Math.cos(a) * rx,
      y: c.y,
      z: c.z + Math.sin(a) * rz,
    });
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------- UI

function shown(): SimFrame {
  return live ? timeline.last : timeline.at(view);
}

function redraw(): void {
  const f = shown();
  if (sequence?.camYawAt && orbitFromSequence)
    setCam(sequence.camYawAt(f.step), false);
  drawFrame(f);
  const scrub = $<HTMLInputElement>('scrub');
  scrub.max = String(Math.max(0, timeline.length - 1));
  scrub.value = String(live ? timeline.length - 1 : view);
  $('hud').textContent =
    `frames ${timeline.length}   commands ${timeline.commands.length}\n` +
    timeline.commands
      .slice(-8)
      .map((c) => `${String(c.step).padStart(5)}  ${JSON.stringify(c.cmd)}`)
      .join('\n');
}

let orbitFromSequence = true;
function setCam(yaw: number, fromUser = true): void {
  cam = makeCamera(yaw, CAMERA_PITCH);
  const deg = Math.round((((yaw * 180) / Math.PI + 540) % 360) - 180);
  $<HTMLInputElement>('cam').value = String(deg);
  $('camLabel').textContent = `yaw ${deg}`;
  if (fromUser) orbitFromSequence = false;
}

function tick(): void {
  if (!paused) {
    acc += speed;
    while (acc >= 1) {
      acc -= 1;
      if (orbiting) setCam(cam.yaw + (Math.PI * 2) / 600);
      if (live) {
        if (!sequence || timeline.length < sequence.length) advance();
        else sequence = null;
      } else {
        view++;
        if (view >= timeline.length - 1) live = true;
      }
    }
  }
  redraw();
  requestAnimationFrame(tick);
}

function command(name: string): void {
  const f = timeline.last;
  switch (name) {
    case 'stop':
      send({ type: 'stop' });
      break;
    case 'reach':
      send({ type: 'reach' });
      break;
    case 'grip':
      send({ type: 'grip' });
      break;
    case 'reachGrip':
      send(
        f.phase.startsWith('reach:ready')
          ? { type: 'grip' }
          : { type: 'reach' },
      );
      break;
    case 'place':
      send({ type: 'place' });
      break;
    case 'toss':
      send({ type: 'toss', power: 0.65 });
      break;
    case 'tossTurn':
      send({ type: 'toss', power: 0.6, yaw: f.yaw.pelvis + Math.PI / 2 });
      break;
    case 'hitL':
      send({ type: 'hit', dirYaw: f.yaw.pelvis, strength: 'light' });
      break;
    case 'hitH':
      send({ type: 'hit', dirYaw: f.yaw.pelvis + Math.PI, strength: 'heavy' });
      break;
    case 'prop': {
      const g = screenToGround(0.25, -0.75, cam);
      send({ type: 'placeProp', x: g.x, z: g.z, relative: true });
      break;
    }
  }
}

function bind(): void {
  const charSel = $<HTMLSelectElement>('char');
  for (const id of Object.keys(STYLES))
    charSel.add(new Option(STYLES[id].label, id));
  charSel.value = charId;
  charSel.onchange = () => {
    charId = charSel.value;
    reset();
  };
  const propSel = $<HTMLSelectElement>('props');
  for (const [id, label] of [
    ['rig', "own rig's proportions"],
    ['rig:doug', "Doug's rig"],
    ['rig:dan', "Dan's rig"],
    ['default', 'default 1.73 m adult'],
    ['lanky', 'lanky (long legs)'],
  ])
    propSel.add(new Option(label, id));
  propSel.value = propsId;
  propSel.onchange = () => {
    propsId = propSel.value;
    reset();
  };
  $('reset').onclick = () => reset();
  const camIn = $<HTMLInputElement>('cam');
  camIn.oninput = () => setCam((Number(camIn.value) * Math.PI) / 180);
  document
    .querySelectorAll<HTMLButtonElement>('[data-cam]')
    .forEach(
      (b) =>
        (b.onclick = () => setCam((Number(b.dataset.cam) * Math.PI) / 180)),
    );
  $('orbit').onclick = () => {
    orbiting = !orbiting;
    $('orbit').classList.toggle('on', orbiting);
  };
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(
    (b) =>
      (b.onclick = () => {
        const [x, y] = (b.dataset.move as string).split(',').map(Number);
        const g = screenToGround(x, -y, cam);
        send({ type: 'move', x: g.x, z: g.z });
      }),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach(
    (b) =>
      (b.onclick = () =>
        send({
          type: 'turnTo',
          view: b.dataset.turn as ViewName,
          camYaw: cam.yaw,
        })),
  );
  document
    .querySelectorAll<HTMLButtonElement>('[data-rot]')
    .forEach((b) => (b.onclick = () => rotateBy(Number(b.dataset.rot))));
  document
    .querySelectorAll<HTMLButtonElement>('[data-cmd]')
    .forEach((b) => (b.onclick = () => command(b.dataset.cmd as string)));
  $('pause').onclick = () => {
    paused = !paused;
    $('pause').classList.toggle('on', paused);
  };
  $('back1').onclick = () => stepView(-1);
  $('fwd1').onclick = () => stepView(1);
  $('live').onclick = () => {
    live = true;
  };
  const sp = $<HTMLInputElement>('speed');
  sp.oninput = () => {
    speed = Number(sp.value);
    $('speedLabel').textContent = `speed ${speed.toFixed(2)}x`;
  };
  const scrub = $<HTMLInputElement>('scrub');
  scrub.oninput = () => {
    live = false;
    paused = true;
    $('pause').classList.add('on');
    view = Number(scrub.value);
  };
  const seqSel = $<HTMLSelectElement>('seq');
  for (const id of Object.keys(SEQUENCES)) seqSel.add(new Option(id, id));
  seqSel.value = query.get('seq') ?? 'proof';
  $('runSeq').onclick = () => runSequence(seqSel.value as SequenceName);

  const keys = new Set<string>();
  const updateMove = () => {
    const x = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    const y = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
    if (x || y) {
      heldMove = { x, y };
    } else if (heldMove) {
      heldMove = null;
      send({ type: 'stop' });
    }
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || (e.target as HTMLElement).tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if ('wasd'.includes(k) && k.length === 1) {
      keys.add(k);
      sequence = null;
      updateMove();
      return;
    }
    if (k === 'q') rotateBy(-1);
    else if (k === 'e') rotateBy(1);
    else if (k === 'r') command('reachGrip');
    else if (k === 'f') command('place');
    else if (k === 't') command('toss');
    else if (k === 'g') command('tossTurn');
    else if (k === 'h') command('hitL');
    else if (k === 'j') command('hitH');
    else if (k === 'p') command('prop');
    else if (k === ' ') {
      command('stop');
      e.preventDefault();
    } else if (k === '.') stepView(1);
    else if (k === ',') stepView(-1);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys.delete(k)) updateMove();
  });
}

/** Q/E: turn 45 degrees on screen (E = clockwise seen from above = toward the viewer's right). */
function rotateBy(dir: number): void {
  const yaw = timeline.last.yaw.pelvis;
  const snapped =
    Math.round((yaw - dir * (Math.PI / 4)) / (Math.PI / 4)) * (Math.PI / 4);
  send({ type: 'face', yaw: snapped });
}

function stepView(d: number): void {
  paused = true;
  $('pause').classList.add('on');
  if (live && d > 0) {
    if (!sequence || timeline.length < sequence.length) advance();
    return;
  }
  if (live) {
    live = false;
    view = timeline.length - 1;
  }
  view = Math.max(0, Math.min(timeline.length - 1, view + d));
}

function runSequence(name: SequenceName): void {
  const make = SEQUENCES[name] ?? SEQUENCES.proof;
  const info = make(cam.yaw);
  orbitFromSequence = true;
  reset(info);
  paused = false;
  $('pause').classList.remove('on');
}

// Scripted capture surface.
declare global {
  interface Window {
    __LAB__?: unknown;
  }
}

async function main(): Promise<void> {
  await Promise.all(Object.keys(STYLES).map(loadRigProportions));
  bind();
  setCam(cam.yaw, false);
  reset();
  if (query.get('seq') && query.get('autorun') !== '0')
    runSequence(query.get('seq') as SequenceName);
  const scripted = query.get('scripted') === '1';
  if (scripted) paused = true;
  window.__LAB__ = {
    get ready() {
      return ready;
    },
    /** Simulate n steps at the live head (sequence commands apply on schedule); returns the frame shown. */
    step(n = 1) {
      live = true;
      for (let i = 0; i < n; i++) advance();
      redraw();
      return timeline.last;
    },
    command(cmd: Command) {
      send(cmd);
    },
    setCamYaw(rad: number) {
      setCam(rad);
      redraw();
    },
    frame() {
      return shown();
    },
    seek(step: number) {
      live = false;
      paused = true;
      view = Math.max(0, Math.min(timeline.length - 1, Math.round(step)));
      redraw();
      return shown();
    },
    /** Loads a sequence staged for a camera yaw (default: the current one) without playing it. */
    load(
      name: SequenceName,
      camYaw?: number,
      character?: string,
      proportions?: string,
    ) {
      if (character) charId = character;
      if (proportions) propsId = proportions;
      if (camYaw !== undefined) setCam(camYaw, false);
      const info = (SEQUENCES[name] ?? SEQUENCES.proof)(cam.yaw);
      orbitFromSequence = true;
      reset(info);
      paused = true;
      redraw();
      return {
        length: info.length,
        beats: info.beats,
        schedule: info.schedule,
      };
    },
    length() {
      return timeline.length;
    },
    png() {
      return canvas.toDataURL('image/png');
    },
    jpeg(q = 0.9) {
      return canvas.toDataURL('image/jpeg', q);
    },
    timeline: () => timeline,
  };
  ready = true;
  requestAnimationFrame(tick);
}

void main();
