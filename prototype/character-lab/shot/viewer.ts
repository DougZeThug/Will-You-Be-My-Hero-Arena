// Review page for the shot: the authored frames on the volumetric mannequin, at game size
// (964x542 stage, about 230 px tall) and at inspection size, with play, pause, frame-step,
// scrub, 0.25x and a camera-yaw slider.   /shot.html?p=default|lanky|rig|volume&cam=35&f=80
import { CAMERA_PITCH, makeCamera } from '../core/camera';
import {
  defaultProportions,
  lankyProportions,
  sanitizeProportions,
} from '../core/proportions';
import type { Frame, Proportions, Vec3 } from '../core/types';
import { drawMannequin } from './mannequin';
import { SHOT_BEATS, SHOT_CAMERA, buildShot } from './shot';

const query = new URLSearchParams(location.search);
const $ = <E extends HTMLElement>(id: string) =>
  document.getElementById(id) as E;
const stage = $<HTMLCanvasElement>('stage');
const inspect = $<HTMLCanvasElement>('inspect');
const sctx = stage.getContext('2d') as CanvasRenderingContext2D;
const ictx = inspect.getContext('2d') as CanvasRenderingContext2D;

const GAME_HEIGHT_PX = 230;
const sets: Record<string, Proportions> = {
  default: defaultProportions(),
  lanky: lankyProportions(),
};
let propsId = 'default';
let frames: Frame[] = [];
let prop: Proportions = sets.default;
let camYaw = ((Number(query.get('cam')) || 0) * Math.PI) / 180 || SHOT_CAMERA.camYaw;
let frame = Number(query.get('f')) || 0;
let playing = !query.has('f');
let slow = false;
let trails = false;
let acc = 0;
let last = 0;
let pauseAtEnd = 0;
let centre: Vec3 = { x: 0, y: 0, z: 0 };

async function loadJson(path: string): Promise<Proportions | null> {
  try {
    const r = await fetch(path);
    if (!r.ok) return null;
    return sanitizeProportions(await r.json());
  } catch {
    return null;
  }
}

function rebuild(): void {
  prop = sets[propsId] ?? sets.default;
  frames = buildShot(prop);
  // fixed world framing: the middle of the travel
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const f of frames) {
    x0 = Math.min(x0, f.joints.pelvis.x);
    x1 = Math.max(x1, f.joints.pelvis.x);
    z0 = Math.min(z0, f.joints.pelvis.z);
    z1 = Math.max(z1, f.joints.pelvis.z);
  }
  centre = { x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2 };
  $<HTMLInputElement>('scrub').max = String(frames.length - 1);
  frame = Math.min(frame, frames.length - 1);
}

function beatName(i: number): string {
  return SHOT_BEATS.find((b) => i >= b.from && i < b.to)?.name ?? '';
}

function redraw(): void {
  const f = frames[frame];
  const cam = makeCamera(camYaw, CAMERA_PITCH);
  const trail = trails ? frames.slice(Math.max(0, frame - 14), frame) : undefined;
  const gamePx = GAME_HEIGHT_PX / prop.height;
  drawMannequin(sctx, f, prop, {
    cam,
    centre,
    cx: stage.width / 2,
    cy: stage.height * 0.8,
    px: gamePx,
    x0: 0,
    y0: 0,
    w: stage.width,
    h: stage.height,
    label: `game size   frame ${frame}   ${f.phase}`,
    trail,
  });
  const ipx = (inspect.height * 0.84) / prop.height;
  drawMannequin(ictx, f, prop, {
    cam,
    centre,
    cx: inspect.width / 2,
    cy: inspect.height * 0.9,
    px: ipx,
    x0: 0,
    y0: 0,
    w: inspect.width,
    h: inspect.height,
    label: `inspection   L ${f.contacts.footL ? 'planted' : 'air'}  R ${f.contacts.footR ? 'planted' : 'air'}  squash ${f.squash.toFixed(3)}`,
    trail,
  });
  $<HTMLInputElement>('scrub').value = String(frame);
  $('info').textContent =
    `frame ${frame}/${frames.length - 1}  ${beatName(frame)}  ${propsId}`;
  $('camLabel').textContent = String(Math.round((camYaw * 180) / Math.PI));
}

function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    if (pauseAtEnd > 0) {
      pauseAtEnd -= dt;
      if (pauseAtEnd <= 0) frame = 0;
    } else {
      acc += dt * 60 * (slow ? 0.25 : 1);
      while (acc >= 1) {
        acc -= 1;
        if (frame < frames.length - 1) frame++;
        else {
          pauseAtEnd = 0.6;
          acc = 0;
          break;
        }
      }
    }
    redraw();
  }
  requestAnimationFrame(tick);
}

