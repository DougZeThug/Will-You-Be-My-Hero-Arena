// Landmark tool for a new character sheet: click the joints in a guided
// order, adjust by dragging, export prototype/motion/characters/<id>.json.
// Joint names and the JSON shape match the shipped *_authoring.json files, so
// prep/build.mjs reads a marked character exactly like Dan and Doug.
//   /prep/mark.html                     start empty
//   /prep/mark.html?c=doug              load an existing config to inspect it
declare const __REPOSITORY__: string;

type XY = [number, number];
interface Step {
  key: string;
  help: string;
  polygon?: boolean;
}

const side = (s: 'L' | 'R', who: string): Step[] => [
  { key: `hip_${s}`, help: `${who} hip joint (top of the thigh, under the shorts)` },
  { key: `knee_${s}`, help: `${who} knee centre` },
  { key: `ankle_${s}`, help: `${who} ankle centre` },
  { key: `ball_${s}`, help: `${who} ball of the foot (end of the foot bone)` },
  { key: `heel_${s}`, help: `${who} heel, where it meets the ground` },
  { key: `toe_${s}`, help: `${who} toe tip, where it meets the ground` },
];
const STEPS: Step[] = [
  { key: 'root', help: 'Ground point under the body (between the feet, on the floor line)' },
  { key: 'pelvis', help: 'Pelvis: centre of the hips' },
  { key: 'spine_lower', help: 'Lower spine: waist' },
  { key: 'spine_mid', help: 'Mid spine: bottom of the ribcage' },
  { key: 'chest', help: 'Chest: mid torso at armpit height' },
  { key: 'neck', help: 'Neck base' },
  { key: 'head', help: 'Head pivot: where the skull sits on the neck' },
  { key: 'skull_center', help: 'Centre of the skull' },
  { key: 'clavicle_L', help: 'THROWING side: inner end of the collarbone (near the neck)' },
  { key: 'shoulder_L', help: 'THROWING shoulder joint, inside the empty sleeve' },
  { key: 'elbow_L', help: 'Where the throwing elbow should hang in the rest pose' },
  { key: 'wrist_L', help: 'Where the throwing wrist should sit in the rest pose' },
  { key: 'hand_end_L', help: 'End of the throwing hand bone (knuckles), level with the wrist' },
  { key: 'throwing_hand', help: 'Palm centre of the throwing hand (where a held object sits)' },
  { key: 'clavicle_R', help: 'OFF side: inner end of the collarbone' },
  { key: 'shoulder_R', help: 'Off shoulder joint (it may be hidden: estimate at the chest edge)' },
  { key: 'elbow_R', help: 'Off elbow' },
  { key: 'wrist_R', help: 'Off wrist' },
  { key: 'off_hand', help: 'Off hand: finger knuckles (end of the hand bone)' },
  ...side('L', 'THROWING-side leg:'),
  ...side('R', 'OFF-side leg:'),
  { key: 'arm_shoulder', help: 'SEPARATE ARM drawing: its shoulder joint' },
  { key: 'arm_elbow', help: 'Separate arm: elbow' },
  { key: 'arm_wrist', help: 'Separate arm: wrist (at the cut end)' },
  { key: 'wrist_grip', help: 'GRIP hand drawing: wrist crease centre' },
  { key: 'wrist_open', help: 'OPEN hand drawing: wrist crease centre' },
  { key: 'wrist_relaxed', help: 'RELAXED hand drawing: wrist crease centre' },
  {
    key: 'sleeveBoundary',
    polygon: true,
    help: 'Outline of the throwing-side SLEEVE cloth, including its opening. Cut straight through the shirt at the top and front. Enter closes it.',
  },
  {
    key: 'sleeveOpening',
    polygon: true,
    help: 'Outline of the sleeve OPENING only (the hole the arm comes out of); it may extend below the sleeve. Enter closes it.',
  },
];

const points: Record<string, XY> = {},
  polygons: Record<string, XY[]> = {},
  canvas = document.getElementById('view') as HTMLCanvasElement,
  context = canvas.getContext('2d')!,
  list = document.getElementById('steps')!,
  hint = document.getElementById('hint')!,
  field = (name: string) => document.getElementById(name) as HTMLInputElement,
  json = document.getElementById('json') as HTMLTextAreaElement,
  image = new Image(),
  view = { x: 0, y: 0, zoom: 1 };
