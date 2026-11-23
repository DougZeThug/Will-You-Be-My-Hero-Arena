// Torture sheet for a re-cut rig: the bind pose checked against the source
// drawing, then a grid of extreme single-joint and combined poses. This is the
// visual acceptance surface for the rig, not an animation.
//   /torture.html?c=doug   &s=0.36 (scale)  &bones=1  &flip=1  &only=<label text>[,<more>]
import { loadRig, RigRenderer, Skeleton } from './rig/index';
import type { Rig } from './rig/index';

declare const __REPOSITORY__: string;

/** Angles in degrees, in body terms (positive = the named direction). */
interface PoseSpec {
  label: string;
  hipNear?: number; // flexion (thigh forward)
  hipFar?: number;
  kneeNear?: number; // flexion (heel towards the seat)
  kneeFar?: number;
  ankleNear?: number; // toes up
  ankleFar?: number;
  pelvis?: number; // forward tilt
  spine?: number; // forward hinge, spread over the three spine bones
  neck?: number;
  head?: number; // nod forward
  armFar?: number; // swing forward
  elbowFar?: number;
  wristFar?: number;
  armNear?: number;
  elbowNear?: number;
  wristNear?: number;
  shoulder?: [number, number]; // near shoulder, % of body height: forward, up
  shoulderFar?: [number, number];
  hand?: 'grip' | 'open' | 'relaxed';
  rootY?: number; // % of body height, down
}

const POSES: PoseSpec[] = [
  { label: 'bind' },
  { label: 'stride A: near hip +40, far hip -35', hipNear: 40, hipFar: -35, kneeNear: 10, kneeFar: 15 },
  { label: 'stride B: near hip -35, far hip +40', hipNear: -35, hipFar: 40, kneeNear: 15, kneeFar: 10 },
  { label: 'near hip +40', hipNear: 40 },
  { label: 'near hip -35', hipNear: -35 },
  { label: 'far hip +40', hipFar: 40 },
  { label: 'far hip -35', hipFar: -35 },
  { label: 'legs crossed: near +20, far -10', hipNear: 20, hipFar: -10 },
  { label: 'near knee 45', kneeNear: 45 },
  { label: 'near knee 90', kneeNear: 90 },
  { label: 'far knee 90', kneeFar: 90 },
  { label: 'high knee: near hip 70, knee 90', hipNear: 70, kneeNear: 90 },
  { label: 'far high knee: hip 70, knee 90', hipFar: 70, kneeFar: 90 },
  { label: 'ankle roll: near toes up 25, far toes down 30', ankleNear: 25, ankleFar: -30 },
  { label: 'ankle roll: near toes down 30, far toes up 25', ankleNear: -30, ankleFar: 25 },
  { label: 'heel strike / toe off', hipNear: 30, kneeNear: 5, ankleNear: 20, hipFar: -25, kneeFar: 30, ankleFar: -30 },
  { label: 'spine forward 30, head counter -25', spine: 30, head: -25 },
  { label: 'spine back 10, head forward 15', spine: -10, head: 15 },
  { label: 'head back -25', head: -25 },
  { label: 'head forward +25, neck 10', head: 25, neck: 10 },
  { label: 'pelvis tilt +15, spine -15', pelvis: 15, spine: -15 },
  { label: 'far arm +45', armFar: 45 },
  { label: 'far arm -45', armFar: -45 },
  { label: 'far arm +45, elbow 60', armFar: 45, elbowFar: 60 },
  { label: 'far arm +90, wrist 30', armFar: 90, wristFar: 30 },
  { label: 'throw arm back-swing -70', armNear: -70 },
  { label: 'throw arm forward +50', armNear: 50 },
  { label: 'throw arm forward +100', armNear: 100 },
  { label: 'throw arm overhead +160', armNear: 160 },
  { label: 'elbow 50', elbowNear: 50 },
  { label: 'elbow 100', elbowNear: 100 },
  { label: 'back-swing -70, elbow 40, wrist -30', armNear: -70, elbowNear: 40, wristNear: -30 },
  { label: 'hand open', hand: 'open' },
  { label: 'hand relaxed', hand: 'relaxed' },
  { label: 'hand open, arm +60, wrist 40', hand: 'open', armNear: 60, wristNear: 40 },
  { label: 'shoulder protracted +3%', shoulder: [3, 0] },
  { label: 'shoulder retracted -3%', shoulder: [-3, 0] },
  { label: 'shoulder elevated +3%', shoulder: [0, 3] },
  { label: 'shoulder lead: +3% fwd, 2% up, arm -40', shoulder: [3, 2], armNear: -40 },
  { label: 'far shoulder +3% fwd, arm +30', shoulderFar: [3, 0], armFar: 30 },
  {
    label: 'walk contact',
    hipNear: 28, kneeNear: 6, ankleNear: 12, hipFar: -22, kneeFar: 22, ankleFar: -22,
    armNear: -24, elbowNear: 12, armFar: 26, elbowFar: 18, spine: 4, head: -3,
  },
  {
    label: 'walk passing',
    hipNear: 2, kneeNear: 4, hipFar: 26, kneeFar: 62, ankleFar: -8,
    armNear: 4, armFar: -4, spine: 3,
  },
  {
    label: 'throw: back-swing',
    hipNear: -12, kneeNear: 18, hipFar: 26, kneeFar: 24, spine: 16, head: -12,
    armNear: -68, elbowNear: 14, wristNear: -20, shoulder: [-2.5, 0.5], armFar: 38, elbowFar: 30, rootY: 1.5,
  },
  {
    label: 'throw: release',
    hipNear: -24, kneeNear: 24, ankleNear: -18, hipFar: 30, kneeFar: 30, spine: 8, head: -6,
    armNear: 62, elbowNear: 12, wristNear: 18, shoulder: [3, 1.5], armFar: -30, elbowFar: 20,
    hand: 'open', rootY: 2,
  },
  {
    label: 'squat: hips 65, knees 110',
    hipNear: 65, hipFar: 70, kneeNear: 110, kneeFar: 110, ankleNear: 30, ankleFar: 30,
    spine: 24, head: -18, armNear: 50, armFar: 50, rootY: 17,
  },
];

