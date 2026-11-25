// Doug's shoulder review page (viewtest.html?sheet=shoulder). Plays the
// shoulder take (shoulderMotions.ts: SYNTHETIC 3D frames) through the drawn
// three-quarter and profile rigs.
//   s=133 (game scale, 964x542 stage) | s=345 (inspection)
//   variant=after   three-quarter and profile both through the delta driver
//   variant=before  whatever tree serves the page, driven the old way: the
//                   three-quarter through its delta driver, the profile through
//                   the absolute poser (the capture tool serves the frozen
//                   pre-repair tree for the BEFORE clips)
//   debug=bones     pivots and bones over the art
// `window.__shoulder` lets the capture tool pull frames and contact sheets.
import { loadRig } from '../../motion/rig/rig';
import { project } from '../core/camera';
import type { JointName, ProjectFn, ViewCamera, ViewFrame } from './contract';
import { createDeltaView } from './deltaRig';
import { createCharacterView, loadCharacterRigs } from './poser';
import { buildTake, VIEW_YAW, type ShoulderView } from './shoulderMotions';
import { buildFrame } from './synthetic';

const PITCH = (8 * Math.PI) / 180,
  CAMERA: ViewCamera = { yaw: 0, pitch: PITCH },
  BACKGROUND = '#cfc6b4',
  NEAR = 'R' as const;

type P2 = [number, number];
interface DrawnView {
  draw: (frame: ViewFrame, camera: ViewCamera, place: { x: number; y: number; scale: number }) => void;
  debug?: unknown;
  setDebug?: (mode: string) => void;
}

