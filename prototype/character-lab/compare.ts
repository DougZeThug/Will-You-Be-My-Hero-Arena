// One shot, two constructions, the same frames and the same camera.
//   LEFT   the frozen cut-out rig, used exactly as it is (views/deltaRig.ts for the
//          three-quarter drawing, views/poser.ts for every other angle)
//   MIDDLE "drawing on volume" (volume/) as first delivered (rigs/<id>/volumeV1)
//   RIGHT  the volume with the reach CORRECTIVE piece (corrections/, assembled from the
//          owner's existing drawings, not newly drawn) and the later fixes
// Frames: shot/shot.ts buildShot(proportions). Camera: core/camera.ts project().
//   compare.html                 the comparison (play, pause, step, scrub, 0.25x, zoom)
//   compare.html?mode=turntable  the volume's bind pose from -60..+60 degrees
//   compare.html?mode=bind       the source drawing beside the volume at its bind pose
// window.__CMP__ = { ready, frames, seek(i), ... } for capture.
import { loadRig } from '../motion/rig/rig';
import { makeCamera, project, viewAngle, type Camera } from './core/camera';
import { sanitizeProportions } from './core/proportions';
import type { Frame } from './core/types';
import { SHOT_BEATS, SHOT_CAMERA, buildShot } from './shot/shot';
import type { ViewFrame } from './views/contract';
import { createDeltaView } from './views/deltaRig';
import { createCharacterView, loadCharacterRigs } from './views/poser';
import { runDevPage } from './volume/devpage';
import { cheatFrame, type CheatSettings } from './volume/cheat';
import { RENDER, type RenderItem } from './volume/renderer';
import { SOLVER, loadVolumeRig } from './volume/rig';
import { VolumeStage, createVolumeView, type Placement, type VolumeView } from './volume/view';

const BACKGROUND = '#cfc6b4',
  GAME = { width: 964, height: 542, scale: 230 / 1.73, x: 0.36, ground: 64 },
  INSPECT = { width: 964, height: 760, scale: 600 / 1.73, x: 0.3, ground: 70 },
  DEG = 180 / Math.PI,
  LIMIT = 30; // deg a volume is trusted either side of its drawing (from the turntables)

interface Api {
  ready: boolean;
  error?: string;
  frames: number;
  beats: typeof SHOT_BEATS;
  seek(i: number): Record<string, unknown>;
  zoom(on: boolean): void;
  option(name: string, value: number | boolean): void;
  [key: string]: unknown;
}
const api: Api = { ready: false, frames: 0, beats: SHOT_BEATS, seek: () => ({}), zoom: () => undefined, option: () => undefined };
(window as unknown as { __CMP__: Api }).__CMP__ = api;

/** One wrapped drawing: the view angle it was drawn from, and whether it is a whole figure. */
interface VolumeEntry {
  name: string;
  view: VolumeView;
  angle: number;
  whole: boolean;
  label: string;
}
const apart = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

