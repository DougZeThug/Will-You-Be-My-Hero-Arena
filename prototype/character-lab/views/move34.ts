// Doug's front three-quarter view, proof page (loaded by viewtest.html with
// ?sheet=doug34). Two jobs:
//   mode=bind  the untouched source drawing beside the rig's neutral pose, a 4x
//              difference image and the bind-diff numbers;
//   mode=clip  one continuous take of SYNTHETIC frames (authored here as 3D
//              joint Frames): hold, shoulder lift, torso twist, step, turn into
//              the profile. `window.__move34` lets the capture tool pull frames.
// No dissolves anywhere: the view change is a hard switch on one frame.
import { loadRig } from '../../motion/rig/rig';
import { project } from '../core/camera';
import { facing, viewAngleOf, type ProjectFn, type ViewCamera, type ViewFrame } from './contract';
import { createDeltaView } from './deltaRig';
import { createCharacterView, loadCharacterRigs } from './poser';
import { buildFrame, rad, type Pose } from './synthetic';

const PITCH = (8 * Math.PI) / 180,
  CAMERA: ViewCamera = { yaw: 0, pitch: PITCH },
  BACKGROUND = '#cfc6b4',
  SWITCH_AT = 22.5; // deg: below this view angle the profile drawing takes over

const ease = (a: number, b: number, n: number) => {
  const t = Math.min(1, Math.max(0, (n - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export async function run(query: URLSearchParams): Promise<void> {
  const id = 'doug',
    mode = query.get('mode') ?? 'clip',
    character = await loadCharacterRigs('./rigs', id),
    rig = await loadRig(`./rigs/${id}/threeQuarterFront/rig.json`),
    p = character.proportions,
    restPose: Pose = { yaw: -45 },
    rest = buildFrame(p, restPose),
    f = facing(rad(-45)),
    left = { x: f.z, y: 0, z: -f.x },
    host = document.getElementById('sheet') as HTMLCanvasElement,
    log = document.getElementById('log')!,
    glCanvas = document.createElement('canvas'),
    result: Record<string, unknown> = { done: false };
  (window as unknown as { __move34: typeof result }).__move34 = result;

  // ---- The take.
  const LENGTH = 580;
  function poseAt(n: number): { pose: Pose; phase: string } {
    const pose: Pose = { yaw: -45 };
    let phase = 'neutral hold';
    // Shoulder lift (near shoulder = right).
    const lift = ease(40, 70, n) - ease(90, 125, n);
    pose.shrugR = [0.07 * lift, 0.03 * lift];
    if (n >= 40 && n < 125) phase = 'shoulder lift';
    // Torso twist: +25 with the head staying forward, head follows, then -25, back.
    const twist = 25 * (ease(125, 170, n) - ease(215, 245, n)) - 25 * (ease(245, 275, n) - ease(285, 315, n)),
      headStays = ease(125, 170, n) - ease(185, 215, n);
    pose.twist = twist;
    pose.headTurn = -25 * headStays + 8 * (ease(215, 235, n) - ease(255, 285, n));
    if (n >= 125 && n < 315) phase = n < 185 ? 'twist +25, head stays forward' : n < 215 ? 'head follows' : n < 285 ? 'twist to -25, head with it' : 'twist back';
    pose.armL = { forward: 4 * Math.sin(n / 40), elbow: 8 };
    // Step: weight onto the far (left) foot, the near (right) foot lifts, swings, plants.
    if (n >= 315) {
      const shift = ease(315, 345, n) - ease(405, 440, n),
        swing = ease(360, 400, n),
        up = ease(345, 365, n) - ease(392, 410, n),
        forward = ease(405, 440, n),
        hL = rest.joints.heelL,
        hR = rest.joints.heelR,
        turn = 45 * ease(455, 545, n), // deg of yaw toward the profile
        yaw = -45 + turn;
      pose.yaw = yaw;
      pose.x = left.x * 0.06 * shift + f.x * 0.15 * forward;
      pose.z = left.z * 0.06 * shift + f.z * 0.15 * forward;
      pose.feet = {
        L: { x: hL.x, z: hL.z, yaw },
        R: { x: hR.x + f.x * 0.3 * swing, z: hR.z + f.z * 0.3 * swing, yaw, lift: 0.08 * up, pitch: 22 * up },
      };
      pose.armR = { forward: -14 * (swing - forward), elbow: 10 };
      pose.armL = { forward: 14 * (swing - forward), elbow: 10 };
      phase = n < 345 ? 'weight shift' : n < 410 ? 'near foot lifts, swings, plants (far foot planted)' : n < 455 ? 'weight forward, settle' : n < 545 ? 'turn toward the profile' : 'profile hold';
    }
    return { pose, phase };
  }
  const frameAt = (n: number): ViewFrame => buildFrame(p, poseAt(n).pose, n);

  // ---- Bind test: source | rig at rest | 4x difference.
  if (mode === 'bind') {
    const source = new Image();
    source.src = `./source-art/${id}-three-quarter.png`;
    await source.decode();
    const W = source.width,
      H = source.height,
      origin = rig.data.meta.sheetOrigin as [number, number];
    glCanvas.width = W;
    glCanvas.height = H;
    const gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false })!,
      view = createDeltaView(gl, rig, p, { frame: rest, camera: CAMERA });
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    view.draw(rest, CAMERA, { x: 0, y: 0, scale: view.ppm }, { origin, scale: 1 });
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
      b = composite(glCanvas).getImageData(0, 0, W, H),
      raw = (() => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d')!;
        g.drawImage(source, 0, 0);
        return g.getImageData(0, 0, W, H).data;
      })(),
      diff = new ImageData(W, H);
    let max = 0,
      sum = 0,
      over4 = 0,
      over16 = 0,
      interior = 0,
      interiorMax = 0,
      interiorSum = 0,
      interiorOver4 = 0;
    for (let i = 0; i < W * H; i++) {
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]));
      max = Math.max(max, d);
      sum += d;
      if (d > 4) over4++;
      if (d > 16) over16++;
      // Interior: fully opaque source pixels with fully opaque neighbours.
      const x = i % W,
        y = (i / W) | 0;
      if (x > 1 && y > 1 && x < W - 2 && y < H - 2 && raw[i * 4 + 3] >= 250 && raw[(i - 2) * 4 + 3] >= 250 && raw[(i + 2) * 4 + 3] >= 250 && raw[(i - 2 * W) * 4 + 3] >= 250 && raw[(i + 2 * W) * 4 + 3] >= 250) {
        interior++;
        interiorMax = Math.max(interiorMax, d);
        interiorSum += d;
        if (d > 4) interiorOver4++;
      }
      const v = Math.min(255, d * 4);
      diff.data.set([v, v, v, 255], i * 4);
    }
    const numbers = {
      size: [W, H],
      allPixels: { max, mean: +(sum / (W * H)).toFixed(4), over4, over16 },
      interior: { pixels: interior, max: interiorMax, mean: +(interiorSum / interior).toFixed(4), over4: interiorOver4 },
    };
    // Game-scale pair.
    const gameScale = 230 / rig.data.meta.heightPx,
      gw = Math.ceil(W * gameScale),
      gh = Math.ceil(H * gameScale),
      game = document.createElement('canvas');
    game.width = gw;
    game.height = gh;
    const gg = game.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true })!,
      gameView = createDeltaView(gg, await loadRig(`./rigs/${id}/threeQuarterFront/rig.json`), p, { frame: rest, camera: CAMERA });
    gg.viewport(0, 0, gw, gh);
    gg.clearColor(0, 0, 0, 0);
    gg.clear(gg.COLOR_BUFFER_BIT);
    gameView.draw(rest, CAMERA, { x: 0, y: 0, scale: gameView.ppm * gameScale }, { origin: [origin[0] * gameScale, origin[1] * gameScale], scale: gameScale });
    const pad = 40;
    host.width = W * 3 + gw * 2 + pad * 6;
    host.height = H + 70;
    const g = host.getContext('2d')!;
    g.fillStyle = BACKGROUND;
    g.fillRect(0, 0, host.width, host.height);
    g.fillStyle = '#111';
    g.font = 'bold 20px system-ui';
    const label = (text: string, x: number) => g.fillText(text, x, 28);
    label('SOURCE (untouched PNG)', pad);
    g.drawImage(source, pad, 50);
    label('RIG, neutral pose (all deltas zero)', pad * 2 + W);
    g.drawImage(glCanvas, pad * 2 + W, 50);
    label('DIFFERENCE x4', pad * 3 + W * 2);
    g.putImageData(diff, pad * 3 + W * 2, 50);
    label('game scale: source', pad * 4 + W * 3);
    g.imageSmoothingQuality = 'high';
    g.drawImage(source, pad * 4 + W * 3, 50, gw, gh);
    label('rig', pad * 5 + W * 3 + gw);
    g.drawImage(game, pad * 5 + W * 3 + gw, 50);
    g.font = '15px system-ui';
    g.fillText(JSON.stringify(numbers), pad, H + 64);
    result.numbers = numbers;
    log.textContent = JSON.stringify(numbers, null, 2);
    result.done = true;
    return;
  }

  // ---- Clip.
  const S = Number(query.get('s') ?? 133),
    game = S < 200,
    width = game ? 964 : Math.round(S * 2.6),
    height = game ? 542 : Math.round(S * 2.25),
    place = { x: width * (game ? 0.45 : 0.42), y: height - (game ? 70 : 0.16 * S), scale: S };
  glCanvas.width = width;
  glCanvas.height = height;
  host.width = width;
  host.height = height;
  const gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true })!,
    delta = createDeltaView(gl, rig, p, { frame: rest, camera: CAMERA }),
    profile = createCharacterView(gl, character),
    g = host.getContext('2d')!;
  let lastKind = '';
  function drawFrame(n: number, target: CanvasRenderingContext2D = g, labels = true): Record<string, unknown> {
    const frame = frameAt(n),
      { phase } = poseAt(n),
      angle = (viewAngleOf(facing(frame.yaw.pelvis), CAMERA, project as ProjectFn) * 180) / Math.PI,
      kind = angle < SWITCH_AT ? 'side' : 'threeQuarterFront';
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    let feet: Record<string, unknown>;
    if (kind === 'side') {
      if (lastKind !== 'side') profile.reset();
      profile.draw(frame, CAMERA, place);
      const d = profile.debug!;
      feet = { L: d.feet.L.heel, R: d.feet.R.heel };
    } else {
      // Soft contact shadow, as the profile poser draws one.
      delta.draw(frame, CAMERA, place);
      const d = delta.debug!;
      feet = { L: d.feet.L.heel, R: d.feet.R.heel, offsetL: d.feet.L.offset, offsetR: d.feet.R.offset, stretch: d.ikStretch };
    }
    const switched = lastKind !== '' && lastKind !== kind;
    lastKind = kind;
    target.fillStyle = BACKGROUND;
    target.fillRect(0, 0, width, height);
    target.fillStyle = 'rgba(0,0,0,0.10)';
    target.fillRect(0, place.y, width, 1);
    target.drawImage(glCanvas, 0, 0);
    if (labels) {
      target.fillStyle = '#111';
      target.font = `bold ${game ? 13 : 15}px system-ui`;
      target.fillText('SYNTHETIC FRAMES (authored 3D joints, not the animator)', 10, 18);
      target.font = `${game ? 12 : 14}px system-ui`;
      target.fillText(`doug | drawing: ${kind === 'side' ? 'side profile (drawn)' : 'three-quarter front (drawn; overlap under the arm and hems is derived)'}`, 10, 36);
      target.fillText(`${phase} | frame ${n} | view angle ${angle.toFixed(1)} deg`, 10, 54);
      if (switched || (kind === 'side' && n < 520 && angle > SWITCH_AT - 4)) {
        target.fillStyle = '#a01818';
        target.fillText('HARD SWITCH to the profile drawing (no dissolve)', 10, 72);
      }
    }
    return { n, phase, angle, kind, feet, switched, joints: kind === 'side' ? null : delta.debug!.joints };
  }
  result.length = LENGTH;
  result.size = [width, height];
  result.draw = (n: number) => {
    const info = drawFrame(n);
    return { info, png: host.toDataURL('image/png') };
  };
  /** Tiles of the take: every `step`-th frame, cropped to `box` (canvas px), `zoom`ed, `columns` per row. */
  result.sheet = (from: number, to: number, step: number, box: [number, number, number, number], zoom: number, columns: number, follow?: string) => {
    const frames: number[] = [];
    for (let n = from; n < to; n += step) frames.push(n);
    const tile = document.createElement('canvas'),
      tw = Math.round(box[2] * zoom),
      th = Math.round(box[3] * zoom),
      out = document.createElement('canvas'),
      scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    tile.width = tw;
    tile.height = th;
    out.width = tw * columns;
    out.height = (th + 16) * Math.ceil(frames.length / columns);
    const og = out.getContext('2d')!,
      sg = scratch.getContext('2d')!;
    og.fillStyle = BACKGROUND;
    og.fillRect(0, 0, out.width, out.height);
    og.imageSmoothingEnabled = zoom !== 2;
    lastKind = '';
    if (from > 0) drawFrame(from - 1, sg, false);
    frames.forEach((n, i) => {
      const info = drawFrame(n, sg, false) as { joints: Record<string, [number, number]> | null; kind: string; switched: boolean },
        x = (i % columns) * tw,
        y = Math.floor(i / columns) * (th + 16);
      let bx = box[0],
        by = box[1];
      if (follow && info.joints?.[follow]) {
        bx = info.joints[follow][0] - box[2] / 2;
        by = info.joints[follow][1] - box[3] / 2;
      }
      og.drawImage(scratch, bx, by, box[2], box[3], x, y, tw, th);
      og.fillStyle = info.kind === 'side' ? '#1a4d9a' : '#111';
      og.font = '11px system-ui';
      og.fillText(`f${n}${info.kind === 'side' ? ' PROFILE' : ''}`, x + 3, y + th + 12);
      og.strokeStyle = 'rgba(0,0,0,0.2)';
      og.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
    });
    return out.toDataURL('image/png');
  };
  drawFrame(Number(query.get('n') ?? 0));
  result.place = place;
  result.done = true;
}