const radians = (degrees: number) => (degrees * Math.PI) / 180;

function applyPose(skeleton: Skeleton, spec: PoseSpec): void {
  const data = skeleton.rig.data,
    // Forward swing of a hanging limb is anticlockwise for a rig facing +x.
    limb = -data.meta.facing,
    upright = data.meta.facing,
    height = data.meta.heightPx,
    turn = (bone: string, direction: number, degrees = 0) =>
      skeleton.rotate(bone, direction * radians(degrees));
  skeleton.reset();
  turn('thigh_near', limb, spec.hipNear);
  turn('thigh_far', limb, spec.hipFar);
  turn('shin_near', -limb, spec.kneeNear);
  turn('shin_far', -limb, spec.kneeFar);
  turn('foot_near', limb, spec.ankleNear);
  turn('foot_far', limb, spec.ankleFar);
  turn('pelvis', upright, spec.pelvis);
  for (const bone of ['spine_lower', 'spine_mid', 'chest'])
    turn(bone, upright, (spec.spine ?? 0) / 3);
  turn('neck', upright, spec.neck);
  turn('head', upright, spec.head);
  turn('upper_arm_far', limb, spec.armFar);
  turn('forearm_far', limb, spec.elbowFar);
  turn('hand_far', limb, spec.wristFar);
  turn('upper_arm_near', limb, spec.armNear);
  turn('forearm_near', limb, spec.elbowNear);
  turn('hand_near', limb, spec.wristNear);
  const shift = (bone: string, by?: [number, number]) => {
    if (by)
      skeleton.translate(
        bone,
        (data.meta.facing * by[0] * height) / 100,
        (-by[1] * height) / 100,
      );
  };
  shift('clavicle_near', spec.shoulder);
  shift('clavicle_far', spec.shoulderFar);
  skeleton.translate('root', 0, ((spec.rootY ?? 0) * height) / 100);
  skeleton.update();
}