async function main(): Promise<void> {
  const query = new URLSearchParams(location.search),
    id = 'doug',
    proportions = sanitizeProportions(await (await fetch(`./rigs/${id}/volume/proportions.json`)).json()),
    frames = buildShot(proportions),
    camera: Camera = makeCamera(SHOT_CAMERA.camYaw, SHOT_CAMERA.pitch),
    reference = frames[0],
    canvasA = document.getElementById('stageA') as HTMLCanvasElement,
    canvasB = document.getElementById('stageB') as HTMLCanvasElement,
    canvasC = document.getElementById('stageC') as HTMLCanvasElement,
    glCanvasA = document.createElement('canvas'),
    glCanvasB = document.createElement('canvas'),
    options = { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true },
    glA = glCanvasA.getContext('webgl', options) as WebGLRenderingContext,
    glB = glCanvasB.getContext('webgl', { ...options, antialias: false, depth: false }) as WebGLRenderingContext,
    stage = new VolumeStage(glB),
    character = (await (await fetch(`./characters/${id}.json`)).json()) as { corrections?: { reach?: { frame: number; cheat: CheatSettings; switch?: { on: number; off: number; ramp: number } } } },
    load = async (name: string, whole: boolean, label: string, ref = reference): Promise<VolumeEntry | null> => {
      const response = await fetch(`./rigs/${id}/${name}/rig.json`);
      if (!response.ok) return null;
      const rig = await loadVolumeRig(`./rigs/${id}/${name}`);
      return { name, view: createVolumeView(stage, rig, ref), angle: rig.data.view.angleDeg, whole, label };
    },
    single = query.get('single') === '1',
    back = single ? null : await load('volumeBack', true, 'back drawing'),
    sideHead = single ? null : await load('volumeSideHead', false, 'profile drawing'),
    current = (await load('volume', true, 'three-quarter drawing'))!,
    first = (await load('volumeV1', true, 'three-quarter drawing')) ?? current,
    extra = [back, sideHead].filter((v): v is VolumeEntry => !!v),
    reachSpec = character.corrections?.reach,
    reachFrame = reachSpec ? cheatFrame(frames[reachSpec.frame], camera, reachSpec.cheat, 1) : null,
    reach = reachSpec && !single ? await load('corrections/reach', false, 'reach corrective', reachFrame!) : null,
    volumes = [current, ...extra];
  api.frames = frames.length;
  const debugOnly = query.get('only')?.split(',');
  if (query.get('ink') === '0') RENDER.ink = false;
  if (query.get('girdle')) SOLVER.girdleFollow = Number(query.get('girdle'));
  if (query.get('ss')) RENDER.supersample = Number(query.get('ss')) === 4 ? 4 : 2;
  const override = (name: string, fallback: number | undefined) => (query.get(name) !== null ? Number(query.get(name)) : fallback),
    reachSwitch = { on: override('on', reachSpec?.switch?.on) ?? 80, off: override('off', reachSpec?.switch?.off) ?? 102, ramp: override('ramp', reachSpec?.switch?.ramp) ?? 3 },
    headRule = query.get('head') ?? 'lead';

  if (query.get('mode')) {
    await runDevPage(query, { stage, glCanvas: glCanvasB, volumes: [...volumes, ...(reach ? [reach] : [])].map((v) => v.view), camera, proportions, frames });
    api.ready = true;
    return;
  }

  // ---- LEFT: the frozen rig, as it is.
  const frozen = await loadCharacterRigs('./rigs', id),
    threeQuarter = await loadRig(`./rigs/${id}/threeQuarterFront/rig.json`),
    delta = createDeltaView(glA, threeQuarter, proportions, { frame: reference as ViewFrame, camera }),
    poser = createCharacterView(glA, frozen);
  let lastLeft = '',
    lastMiddle = '',
    lastRight = '';

  let layout = GAME,
    now = 0;
  const place = (): Placement => ({ x: layout.width * layout.x, y: layout.height - layout.ground, scale: layout.scale });
  function resize(): void {
    for (const c of [canvasA, canvasB, canvasC, glCanvasA, glCanvasB]) {
      c.width = layout.width;
      c.height = layout.height;
    }
  }
  function backdrop(g: CanvasRenderingContext2D, frame: Frame, at: Placement): void {
    g.fillStyle = BACKGROUND;
    g.fillRect(0, 0, layout.width, layout.height);
    g.fillStyle = 'rgba(40,30,20,0.16)';
    g.fillRect(0, at.y, layout.width, 1);
    // Soft contact shadow under the feet.
    const mid = project({ x: (frame.joints.ankleL.x + frame.joints.ankleR.x) / 2, y: 0, z: (frame.joints.ankleL.z + frame.joints.ankleR.z) / 2 }, camera),
      spread = Math.hypot(frame.joints.ankleL.x - frame.joints.ankleR.x, frame.joints.ankleL.z - frame.joints.ankleR.z);
    g.save();
    g.translate(at.x + mid.x * at.scale, at.y - mid.y * at.scale);
    g.scale((0.24 + spread * 0.5) * at.scale, 0.055 * at.scale);
    const shade = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    shade.addColorStop(0, 'rgba(30,20,10,0.28)');
    shade.addColorStop(1, 'rgba(30,20,10,0)');
    g.fillStyle = shade;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function caption(g: CanvasRenderingContext2D, title: string, detail: string, warning: string): void {
    g.fillStyle = '#111';
    g.font = 'bold 14px system-ui';
    g.fillText(title, 10, 20);
    g.font = '12px system-ui';
    g.fillText(detail, 10, 37);
    if (warning) {
      g.fillStyle = '#a01818';
      g.font = 'bold 12px system-ui';
      g.fillText(warning, 10, 54);
    }
  }
  /** How much of the reach corrective is on at a frame: 0 = not shown; else the cheat amount (ramped at both ends). */
  const reachAmount = (i: number): number | null => {
    if (!reach || i < reachSwitch.on || i > reachSwitch.off) return null;
    return Math.min(1, (i - reachSwitch.on) / reachSwitch.ramp, (reachSwitch.off - i) / reachSwitch.ramp);
  };
  /** One volume panel: body and head each from the nearest drawing; optionally the reach corrective. */
  function volumePanel(frame: Frame, i: number, list: VolumeEntry[], corrected: boolean, rule: string) {
    const mid = Math.atan2(Math.sin(frame.yaw.pelvis) + Math.sin(frame.yaw.chest), Math.cos(frame.yaw.pelvis) + Math.cos(frame.yaw.chest)),
      bodyAngle = viewAngle(mid, camera.yaw) * DEG,
      headAngle = viewAngle(frame.yaw.head, camera.yaw) * DEG,
      nearest = (from: VolumeEntry[], to: number) => from.reduce((best, v) => (apart(v.angle, to) < apart(best.angle, to) ? v : best)),
      body = nearest(list.filter((v) => v.whole), bodyAngle);
    let head = nearest(list, headAngle);
    // 'sync': the head may not go to another WHOLE-figure drawing before the body does.
    if (rule === 'sync' && head.whole && head !== body) head = nearest(list.filter((v) => !v.whole || v === body), headAngle);
    const amount = corrected ? reachAmount(i) : null,
      hide = amount !== null ? [`arm${reachSpec!.cheat.side}`] : undefined,
      items: RenderItem[] = head === body ? [{ layers: body.view.layers, world: body.view.pose(frame), subset: 'all', hide, only: debugOnly }] : [{ layers: body.view.layers, world: body.view.pose(frame), subset: 'body', hide, only: debugOnly }, { layers: head.view.layers, world: head.view.pose(frame), subset: 'head' }];
    if (amount !== null) items.push({ layers: reach!.view.layers, world: reach!.view.pose(cheatFrame(frame, camera, reachSpec!.cheat, amount)), subset: 'all' });
    const bodyOff = apart(body.angle, bodyAngle),
      headOff = apart(head.angle, headAngle),
      beyond = [bodyOff > LIMIT ? `body ${bodyOff.toFixed(0)} deg` : '', headOff > LIMIT ? `head ${headOff.toFixed(0)} deg` : ''].filter(Boolean).join(', ');
    return {
      items,
      detail: (head === body ? `${body.label} on one volume` : `body: ${body.label} | head: ${head.label}`) + (amount !== null ? ' | arm: REACH CORRECTIVE (assembled from existing drawings, not newly drawn)' : ''),
      warning: beyond ? `STAND-IN: ${beyond} past the nearest drawing` : '',
      name: `${body.name}${head === body ? '' : `+${head.name}`}${amount !== null ? '+reach' : ''}`,
      bodyOff,
      headOff,
      amount,
    };
  }
  function show(canvas: HTMLCanvasElement, frame: Frame, at: Placement, items: RenderItem[], title: string, detail: string, warning: string): void {
    glB.bindFramebuffer(glB.FRAMEBUFFER, null);
    glB.viewport(0, 0, layout.width, layout.height);
    glB.clearColor(0, 0, 0, 0);
    glB.clear(glB.COLOR_BUFFER_BIT);
    stage.render(items, camera, at, layout.width, layout.height);
    const g = canvas.getContext('2d')!;
    backdrop(g, frame, at);
    g.drawImage(glCanvasB, 0, 0);
    caption(g, title, detail, warning);
  }
  function draw(i: number): Record<string, unknown> {
    now = Math.max(0, Math.min(frames.length - 1, Math.round(i)));
    const frame = frames[now],
      at = place(),
      angle = viewAngle(frame.yaw.pelvis, camera.yaw) * DEG,
      beat = `${frame.phase} | frame ${now}`;
    // LEFT
    const leftKind = angle >= 22.5 && angle <= 67.5 ? 'threeQuarter' : 'poser';
    glA.bindFramebuffer(glA.FRAMEBUFFER, null);
    glA.viewport(0, 0, layout.width, layout.height);
    glA.clearColor(0, 0, 0, 0);
    glA.clear(glA.COLOR_BUFFER_BIT);
    let leftDetail = 'three-quarter drawing (delta rig)',
      leftWarning = '';
    if (leftKind === 'threeQuarter') delta.draw(frame as ViewFrame, camera, at);
    else {
      if (lastLeft !== 'poser') poser.reset();
      poser.draw(frame as ViewFrame, camera, at);
      const d = poser.debug;
      leftDetail = `2.5D poser: ${d?.label ?? ''}`;
      if (d && Object.values(d.blocks).some((b) => b.standIn)) leftWarning = 'STAND-IN drawing in use (no drawing for this angle)';
    }
    const switchedLeft = lastLeft !== '' && lastLeft !== leftKind;
    lastLeft = leftKind;
    const gA = canvasA.getContext('2d')!;
    backdrop(gA, frame, at);
    gA.drawImage(glCanvasA, 0, 0);
    caption(gA, 'CURRENT: frozen cut-out rig', `${leftDetail} | ${beat}`, leftWarning);
    // MIDDLE: the volume as first delivered. RIGHT: with the reach corrective and the later fixes.
    const middle = volumePanel(frame, now, [first, ...extra], false, 'lead');
    show(canvasB, frame, at, middle.items, 'VOLUME as first delivered', `${middle.detail} | ${beat}`, middle.warning);
    const right = volumePanel(frame, now, volumes, true, headRule);
    show(canvasC, frame, at, right.items, 'VOLUME + reach corrective', `${right.detail} | ${beat}`, right.warning);
    const info = { frame: now, phase: frame.phase, angle, left: leftKind, switchedLeft, middle: middle.name, switchedMiddle: lastMiddle !== '' && lastMiddle !== middle.name, right: right.name, switchedRight: lastRight !== '' && lastRight !== right.name, bodyOff: right.bodyOff, headOff: right.headOff, reach: right.amount };
    lastMiddle = middle.name;
    lastRight = right.name;
    (document.getElementById('info') as HTMLElement).textContent = `frame ${now}/${frames.length - 1}  ${frame.phase}  view ${angle.toFixed(0)} deg`;
    (document.getElementById('scrub') as HTMLInputElement).value = String(now);
    return info;
  }

  // ---- Controls.
  const scrub = document.getElementById('scrub') as HTMLInputElement,
    playButton = document.getElementById('play')!,
    slowButton = document.getElementById('slow')!,
    zoomButton = document.getElementById('zoom')!;
  let playing = false,
    speed = 1,
    clock = 0,
    last = 0;
  scrub.max = String(frames.length - 1);
  const tick = (time: number) => {
    if (!playing) return;
    clock += ((time - last) / 1000) * 60 * speed;
    last = time;
    if (clock >= frames.length) clock -= frames.length;
    draw(Math.floor(clock));
    requestAnimationFrame(tick);
  };
  playButton.onclick = () => {
    playing = !playing;
    playButton.textContent = playing ? 'Pause' : 'Play';
    if (playing) {
      clock = now;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  };
  const pause = () => {
    playing = false;
    playButton.textContent = 'Play';
  };
  document.getElementById('back')!.onclick = () => {
    pause();
    draw(now - 1);
  };
  document.getElementById('forward')!.onclick = () => {
    pause();
    draw(now + 1);
  };
  slowButton.onclick = () => {
    speed = speed === 1 ? 0.25 : 1;
    slowButton.classList.toggle('on', speed !== 1);
  };
  const zoom = (on: boolean) => {
    layout = on ? INSPECT : GAME;
    zoomButton.classList.toggle('on', on);
    resize();
    lastLeft = '';
    draw(now);
  };
  zoomButton.onclick = () => zoom(layout === GAME);
  scrub.oninput = () => {
    pause();
    draw(Number(scrub.value));
  };
  api.seek = (i) => draw(i);
  api.zoom = zoom;
  api.option = (name, value) => {
    (RENDER as Record<string, unknown>)[name] = value;
    draw(now);
  };
  api.joints = (i: number) => {
    const at = place();
    return Object.fromEntries(
      Object.entries(frames[i].joints).map(([name, p]) => {
        const q = project(p, camera);
        return [name, [at.x + q.x * at.scale, at.y - q.y * at.scale]];
      }),
    );
  };
  /**
   * Hand-off measure at a frame: pixels where the volume's own arm and the corrective
   * (at cheat `amount`) differ, and the size of their union (current layout, no border).
   */
  api.silhouette = (i: number, amount: number) => {
    if (!reach || !reachSpec) return null;
    const frame = frames[i],
      at = place(),
      w = layout.width,
      h = layout.height,
      border = RENDER.border,
      mask = (items: RenderItem[]) => {
        glB.bindFramebuffer(glB.FRAMEBUFFER, null);
        glB.viewport(0, 0, w, h);
        glB.clearColor(0, 0, 0, 0);
        glB.clear(glB.COLOR_BUFFER_BIT);
        stage.render(items, camera, at, w, h);
        const pixels = new Uint8Array(w * h * 4);
        glB.readPixels(0, 0, w, h, glB.RGBA, glB.UNSIGNED_BYTE, pixels);
        return pixels;
      };
    RENDER.border = false;
    const a = mask([{ layers: current.view.layers, world: current.view.pose(frame), subset: 'all', only: [`arm${reachSpec.cheat.side}`] }]),
      b = mask([{ layers: reach.view.layers, world: reach.view.pose(cheatFrame(frame, camera, reachSpec.cheat, amount)), subset: 'all' }]);
    RENDER.border = border;
    let differ = 0,
      union = 0;
    for (let k = 3; k < a.length; k += 4) {
      const p = a[k] > 127,
        q = b[k] > 127;
      if (p !== q) differ++;
      if (p || q) union++;
    }
    return { frame: i, differ, union, share: +(differ / Math.max(1, union)).toFixed(3) };
  };
  resize();
  draw(Number(query.get('n') ?? 0));
  if (query.get('zoom') === '1') zoom(true);
  api.ready = true;
}

main().catch((error: unknown) => {
  api.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  document.getElementById('log')!.textContent = api.error;
});