function seek(i: number): void {
  frame = Math.max(0, Math.min(frames.length - 1, Math.round(i)));
  redraw();
}
function setCamYaw(rad: number): void {
  camYaw = rad;
  $<HTMLInputElement>('cam').value = String(Math.round((rad * 180) / Math.PI));
  redraw();
}
function setPlaying(on: boolean): void {
  playing = on;
  $('play').textContent = on ? 'pause' : 'play';
}

/** A contact sheet of the listed frames as a PNG data URL (fixed world framing per sheet). */
function sheet(
  list: number[],
  camYawRad: number,
  cols = 6,
  cellW = 250,
  cellH = 340,
  px = 172,
): string {
  const rows = Math.ceil(list.length / cols);
  const c = document.createElement('canvas');
  c.width = cols * cellW;
  c.height = rows * cellH;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#1d1f24';
  g.fillRect(0, 0, c.width, c.height);
  const cam = makeCamera(camYawRad, CAMERA_PITCH);
  let sx = 0;
  let sz = 0;
  for (const i of list) {
    sx += frames[i].joints.pelvis.x;
    sz += frames[i].joints.pelvis.z;
  }
  const mid = { x: sx / list.length, y: 0, z: sz / list.length };
  list.forEach((i, n) => {
    const x0 = (n % cols) * cellW;
    const y0 = Math.floor(n / cols) * cellH;
    drawMannequin(g, frames[i], prop, {
      cam,
      centre: mid,
      cx: x0 + cellW / 2,
      cy: y0 + cellH * 0.9,
      px,
      x0: x0 + 1,
      y0: y0 + 1,
      w: cellW - 2,
      h: cellH - 2,
      label: `${i} ${frames[i].phase}`,
    });
  });
  return c.toDataURL('image/png');
}

async function main(): Promise<void> {
  const volume = await loadJson('./rigs/doug/volume/proportions.json');
  const rig = await loadJson('./rigs/doug/proportions.json');
  if (volume) sets.volume = volume;
  if (rig) sets.rig = rig;
  const asked = query.get('p');
  propsId = asked && sets[asked] ? asked : volume ? 'volume' : 'default';
  const sel = $<HTMLSelectElement>('props');
  for (const id of Object.keys(sets)) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = `proportions: ${id}`;
    sel.appendChild(o);
  }
  sel.value = propsId;
  sel.onchange = () => {
    propsId = sel.value;
    rebuild();
    redraw();
  };
  rebuild();
  $('play').onclick = () => setPlaying(!playing);
  $('back').onclick = () => {
    setPlaying(false);
    seek(frame - 1);
  };
  $('fwd').onclick = () => {
    setPlaying(false);
    seek(frame + 1);
  };
  $('slow').onclick = () => {
    slow = !slow;
    $('slow').classList.toggle('on', slow);
  };
  $('trail').onclick = () => {
    trails = !trails;
    $('trail').classList.toggle('on', trails);
    redraw();
  };
  $<HTMLInputElement>('scrub').oninput = (e) => {
    setPlaying(false);
    seek(Number((e.target as HTMLInputElement).value));
  };
  $<HTMLInputElement>('cam').oninput = (e) =>
    setCamYaw((Number((e.target as HTMLInputElement).value) * Math.PI) / 180);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') setPlaying(!playing);
    else if (e.key === 'ArrowLeft' || e.key === ',') {
      setPlaying(false);
      seek(frame - 1);
    } else if (e.key === 'ArrowRight' || e.key === '.') {
      setPlaying(false);
      seek(frame + 1);
    } else return;
    e.preventDefault();
  });
  setPlaying(playing);
  setCamYaw(camYaw);
  const api = {
    ready: true,
    get frames() {
      return frames;
    },
    beats: SHOT_BEATS,
    seek(i: number) {
      setPlaying(false);
      seek(i);
    },
    setCamYaw,
    setTrails(on: boolean) {
      trails = on;
      redraw();
    },
    setProportions(id: string) {
      if (!sets[id]) return false;
      propsId = id;
      sel.value = id;
      rebuild();
      redraw();
      return true;
    },
    sheet,
  };
  (window as unknown as { __SHOT__: typeof api }).__SHOT__ = api;
  last = performance.now();
  requestAnimationFrame(tick);
}

void main();
