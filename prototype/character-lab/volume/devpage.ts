// Review pages for the volume alone (loaded by compare.ts with ?mode=...):
//   mode=turntable  one pose seen from -60..+60 degrees around the drawing's own angle
//                   (&n=<frame> for a shot frame instead of the bind pose, &s=<px per metre>)
//   mode=bind       the untouched source drawing | the volume at its bind pose, same angle |
//                   difference x4 | both at game scale
import { makeCamera, project, type Camera } from '../core/camera';
import type { Frame, Proportions } from '../core/types';
import type { VolumeStage, VolumeView } from './view';

const BACKGROUND = '#cfc6b4';

export interface DevContext {
  stage: VolumeStage;
  glCanvas: HTMLCanvasElement;
  volumes: VolumeView[];
  camera: Camera;
  proportions: Proportions;
  frames: Frame[];
}

export async function runDevPage(query: URLSearchParams, ctx: DevContext): Promise<void> {
  const mode = query.get('mode'),
    which = query.get('volume') ?? 'volume',
    view = ctx.volumes.find((v) => v.rig.data.volume === which) ?? ctx.volumes[ctx.volumes.length - 1],
    gl = ctx.stage.gl,
    sheet = document.getElementById('sheet') as HTMLCanvasElement,
    data = view.rig.data as typeof view.rig.data & { sheet: { width: number; height: number; pelvisPx: [number, number]; source: string } };
  document.getElementById('stages')!.style.display = 'none';
  document.getElementById('controls')!.style.display = 'none';
  sheet.style.display = 'block';
  const render = (frame: Parameters<VolumeView['draw']>[0], camera: Camera, place: { x: number; y: number; scale: number }, width: number, height: number) => {
    ctx.glCanvas.width = width;
    ctx.glCanvas.height = height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    view.draw(frame, camera, place, width, height);
  };
  const n = query.get('n'),
    pose = n === null ? view.bindFrame() : ctx.frames[Number(n)];

  if (mode === 'turntable') {
    const s = Number(query.get('s') ?? 240),
      from = Number(query.get('from') ?? -60),
      to = Number(query.get('to') ?? 60),
      step = Number(query.get('step') ?? 10),
      columns = Number(query.get('columns') ?? 7),
      tileW = Math.round(s * 1.3),
      tileH = Math.round(s * 2.05),
      angles: number[] = [];
    for (let a = from; a <= to + 1e-6; a += step) angles.push(a);
    sheet.width = tileW * Math.min(columns, angles.length);
    sheet.height = (tileH + 22) * Math.ceil(angles.length / columns);
    const g = sheet.getContext('2d')!;
    g.fillStyle = BACKGROUND;
    g.fillRect(0, 0, sheet.width, sheet.height);
    angles.forEach((a, k) => {
      // Orbiting the camera by +a shows the view angle (drawing's angle + a).
      const camera = makeCamera(ctx.camera.yaw + (a * Math.PI) / 180, ctx.camera.pitch),
        centre = project({ x: pose.joints.pelvis.x, y: 0, z: pose.joints.pelvis.z }, camera),
        x = (k % columns) * tileW,
        y = Math.floor(k / columns) * (tileH + 22);
      render(pose, camera, { x: tileW / 2 - centre.x * s, y: tileH - 0.12 * s + centre.y * s, scale: s }, tileW, tileH);
      g.drawImage(ctx.glCanvas, x, y);
      g.fillStyle = a === 0 ? '#1a4d9a' : Math.abs(a) > 30 ? '#a01818' : '#111';
      g.font = 'bold 13px system-ui';
      g.fillText(`${a > 0 ? '+' : ''}${a} deg  (view angle ${(data.view.angleDeg + a).toFixed(0)})${a === 0 ? '  = THE DRAWING' : ''}`, x + 6, y + tileH + 15);
    });
    return;
  }

  // ---- bind: source | volume | difference x4 | game scale pair.
  const source = new Image();
  source.src = `./${data.sheet.source.replace(/^prototype\/character-lab\//, '')}`;
  if (!/^prototype\/character-lab\//.test(data.sheet.source)) source.src = `/@fs/${__REPOSITORY__}/${data.sheet.source}`;
  await source.decode();
  const W = data.sheet.width,
    H = data.sheet.height,
    camera = makeCamera(data.view.cameraYaw, ctx.camera.pitch),
    q = project(view.rig.bind.pelvis, camera),
    ppm = data.pxPerMetre,
    place = { x: data.sheet.pelvisPx[0] + 0.5 - q.x * ppm, y: data.sheet.pelvisPx[1] + 0.5 + q.y * ppm, scale: ppm };
  render(view.bindFrame(), camera, place, W, H);
  const composite = (image: CanvasImageSource) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = BACKGROUND;
    g.fillRect(0, 0, W, H);
    g.drawImage(image, 0, 0);
    return g;
  };
  const a = composite(source).getImageData(0, 0, W, H),
    volumeFull = composite(ctx.glCanvas),
    b = volumeFull.getImageData(0, 0, W, H),
    diff = new ImageData(W, H);
  let sum = 0,
    over16 = 0,
    over48 = 0;
  for (let i = 0; i < W * H; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]));
    sum += d;
    if (d > 16) over16++;
    if (d > 48) over48++;
    const v = Math.min(255, d * 4);
    diff.data.set([v, v, v, 255], i * 4);
  }
  const gameScale = (230 / 1.73 / ppm) * 1,
    gw = Math.ceil(W * gameScale),
    gh = Math.ceil(H * gameScale),
    game = document.createElement('canvas');
  game.width = gw;
  game.height = gh;
  render(view.bindFrame(), camera, { x: place.x * gameScale, y: place.y * gameScale, scale: ppm * gameScale }, gw, gh);
  const gg = game.getContext('2d')!;
  gg.fillStyle = BACKGROUND;
  gg.fillRect(0, 0, gw, gh);
  gg.drawImage(ctx.glCanvas, 0, 0);
  const pad = 30;
  sheet.width = W * 3 + gw * 2 + pad * 6;
  sheet.height = H + 76;
  const g = sheet.getContext('2d')!;
  g.fillStyle = BACKGROUND;
  g.fillRect(0, 0, sheet.width, sheet.height);
  g.fillStyle = '#111';
  g.font = 'bold 20px system-ui';
  const numbers = { size: [W, H], meanDifference: +(sum / (W * H)).toFixed(3), pixelsOver16: over16, pixelsOver48: over48, shareOver48: +(over48 / (W * H)).toFixed(4) };
  g.fillText('SOURCE (untouched PNG, baked border and ink)', pad, 28);
  g.drawImage(composite(source).canvas, pad, 44);
  g.fillText('VOLUME at its bind pose, same angle (generated ink + border)', pad * 2 + W, 28);
  g.drawImage(volumeFull.canvas, pad * 2 + W, 44);
  g.fillText('DIFFERENCE x4', pad * 3 + W * 2, 28);
  g.putImageData(diff, pad * 3 + W * 2, 44);
  g.fillText('game scale: source', pad * 4 + W * 3, 28);
  g.imageSmoothingQuality = 'high';
  g.drawImage(composite(source).canvas, pad * 4 + W * 3, 44, gw, gh);
  g.fillText('volume', pad * 5 + W * 3 + gw, 28);
  g.drawImage(game, pad * 5 + W * 3 + gw, 44);
  g.font = '15px system-ui';
  g.fillText(JSON.stringify(numbers), pad, H + 66);
  (window as unknown as { __CMP__: Record<string, unknown> }).__CMP__.numbers = numbers;
}

declare const __REPOSITORY__: string;
