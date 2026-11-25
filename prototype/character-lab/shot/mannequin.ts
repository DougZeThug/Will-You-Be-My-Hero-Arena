// Volumetric debug mannequin for the shot (the drawing approach of ../stick.ts, without the
// simulation's debug data): capsule limbs with widths, anatomical left blue / right orange,
// chest and belt plates that tell front from back, kneecaps, feet with dark heel and light
// toe, palm side of the hand light, a head with nose, eyes and cap brim. Root-level squash
// only. World-fixed ground grid and planted-foot markers.
import { project } from '../core/camera';
import type { Camera } from '../core/camera';
import type { Basis, Frame, Proportions, Vec3 } from '../core/types';

export interface MannequinView {
  cam: Camera;
  /** world point drawn at (cx, cy) */
  centre: Vec3;
  cx: number;
  cy: number;
  /** pixels per metre */
  px: number;
  /** clip/clear rectangle */
  x0: number;
  y0: number;
  w: number;
  h: number;
  grid?: boolean;
  label?: string;
  /** earlier frames whose hand and head paths are drawn as trails */
  trail?: Frame[];
}

const COL = {
  L: { fill: '#3f7fbf', dark: '#2c5f93' },
  R: { fill: '#d9603b', dark: '#a8431f' },
  mid: { fill: '#8a8f99', dark: '#646973' },
};

interface Item {
  depth: number;
  draw: () => void;
}