const query = new URLSearchParams(location.search),
  id = query.get('c') ?? 'doug',
  scale = Number(query.get('s') ?? 0.36),
  flip = query.get('flip') === '1',
  showBones = query.get('bones') === '1',
  only = query.get('only'),
  report = document.getElementById('report')!;

const CELL = { width: 1300, height: 1500, columns: 6, ground: 70, background: '#6f8f7a' };

function drawSheet(rig: Rig): void {
  const wanted = only?.split(',') ?? [],
    poses = only ? POSES.filter((pose) => wanted.some((text) => pose.label.includes(text))) : POSES,
    width = Math.round(CELL.width * scale),
    height = Math.round(CELL.height * scale),
    columns = Math.min(CELL.columns, poses.length),
    sheet = document.getElementById('sheet') as HTMLCanvasElement,
    cell = document.createElement('canvas');
  cell.width = width;
  cell.height = height;
  sheet.width = width * columns;
  sheet.height = height * Math.ceil(poses.length / columns);
  const gl = cell.getContext('webgl', { preserveDrawingBuffer: true, antialias: true })!,
    renderer = new RigRenderer(gl, rig),
    skeleton = new Skeleton(rig),
    context = sheet.getContext('2d')!,
    point = { x: 0, y: 0 },
    rootX = width * (flip ? 0.6 : 0.4),
    rootY = height - CELL.ground * scale;
  gl.viewport(0, 0, width, height);
  poses.forEach((pose, k) => {
    applyPose(skeleton, pose);
    renderer.show('hand', `hand_${pose.hand ?? 'grip'}`);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.draw(skeleton, { x: rootX, y: rootY, scale, flip });
    const x = (k % columns) * width,
      y = Math.floor(k / columns) * height;
    context.fillStyle = CELL.background;
    context.fillRect(x, y, width, height);
    context.fillStyle = '#5d7a67';
    context.fillRect(x, y + rootY, width, height - rootY);
    context.drawImage(cell, x, y);
    context.strokeStyle = '#2b3138';
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    context.fillStyle = '#10151a';
    context.font = `${Math.max(11, Math.round(34 * scale))}px system-ui, sans-serif`;
    context.fillText(`${k}. ${pose.label}`, x + 8, y + Math.max(14, 40 * scale));
    if (showBones) {
      context.strokeStyle = '#00e5ff';
      context.fillStyle = '#ffea00';
      const sign = flip ? -1 : 1;
      for (const bone of rig.data.bones) {
        skeleton.jointWorld(bone.name, point);
        const ax = x + rootX + sign * point.x * scale,
          ay = y + rootY + point.y * scale;
        skeleton.tipWorld(bone.name, point);
        context.beginPath();
        context.moveTo(ax, ay);
        context.lineTo(x + rootX + sign * point.x * scale, y + rootY + point.y * scale);
        context.stroke();
        context.fillRect(ax - 2, ay - 2, 4, 4);
      }
      context.fillStyle = '#ff3d81';
      for (const socket of rig.data.sockets) {
        skeleton.socketWorld(socket.name, point);
        context.fillRect(x + rootX + sign * point.x * scale - 2, y + rootY + point.y * scale - 2, 4, 4);
      }
    }
  });
}

/** Bind pose at 1:1 over the key colour, compared with the source drawing in
 * the body region. The throwing arm and hand are hidden: the source body is
 * drawn with an empty sleeve. */