export async function run(query: URLSearchParams): Promise<void> {
  const id = 'doug',
    variant = query.get('variant') === 'before' ? 'before' : 'after',
    debugMode = query.get('debug') ?? '',
    only = query.get('view') as ShoulderView | null,
    views: ShoulderView[] = only ? [only] : ['threeQuarterFront', 'side'],
    character = await loadCharacterRigs('./rigs', id),
    p = character.proportions,
    S = Number(query.get('s') ?? 133),
    game = S < 200,
    width = game ? 964 : Math.round(S * 2.5),
    height = game ? 542 : Math.round(S * 2.62),
    place = { x: Math.round(width * 0.46), y: height - (game ? 80 : Math.round(0.14 * S)), scale: S },
    host = document.getElementById('sheet') as HTMLCanvasElement,
    glCanvas = document.createElement('canvas'),
    result: Record<string, unknown> = { done: false };
  (window as unknown as { __shoulder: typeof result }).__shoulder = result;
  glCanvas.width = width;
  glCanvas.height = height;
  host.width = width;
  host.height = height;
  const gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true })!,
    g = host.getContext('2d')!,
    take = buildTake(views, NEAR),
    drawn = {} as Record<ShoulderView, DrawnView>,
    rest = (view: ShoulderView) => buildFrame(p, { yaw: VIEW_YAW[view] });
  // The profile has no drawn border of its own: it borrows the three-quarter drawing's.
  const lab34 = (await loadRig(`./rigs/${id}/threeQuarterFront/rig.json`)).data,
    sticker = (lab34.meta.lab as { outline?: { widthPx: number; colour: [number, number, number] } }).outline,
    border = sticker ? { width: (sticker.widthPx * p.height) / lab34.meta.heightPx, colour: sticker.colour } : undefined;
  for (const view of views) {
    if (view === 'side' && variant === 'before') {
      const poser = createCharacterView(gl, character);
      drawn.side = { draw: (frame, camera, at) => poser.draw(frame, camera, at) };
    } else {
      const rig = await loadRig(`./rigs/${id}/${view}/rig.json`),
        delta = createDeltaView(gl, rig, p, { frame: rest(view), camera: CAMERA }, view === 'side' && border ? { outline: border } : {}) as unknown as DrawnView;
      delta.setDebug?.(debugMode);
      drawn[view] = delta;
    }
  }
  const canvasOf = (frame: ViewFrame, name: JointName): P2 => {
    const q = (project as ProjectFn)(frame.joints[name], CAMERA);
    return [place.x + q.x * S, place.y - q.y * S];
  };
  const LABEL: Record<ShoulderView, string> = { threeQuarterFront: 'three-quarter front drawing', side: 'profile drawing' };

  function drawFrame(n: number, target: CanvasRenderingContext2D = g, labels = true) {
    const at = take.at(n),
      frame = buildFrame(p, at.pose, n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawn[at.view].draw(frame, CAMERA, place);
    target.fillStyle = BACKGROUND;
    target.fillRect(0, 0, width, height);
    target.fillStyle = 'rgba(0,0,0,0.10)';
    target.fillRect(0, place.y, width, 1);
    target.drawImage(glCanvas, 0, 0);
    if (debugMode === 'bones') overlayBones(target, drawn[at.view]);
    if (labels) {
      target.fillStyle = '#111';
      target.font = `bold ${game ? 13 : 16}px system-ui`;
      target.fillText(`SYNTHETIC FRAMES (authored 3D joints, not the animator) | ${variant.toUpperCase()}`, 10, game ? 18 : 22);
      target.font = `${game ? 12 : 15}px system-ui`;
      target.fillText(`doug | ${LABEL[at.view]}`, 10, game ? 36 : 44);
      target.fillText(`${at.motion}${at.t >= 0 ? ` | t ${at.t}` : ''} | frame ${n}`, 10, game ? 54 : 66);
    }
    return { n, view: at.view, motion: at.motion, t: at.t, shoulder: canvasOf(frame, `shoulder${NEAR}`), shoulderFar: canvasOf(frame, 'shoulderL') };
  }

  function overlayBones(target: CanvasRenderingContext2D, view: DrawnView): void {
    const d = view.debug as { joints?: Record<string, P2>; tips?: Record<string, P2> } | null;
    if (!d?.joints) return;
    target.lineWidth = 2;
    for (const [name, at] of Object.entries(d.joints)) {
      const tip = d.tips?.[name],
        hot = /clavicle|upper_arm|sleeve/.test(name);
      if (!hot && !/chest|neck|forearm/.test(name)) continue;
      target.strokeStyle = hot ? '#00e5ff' : 'rgba(255,255,255,0.7)';
      target.fillStyle = /upper_arm/.test(name) ? '#ff2bd6' : hot ? '#00e5ff' : '#fff';
      if (tip) {
        target.beginPath();
        target.moveTo(at[0], at[1]);
        target.lineTo(tip[0], tip[1]);
        target.stroke();
      }
      target.beginPath();
      target.arc(at[0], at[1], /upper_arm/.test(name) ? 5 : 3, 0, 7);
      target.fill();
      target.strokeStyle = '#000';
      target.lineWidth = 1;
      target.stroke();
      target.lineWidth = 2;
    }
  }

  result.length = take.length;
  result.index = take.index;
  result.size = [width, height];
  result.place = place;
  result.draw = (n: number) => {
    const info = drawFrame(n);
    return { info, png: host.toDataURL('image/png') };
  };
  /**
   * Tiles: the listed frames, each cropped to a `w` x `h` (canvas px) box and `zoom`ed.
   * `follow`: 'near' | 'far' centres the box on that projected shoulder (plus `offset`), else `box` origin.
   */
  result.sheet = (frames: number[], box: [number, number, number, number], zoom: number, columns: number, follow?: 'near' | 'far', offset: P2 = [0, 0]) => {
    const tw = Math.round(box[2] * zoom),
      th = Math.round(box[3] * zoom),
      out = document.createElement('canvas'),
      scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    out.width = tw * columns;
    out.height = (th + 16) * Math.ceil(frames.length / columns);
    const og = out.getContext('2d')!,
      sg = scratch.getContext('2d')!;
    og.fillStyle = BACKGROUND;
    og.fillRect(0, 0, out.width, out.height);
    og.imageSmoothingEnabled = zoom < 1.5;
    frames.forEach((n, i) => {
      const info = drawFrame(n, sg, false),
        x = (i % columns) * tw,
        y = Math.floor(i / columns) * (th + 16),
        centre = follow === 'far' ? info.shoulderFar : info.shoulder,
        bx = follow ? Math.round(centre[0] + offset[0] - box[2] / 2) : box[0],
        by = follow ? Math.round(centre[1] + offset[1] - box[3] / 2) : box[1];
      og.drawImage(scratch, bx, by, box[2], box[3], x, y, tw, th);
      og.fillStyle = '#111';
      og.font = '11px system-ui';
      og.fillText(`f${n} ${info.view === 'side' ? 'profile' : '3/4'} ${info.motion.split(' (')[0].toLowerCase()}${info.t >= 0 ? ` t${info.t}` : ''}`, x + 3, y + th + 12);
      og.strokeStyle = 'rgba(0,0,0,0.2)';
      og.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
    });
    return out.toDataURL('image/png');
  };
  drawFrame(Number(query.get('n') ?? 0));
  result.done = true;
}