let current = 0,
  dragging: { key: string; index?: number } | null = null,
  panning: XY | null = null;

const toImage = (event: MouseEvent): XY => {
  const box = canvas.getBoundingClientRect();
  return [
    (event.clientX - box.left - view.x) / view.zoom,
    (event.clientY - box.top - view.y) / view.zoom,
  ];
};
const rounded = ([x, y]: XY): XY => [Math.round(x), Math.round(y)];
const isDone = (step: Step) =>
  step.polygon ? (polygons[step.key]?.length ?? 0) >= 3 : points[step.key] !== undefined;

function draw(): void {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  context.fillStyle = '#20252b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(view.zoom, 0, 0, view.zoom, view.x, view.y);
  context.imageSmoothingEnabled = view.zoom < 2;
  if (image.width) context.drawImage(image, 0, 0);
  const line = (a?: XY, b?: XY) => {
    if (!a || !b) return;
    context.beginPath();
    context.moveTo(a[0], a[1]);
    context.lineTo(b[0], b[1]);
    context.stroke();
  };
  context.lineWidth = 2 / view.zoom;
  context.strokeStyle = '#00e5ff';
  const chains = [
    ['root', 'pelvis', 'spine_lower', 'spine_mid', 'chest', 'neck', 'head', 'skull_center'],
    ['clavicle_L', 'shoulder_L', 'elbow_L', 'wrist_L', 'hand_end_L'],
    ['clavicle_R', 'shoulder_R', 'elbow_R', 'wrist_R', 'off_hand'],
    ['hip_L', 'knee_L', 'ankle_L', 'ball_L', 'toe_L'],
    ['hip_R', 'knee_R', 'ankle_R', 'ball_R', 'toe_R'],
    ['ankle_L', 'heel_L'],
    ['ankle_R', 'heel_R'],
    ['arm_shoulder', 'arm_elbow', 'arm_wrist'],
  ];
  for (const chain of chains)
    for (let k = 0; k + 1 < chain.length; k++) line(points[chain[k]], points[chain[k + 1]]);
  context.strokeStyle = '#ff7ad9';
  for (const polygon of Object.values(polygons))
    polygon.forEach((p, k) => line(p, polygon[(k + 1) % polygon.length]));
  const radius = 4 / view.zoom;
  context.font = `${11 / view.zoom}px system-ui, sans-serif`;
  const dot = (p: XY, label: string, active: boolean) => {
    context.fillStyle = active ? '#ffe36e' : '#ffffff';
    context.strokeStyle = '#000000';
    context.beginPath();
    context.arc(p[0], p[1], radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (label) context.fillText(label, p[0] + radius * 1.5, p[1] - radius);
  };
  for (const [key, p] of Object.entries(points)) dot(p, key, STEPS[current]?.key === key);
  for (const [key, polygon] of Object.entries(polygons))
    polygon.forEach((p, k) => dot(p, k ? '' : key, STEPS[current]?.key === key));
  context.setTransform(1, 0, 0, 1, 0, 0);
  list.innerHTML = '';
  STEPS.forEach((step, k) => {
    const item = document.createElement('li');
    item.textContent = step.key;
    item.className = k === current ? 'current' : isDone(step) ? 'done' : '';
    item.onclick = () => {
      current = k;
      draw();
    };
    list.appendChild(item);
  });
  hint.textContent = STEPS[current]
    ? `${current + 1}/${STEPS.length}: ${STEPS[current].help}`
    : 'All points placed. Drag to adjust, then download the config.';
}

/** The character config that prep/build.mjs reads (landmarks inline). */
function exportConfig() {
  const p = (key: string) => {
    const [x, y] = rounded(points[key] ?? [0, 0]);
    return { x, y };
  };
  const joint = (name: string, parent: string | undefined, point: string, end?: string) => ({
    name,
    ...(parent ? { parent } : {}),
    point: p(point),
    ...(end ? { end: p(end) } : {}),
  });
  const leg = (s: 'L' | 'R') => [
    joint(`thigh_${s}`, 'pelvis', `hip_${s}`, `knee_${s}`),
    joint(`shin_${s}`, `thigh_${s}`, `knee_${s}`, `ankle_${s}`),
    joint(`foot_${s}`, `shin_${s}`, `ankle_${s}`, `ball_${s}`),
    joint(`heel_${s}`, `foot_${s}`, `heel_${s}`),
    joint(`toe_${s}`, `foot_${s}`, `toe_${s}`),
  ];
  return {
    id: field('id').value.trim(),
    source: field('source').value.trim(),
    landmarks: {
      sourceDimensions: [image.width, image.height],
      origin: p('root'),
      joints: [
        joint('root', undefined, 'root'),
        joint('pelvis', 'root', 'pelvis', 'spine_lower'),
        joint('spine_lower', 'pelvis', 'spine_lower', 'spine_mid'),
        joint('spine_mid', 'spine_lower', 'spine_mid', 'chest'),
        joint('chest', 'spine_mid', 'chest', 'neck'),
        joint('neck', 'chest', 'neck', 'head'),
        joint('head', 'neck', 'head', 'skull_center'),
        joint('skull_center', 'head', 'skull_center'),
        joint('clavicle_L', 'chest', 'clavicle_L', 'shoulder_L'),
        joint('upper_arm_L', 'clavicle_L', 'shoulder_L', 'elbow_L'),
        joint('forearm_L', 'upper_arm_L', 'elbow_L', 'wrist_L'),
        joint('hand_L', 'forearm_L', 'wrist_L', 'hand_end_L'),
        joint('throwing_hand', 'hand_L', 'throwing_hand'),
        joint('clavicle_R', 'chest', 'clavicle_R', 'shoulder_R'),
        joint('upper_arm_R', 'clavicle_R', 'shoulder_R', 'elbow_R'),
        joint('forearm_R', 'upper_arm_R', 'elbow_R', 'wrist_R'),
        joint('hand_R', 'forearm_R', 'wrist_R', 'off_hand'),
        joint('off_hand', 'hand_R', 'off_hand'),
        ...leg('L'),
        ...leg('R'),
      ],
      registration: {
        armJoints: ['arm_shoulder', 'arm_elbow', 'arm_wrist'].map((key) => rounded(points[key] ?? [0, 0])),
        wrists: ['wrist_grip', 'wrist_open', 'wrist_relaxed'].map((key) => rounded(points[key] ?? [0, 0])),
        sleeveBoundary: (polygons.sleeveBoundary ?? []).map(rounded),
        sleeveOpening: (polygons.sleeveOpening ?? []).map(rounded),
      },
    },
    hints: { nearSide: 'L' },
  };
}

interface Landmarks {
  joints: { name: string; point: { x: number; y: number }; end?: { x: number; y: number } }[];
  registration: Record<string, XY[]>;
}

function importLandmarks(landmarks: Landmarks): void {
  const joints = Object.fromEntries(landmarks.joints.map((j) => [j.name, j]));
  const set = (key: string, name: string, which: 'point' | 'end' = 'point') => {
    const value = joints[name]?.[which];
    if (value) points[key] = [value.x, value.y];
  };
  for (const name of ['root', 'pelvis', 'spine_lower', 'spine_mid', 'chest', 'neck', 'head', 'skull_center', 'throwing_hand', 'off_hand', 'clavicle_L', 'clavicle_R', 'heel_L', 'heel_R', 'toe_L', 'toe_R'])
    set(name, name);
  for (const s of ['L', 'R']) {
    set(`shoulder_${s}`, `upper_arm_${s}`);
    set(`elbow_${s}`, `forearm_${s}`);
    set(`wrist_${s}`, `hand_${s}`);
    set(`hip_${s}`, `thigh_${s}`);
    set(`knee_${s}`, `shin_${s}`);
    set(`ankle_${s}`, `foot_${s}`);
    set(`ball_${s}`, `foot_${s}`, 'end');
  }
  set('hand_end_L', 'hand_L', 'end');
  const { armJoints, wrists, sleeveBoundary, sleeveOpening } = landmarks.registration;
  ['arm_shoulder', 'arm_elbow', 'arm_wrist'].forEach((key, k) => (points[key] = armJoints[k]));
  ['wrist_grip', 'wrist_open', 'wrist_relaxed'].forEach((key, k) => (points[key] = wrists[k]));
  polygons.sleeveBoundary = sleeveBoundary.map((p) => [p[0], p[1]] as XY);
  polygons.sleeveOpening = sleeveOpening.map((p) => [p[0], p[1]] as XY);
  current = STEPS.length;
}

async function loadImage(url: string): Promise<void> {
  image.src = url;
  await image.decode();
  view.zoom = Math.min(canvas.clientWidth / image.width, canvas.clientHeight / image.height);
  view.x = view.y = 0;
  draw();
}

async function importConfig(config: { id?: string; source?: string; landmarks?: Landmarks | string }) {
  field('id').value = config.id ?? field('id').value;
  field('source').value = config.source ?? '';
  let landmarks = config.landmarks;
  if (typeof landmarks === 'string')
    landmarks = (await (await fetch(`/@fs/${__REPOSITORY__}/${landmarks}`)).json()) as Landmarks;
  if (landmarks) importLandmarks(landmarks);
  if (config.source) await loadImage(`/@fs/${__REPOSITORY__}/${config.source}`);
  draw();
}

function nearest(at: XY): { key: string; index?: number } | null {
  const reach = 8 / view.zoom;
  for (const [key, p] of Object.entries(points))
    if (Math.hypot(p[0] - at[0], p[1] - at[1]) <= reach) return { key };
  for (const [key, polygon] of Object.entries(polygons))
    for (let index = 0; index < polygon.length; index++)
      if (Math.hypot(polygon[index][0] - at[0], polygon[index][1] - at[1]) <= reach)
        return { key, index };
  return null;
}

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0) {
    panning = [event.clientX - view.x, event.clientY - view.y];
    return;
  }
  const at = toImage(event);
  dragging = nearest(at);
  if (dragging) return;
  const step = STEPS[current];
  if (!step) return;
  if (step.polygon) (polygons[step.key] ??= []).push(at);
  else {
    points[step.key] = at;
    current++;
  }
  draw();
});
window.addEventListener('mousemove', (event) => {
  if (panning) {
    view.x = event.clientX - panning[0];
    view.y = event.clientY - panning[1];
  } else if (dragging) {
    const at = toImage(event);
    if (dragging.index === undefined) points[dragging.key] = at;
    else polygons[dragging.key][dragging.index] = at;
  } else return;
  draw();
});
window.addEventListener('mouseup', () => {
  dragging = null;
  panning = null;
});
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const box = canvas.getBoundingClientRect(),
      factor = event.deltaY < 0 ? 1.2 : 1 / 1.2,
      mx = event.clientX - box.left,
      my = event.clientY - box.top;
    view.x = mx - (mx - view.x) * factor;
    view.y = my - (my - view.y) * factor;
    view.zoom *= factor;
    draw();
  },
  { passive: false },
);
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'Enter' && STEPS[current]?.polygon && isDone(STEPS[current])) current++;
  else if (event.key === 'Backspace') document.getElementById('undo')!.click();
  else return;
  draw();
});
document.getElementById('undo')!.onclick = () => {
  const step = STEPS[current];
  if (step?.polygon && polygons[step.key]?.length) polygons[step.key].pop();
  else if (current > 0) {
    current--;
    const previous = STEPS[current];
    if (previous.polygon) polygons[previous.key]?.pop();
    else delete points[previous.key];
  }
  draw();
};
document.getElementById('load')!.onclick = () =>
  void loadImage(`/@fs/${__REPOSITORY__}/${field('source').value.trim()}`);
field('file').onchange = () => {
  const file = field('file').files?.[0];
  if (file) void loadImage(URL.createObjectURL(file));
};
document.getElementById('export')!.onclick = () => {
  const config = exportConfig(),
    text = `${JSON.stringify(config, null, 2)}\n`,
    link = document.createElement('a');
  json.value = text;
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = `${config.id}.json`;
  link.click();
};
document.getElementById('import')!.onclick = () => void importConfig(JSON.parse(json.value));
window.addEventListener('resize', draw);

const preset = new URLSearchParams(location.search).get('c');
if (preset)
  void fetch(`../characters/${preset}.json`)
    .then((response) => response.json())
    .then((config) => importConfig(config as Parameters<typeof importConfig>[0]));
draw();
Object.assign(window, { __mark: { exportConfig, steps: STEPS.map((step) => step.key) } });