async function compareBind(rig: Rig) {
  const meta = rig.data.meta,
    source = new Image();
  source.src = `/@fs/${__REPOSITORY__}/${meta.inputs[0].path}`;
  await source.decode();
  const size = { width: source.width, height: source.height },
    reference = document.createElement('canvas');
  Object.assign(reference, size);
  const referenceContext = reference.getContext('2d', { willReadFrequently: true })!;
  referenceContext.drawImage(source, 0, 0);
  const expected = referenceContext.getImageData(0, 0, size.width, size.height).data,
    stage = document.createElement('canvas');
  Object.assign(stage, size);
  const gl = stage.getContext('webgl', { preserveDrawingBuffer: true, antialias: false })!,
    renderer = new RigRenderer(gl, rig),
    skeleton = new Skeleton(rig);
  for (const part of rig.data.parts)
    if (part.name === 'arm_near' || part.group === 'hand') renderer.setVisible(part.name, false);
  gl.viewport(0, 0, size.width, size.height);
  gl.clearColor(expected[0] / 255, expected[1] / 255, expected[2] / 255, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  renderer.draw(skeleton, { x: meta.sheetOrigin[0], y: meta.sheetOrigin[1], scale: 1 });
  const actual = new Uint8Array(size.width * size.height * 4);
  gl.readPixels(0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, actual);
  const [x0, y0, x1, y1] = meta.bodyBox as number[],
    exclude = meta.sleeveCutBox as number[],
    out = document.getElementById('bind') as HTMLCanvasElement,
    boxWidth = x1 - x0 + 1,
    boxHeight = y1 - y0 + 1;
  out.width = boxWidth * 3;
  out.height = boxHeight;
  const context = out.getContext('2d')!,
    heat = context.createImageData(boxWidth, boxHeight),
    stats = { pixels: 0, sum: 0, over16: 0, over48: 0, max: 0 },
    outside = { pixels: 0, sum: 0, over16: 0, over48: 0, max: 0 };
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const e = (y * size.width + x) * 4,
        a = ((size.height - 1 - y) * size.width + x) * 4;
      let worst = 0,
        total = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(expected[e + c] - actual[a + c]);
        worst = Math.max(worst, d);
        total += d;
      }
      // The source background is not one flat colour: compare the drawing only
      // (the shipped hard key rule decides what is drawing).
      const isKey =
        expected[e] > 110 &&
        expected[e + 2] > 100 &&
        expected[e + 1] < Math.min(expected[e], expected[e + 2]) * 0.7;
      if (isKey && worst <= 48) continue;
      const inSleeve = x >= exclude[0] && x <= exclude[2] && y >= exclude[1] && y <= exclude[3];
      for (const bucket of inSleeve ? [stats] : [stats, outside]) {
        bucket.pixels++;
        bucket.sum += total / 3;
        if (worst > 16) bucket.over16++;
        if (worst > 48) bucket.over48++;
        bucket.max = Math.max(bucket.max, worst);
      }
      const h = ((y - y0) * boxWidth + (x - x0)) * 4,
        level = Math.min(255, worst * 4);
      heat.data[h] = level;
      heat.data[h + 1] = worst > 48 ? 0 : level;
      heat.data[h + 2] = worst > 48 ? 0 : level;
      heat.data[h + 3] = 255;
    }
  context.drawImage(reference, x0, y0, boxWidth, boxHeight, 0, 0, boxWidth, boxHeight);
  const flipped = document.createElement('canvas');
  Object.assign(flipped, size);
  flipped.getContext('2d')!.drawImage(stage, 0, 0);
  context.drawImage(flipped, x0, y0, boxWidth, boxHeight, boxWidth, 0, boxWidth, boxHeight);
  context.putImageData(heat, boxWidth * 2, 0);
  const summary = (bucket: typeof stats) => ({
    pixels: bucket.pixels,
    meanAbsDiff: Number((bucket.sum / bucket.pixels).toFixed(3)),
    over16Percent: Number(((100 * bucket.over16) / bucket.pixels).toFixed(3)),
    over48Percent: Number(((100 * bucket.over48) / bucket.pixels).toFixed(3)),
    max: bucket.max,
  });
  return { bodyBox: summary(stats), outsideSleeveBox: summary(outside) };
}

async function main() {
  const rig = await loadRig(`./rigs/${id}/rig.json`);
  drawSheet(rig);
  const bind = await compareBind(rig);
  report.textContent =
    `${id}: ${rig.data.parts.length} parts, ${rig.data.bones.length} bones. ` +
    `Bind vs source (0-255): ${JSON.stringify(bind)}\n` +
    'Below the sheet: source | bind render (throwing arm hidden) | difference x4 (red = over 48).';
  Object.assign(window, { __torture: { done: true, bind, poses: POSES.map((pose) => pose.label) } });
}

main().catch((error) => {
  report.textContent = String(error);
  Object.assign(window, { __torture: { done: true, error: String(error) } });
});