export function drawMannequin(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  prop: Proportions,
  view: MannequinView,
): void {
  const { cam, px: PX } = view;
  const c0 = project(view.centre, cam);
  const ground = (p: Vec3) => {
    const q = project(p, cam);
    return {
      x: view.cx + (q.x - c0.x) * PX,
      y: view.cy - (q.y - c0.y) * PX,
      d: q.depth,
    };
  };
  // root-level squash about the point on the ground under the pelvis
  const root = { x: f.joints.pelvis.x, y: 0, z: f.joints.pelvis.z };
  const sy = f.squash;
  const sx = 1 / Math.sqrt(sy);
  const P = (p: Vec3) =>
    ground({
      x: root.x + (p.x - root.x) * sx,
      y: p.y * sy,
      z: root.z + (p.z - root.z) * sx,
    });
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x0, view.y0, view.w, view.h);
  ctx.clip();
  ctx.fillStyle = '#f1ead9';
  ctx.fillRect(view.x0, view.y0, view.w, view.h);
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  if (view.grid !== false) {
    ctx.lineWidth = 1;
    const gx = Math.round(view.centre.x * 2) / 2;
    const gz = Math.round(view.centre.z * 2) / 2;
    for (let i = -10; i <= 10; i++) {
      ctx.strokeStyle =
        Math.abs((gx + i * 0.5) % 1) < 1e-6 ? '#cdbf9f' : '#e0d6bd';
      line(
        ground({ x: gx + i * 0.5, y: 0, z: gz - 5 }),
        ground({ x: gx + i * 0.5, y: 0, z: gz + 5 }),
      );
      ctx.strokeStyle =
        Math.abs((gz + i * 0.5) % 1) < 1e-6 ? '#cdbf9f' : '#e0d6bd';
      line(
        ground({ x: gx - 5, y: 0, z: gz + i * 0.5 }),
        ground({ x: gx + 5, y: 0, z: gz + i * 0.5 }),
      );
    }
  }
  const J = f.joints;
  const B = f.basis;

  // shadow, and planted-foot markers fixed in the world (unsquashed)
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const p = ground({
      x: root.x + Math.cos(a) * 0.26,
      y: 0,
      z: root.z + Math.sin(a) * 0.17,
    });
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.fillStyle = 'rgba(60,50,30,0.16)';
  ctx.fill();
  for (const side of ['L', 'R'] as const) {
    if (!f.contacts[side === 'L' ? 'footL' : 'footR']) continue;
    const heel = J[`heel${side}`];
    const toe = J[`toe${side}`];
    const fb = B[`foot${side}`];
    // the flat sole outline through whichever of heel / toe is on the ground
    const dx = toe.x - heel.x;
    const dz = toe.z - heel.z;
    const l = Math.hypot(dx, dz) || 1;
    const ux = dx / l;
    const uz = dz / l;
    const L = prop.footLen;
    const anchor = heel.y <= toe.y ? heel : { x: toe.x - ux * L, z: toe.z - uz * L };
    const pts = [
      [0, -0.05],
      [L, -0.055],
      [L, 0.055],
      [0, 0.05],
    ].map(([u, v]) =>
      ground({
        x: anchor.x + ux * u + fb.y.x * v,
        y: 0,
        z: anchor.z + uz * u + fb.y.z * v,
      }),
    );
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = side === 'L' ? '#2c5f93' : '#a8431f';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (view.trail && view.trail.length > 1) {
    for (const [name, colour] of [
      ['handR', 'rgba(217,96,59,0.55)'],
      ['handL', 'rgba(63,127,191,0.55)'],
      ['headTop', 'rgba(60,120,70,0.5)'],
      ['pelvis', 'rgba(90,90,90,0.45)'],
    ] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      view.trail.forEach((g, i) => {
        const p = ground(g.joints[name]);
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      const p = ground(f.joints[name]);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = colour;
      for (const g of view.trail) {
        const q = ground(g.joints[name]);
        ctx.fillRect(q.x - 1.2, q.y - 1.2, 2.4, 2.4);
      }
    }
  }

  const items: Item[] = [];
  const lw = Math.max(0.8, Math.min(1.5, PX / 170));
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
        const nx = l > 1e-6 ? -dy / l : 0;
        const ny = l > 1e-6 ? dx / l : 1;
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
        ctx.lineWidth = lw;
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
        ctx.lineWidth = lw;
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
        ctx.lineWidth = lw;
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

  // trunk
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
    const o = along(J.chest, B.chest, -0.1, 0, 0.1);
    const s = facesCam(B.chest.z);
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
    // a spine stripe on the back, so the back view is positively a back
    const bk = along(J.chest, B.chest, -0.1, 0, -0.1);
    poly(
      [
        along(bk, B.chest, 0.08, -0.015, 0),
        along(bk, B.chest, 0.08, 0.015, 0),
        along(bk, B.chest, -0.12, 0.015, 0),
        along(bk, B.chest, -0.12, -0.015, 0),
      ],
      s < 0 ? '#3b3f48' : '#5b5f69',
      '#33363d',
      s < 0 ? 0.2 : -0.2,
    );
    const bo = along(J.pelvis, B.pelvis, 0.0, 0, 0.1);
    const ps = facesCam(B.pelvis.z);
    poly(
      [
        along(bo, B.pelvis, 0.03, -0.05, 0),
        along(bo, B.pelvis, 0.03, 0.05, 0),
        along(bo, B.pelvis, -0.03, 0.05, 0),
        along(bo, B.pelvis, -0.03, -0.05, 0),
      ],
      ps > 0 ? '#e8b04a' : '#4d5059',
      '#6b6250',
      ps > 0 ? 0.2 : -0.2,
    );
  }
  capsule(J.chest, J.head, 0.05, 0.05, COL.mid);
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
    );
    poly(
      [
        along(c, hb, r * 0.42, -r * 0.6, r * 0.75),
        along(c, hb, r * 0.42, r * 0.6, r * 0.75),
        along(c, hb, r * 0.36, r * 0.42, r * 1.55),
        along(c, hb, r * 0.36, -r * 0.42, r * 1.55),
      ],
      '#3d7a4c',
      '#27522f',
      s > 0 ? 0.3 : -0.3,
    );
    capsule(
      along(c, hb, r * 0.5, 0, -0.01),
      along(c, hb, r * 0.92, 0, -0.02),
      r * 0.86,
      r * 0.5,
      { fill: '#4c9a5f', dark: '#27522f' },
      0.05,
    );
    for (const e of [-1, 1])
      blob(
        along(c, hb, r * 0.12, e * r * 0.36, r * 0.9),
        r * 0.09,
        '#222',
        '#222',
        s > 0 ? 0.31 : -0.31,
      );
  }
  for (const side of ['L', 'R'] as const) {
    const col = COL[side];
    capsule(J[`hip${side}`], J[`knee${side}`], 0.085, 0.062, col);
    capsule(J[`knee${side}`], J[`ankle${side}`], 0.058, 0.04, col);
    const tb = B[`thigh${side}`];
    blob(
      along(J[`knee${side}`], tb, -0.01, 0, 0.055),
      0.032,
      '#fff4d6',
      col.dark,
      facesCam(tb.z) > 0 ? 0.08 : -0.08,
    );
    const fb = B[`foot${side}`];
    const heel = J[`heel${side}`];
    const toe = J[`toe${side}`];
    const L = prop.footLen;
    const ball = along(heel, fb, L * 0.7, 0, 0);
    const an = J[`ankle${side}`];
    const wv = 0.045;
    poly(
      [
        along(heel, fb, 0, -wv, 0),
        along(heel, fb, 0, wv, 0),
        along(ball, fb, 0, wv * 1.15, 0),
        along(ball, fb, 0, -wv * 1.15, 0),
      ],
      col.dark,
      '#333',
      -0.02,
    );
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
    const td = { x: toe.x - ball.x, y: toe.y - ball.y, z: toe.z - ball.z };
    const tl = Math.hypot(td.x, td.y, td.z) || 1;
    const tp = (v: number, up: number): Vec3 => ({
      x: ball.x + fb.y.x * v + fb.z.x * up,
      y: ball.y + fb.y.y * v + fb.z.y * up,
      z: ball.z + fb.y.z * v + fb.z.z * up,
    });
    const tt = (v: number): Vec3 => ({
      x: toe.x + fb.y.x * v - (td.x / tl) * 0.01,
      y: toe.y + 0.012,
      z: toe.z + fb.y.z * v - (td.z / tl) * 0.01,
    });
    poly(
      [tp(-wv * 1.15, 0.03), tp(wv * 1.15, 0.03), tt(wv * 0.9), tt(-wv * 0.9)],
      '#f7f1e3',
      col.dark,
      0.012,
    );
    capsule(J[`shoulder${side}`], J[`elbow${side}`], 0.056, 0.045, col);
    capsule(J[`elbow${side}`], J[`wrist${side}`], 0.044, 0.032, col);
    blob(J[`shoulder${side}`], 0.062, col.fill, col.dark, 0.003);
    const hbs = B[`hand${side}`];
    const wr = J[`wrist${side}`];
    const hl = prop.hand;
    const pose = f.hands[side];
    const spread = pose === 'open' ? 0.055 : pose === 'grip' ? 0.03 : 0.036;
    const lenK = pose === 'grip' ? 0.62 : 1;
    const palmSeen = facesCam(hbs.z) > 0;
    poly(
      [
        along(wr, hbs, 0, -0.026, 0),
        along(wr, hbs, 0, 0.026, 0),
        along(wr, hbs, hl * lenK, spread, 0),
        along(wr, hbs, hl * lenK, -spread, 0),
      ],
      palmSeen ? '#ffe9c9' : col.dark,
      '#5d4630',
      0.004,
    );
    const pc = J[`hand${side}`];
    capsule(
      pc,
      along(pc, hbs, 0, 0, 0.03),
      0.012,
      0.008,
      { fill: '#ffe9c9', dark: '#5d4630' },
      palmSeen ? 0.02 : -0.02,
    );
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
  if (view.label) {
    ctx.fillStyle = '#3b3423';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(view.label, view.x0 + 6, view.y0 + 15);
  }
  ctx.restore();
}
