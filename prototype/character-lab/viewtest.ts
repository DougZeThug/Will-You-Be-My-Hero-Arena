// Iteration tool for the drawn-views half: drives the 2.5D poser with synthetic
// Frames and lays the results out as labelled contact sheets.
//   /viewtest.html?c=doug&sheet=turntable&s=330     (s = pixels per metre; 133 = game scale)
// `window.__viewtest` carries { done, error, log, tests } for the capture tool.
import { project, viewAngle } from './core/camera';
import { facing, viewAngleOf, type ProjectFn, type Proportions, type ViewCamera, type ViewFrame } from './views/contract';
import { createCharacterView, loadCharacterRigs, POSER, type PoserDebug } from './views/poser';
import { alterProportions, buildFrame, rad, type Pose } from './views/synthetic';

interface Cell {
  label: string;
  pose?: Pose;
  /** Camera yaw, deg. */
  cam?: number;
  proportions?: Proportions;
  /** Frames drawn in order before the shot (steps 1 apart), to show hysteresis and dissolves. */
  lead?: { pose: Pose; cam?: number }[];
  /** Keep the previous cell's view state (a continuous strip). */
  continuous?: boolean;
  /** Steps skipped before this cell (lets a dissolve finish). */
  gap?: number;
  note?: (debug: PoserDebug) => string;
}
interface Sheet {
  title: string;
  columns: number;
  cells: Cell[];
  cell?: [number, number]; // metres wide, tall
}

const query = new URLSearchParams(location.search),
  id = query.get('c') ?? 'doug',
  sheetName = query.get('sheet') ?? 'turntable',
  S = Number(query.get('s') ?? 330),
  PITCH = (8 * Math.PI) / 180,
  result: { done: boolean; error?: string; log: string[]; tests: { name: string; pass: boolean; detail: string }[] } = { done: false, log: [], tests: [] };
(window as unknown as { __viewtest: typeof result }).__viewtest = result;

const WALK: Pose[] = [
  { legL: { swing: 28, knee: 8 }, legR: { swing: -22, knee: 14, foot: 25 }, armL: { forward: -24, elbow: 18 }, armR: { forward: 26, elbow: 30 } },
  { legL: { swing: 8, knee: 4 }, legR: { swing: 12, knee: 62, foot: 30 }, armL: { forward: -6, elbow: 14 }, armR: { forward: 8, elbow: 22 } },
  { legL: { swing: -22, knee: 14, foot: 25 }, legR: { swing: 28, knee: 8 }, armL: { forward: 26, elbow: 30 }, armR: { forward: -24, elbow: 18 } },
  { legL: { swing: 12, knee: 62, foot: 30 }, legR: { swing: 8, knee: 4 }, armL: { forward: 8, elbow: 22 }, armR: { forward: -6, elbow: 14 } },
];
// Character yaw (deg) that gives a view angle at camera yaw 0: view = -yaw.
const VIEWS: [string, number][] = [['front', -90], ['3/4 front', -45], ['side', 0], ['3/4 back', 45], ['back', 90], ['side (left)', 180]];
const stretch = (names: string[]) => (d: PoserDebug) =>
  names.map((n) => (d.along[n] ? `${n} x${d.along[n].scale.toFixed(2)}${d.along[n].clamped ? ' CLAMPED' : ''}` : '')).join(' ');

function sheets(p: Proportions): Record<string, Sheet> {
  const each = (poses: [string, Pose][], views = VIEWS): Cell[] =>
    poses.flatMap(([name, pose]) => views.map(([view, yaw]) => ({ label: `${name} | ${view}`, pose: { ...pose, yaw: yaw + (pose.yaw ?? 0) } })));
  const altered = alterProportions(p, { legs: 1.12, torso: 0.9, shoulders: 0.9 });
  return {
    turntable: {
      title: 'Neutral stance, camera every 15 deg (character faces +Z)',
      columns: 8,
      cells: Array.from({ length: 24 }, (_, i) => ({ label: `cam ${i * 15}`, cam: i * 15, pose: {} })),
    },
    turn: {
      title: 'Turn in place, 10 deg steps (continuous view state with hysteresis; 8 steps between cells so each dissolve has finished)',
      columns: 12,
      cells: Array.from({ length: 37 }, (_, i) => ({ label: `yaw ${-90 + i * 10}`, pose: { yaw: -90 + i * 10 }, continuous: i > 0, gap: 8 })),
    },
    orbit: {
      title: 'Camera orbit around a still character, 10 deg steps (continuous)',
      columns: 12,
      cells: Array.from({ length: 37 }, (_, i) => ({ label: `cam ${i * 10}`, cam: i * 10, pose: {}, continuous: i > 0, gap: 8 })),
    },
    walk: {
      title: 'Walk-like poses at view angles 0, 45, 90, 135, 180 (and back)',
      columns: 6,
      cells: WALK.flatMap((pose, k) =>
        [0, 45, 90, 135, 180, -90].map((view) => ({ label: `walk ${k} | view ${view}`, pose: { ...pose, yaw: -view } })),
      ),
    },
    reach: {
      title: 'Arm reaches (right arm): forward, up, across the body, behind',
      columns: 6,
      cell: [1.5, 2.3],
      cells: each([
        ['forward', { armR: { forward: 90, elbow: 5, hand: 'open', palm: 'down' } }],
        ['up', { armR: { forward: 175, elbow: 5, hand: 'open', palm: 'forward' } }],
        ['across', { armR: { forward: 60, out: -55, elbow: 50, hand: 'open', palm: 'in' } }],
        ['behind', { armR: { forward: -45, elbow: 10 } }],
      ]),
    },
    foreshorten: {
      title: `Right arm swinging up toward the camera (front view). Along-bone scale floor = ${POSER.minAlong}`,
      columns: 7,
      cell: [1.3, 2.1],
      cells: [0, 30, 50, 65, 75, 85, 90].map((a): Cell => ({
        label: `arm ${a} deg toward camera`,
        pose: { yaw: -90, armR: { forward: a, elbow: 0, hand: 'open', palm: 'down' } },
        note: stretch(['upperArmR', 'forearmR']),
      })).concat(
        [0, 30, 50, 65, 75, 85, 90].map((a): Cell => ({
          label: `thigh ${a} deg toward camera`,
          pose: { yaw: -90, legR: { swing: a, knee: a } },
          note: stretch(['thighR', 'shinR']),
        })),
      ),
    },
    poses: {
      title: 'Deep knee bend, trunk lean, trunk twist 30, head turn 60',
      columns: 6,
      cells: each([
        ['knee bend', { legL: { swing: 62, knee: 118 }, legR: { swing: 62, knee: 118 }, pitch: 22, armL: { forward: 35, elbow: 30 }, armR: { forward: 35, elbow: 30 } }],
        ['lean 30', { pitch: 30 }],
        ['twist +30', { twist: 30 }],
        ['head +60', { headTurn: 60 }],
        ['head -60', { headTurn: -60 }],
      ]),
    },
    hands: {
      title: 'Palm and bag orientation (right hand, elbow bent 90): palm up / down / in / forward / back, gripping the bag',
      columns: 6,
      cell: [1.4, 2.1],
      cells: each(
        (['up', 'down', 'in', 'forward', 'back'] as const).map((palm): [string, Pose] => [
          `grip palm ${palm}`,
          { armR: { forward: 10, elbow: 80, hand: 'grip', palm }, bag: 'R' } as Pose,
        ]).concat((['up', 'down', 'in'] as const).map((palm): [string, Pose] => [`open palm ${palm}`, { armR: { forward: 10, elbow: 80, hand: 'open', palm } } as Pose])),
      ).map((cell) => ({ ...cell, note: (d: PoserDebug) => `${d.hands.R.art}${d.hands.R.mirrored ? ' mirrored' : ''} palm->cam ${d.hands.R.palmToCamera.toFixed(2)}` })),
    },
    layering: {
      title: 'Which limb is in front: arms across the chest / behind the back, legs crossing',
      columns: 6,
      cell: [1.4, 2.1],
      cells: each([
        ['R arm across chest', { armR: { forward: 55, out: -60, elbow: 70 } }],
        ['L arm across chest', { armL: { forward: 55, out: -60, elbow: 70 } }],
        ['both arms behind', { armL: { forward: -35, out: -10, elbow: 30 }, armR: { forward: -35, out: -10, elbow: 30 } }],
        ['R leg crossing L', { legR: { swing: 25, out: -18, knee: 10 }, legL: { swing: -10 } }],
      ]).map((cell) => ({ ...cell, note: (d: PoserDebug) => `near arm ${d.nearArm}, near leg ${d.nearLeg}` })),
    },
    dissolve: {
      title: `View change (profile -> front art) frame by frame: turning 1 deg per step across the ${POSER.frontFrom + POSER.hysteresis} deg boundary; ${POSER.dissolveSteps}-step dissolve`,
      columns: 10,
      cells: Array.from({ length: 10 }, (_, i): Cell => ({
        label: `view ${44 + i}`,
        pose: { yaw: -(44 + i), ...WALK[0] },
        continuous: i > 0,
        lead: i === 0 ? [{ pose: { yaw: -30, ...WALK[0] } }] : undefined,
        note: (d: PoserDebug) => `trunk ${d.blocks.trunk.kind} t=${d.blocks.trunk.fading.toFixed(2)}`,
      })),
    },
    proportions: {
      title: 'Same drawings, altered skeleton: legs +12%, torso -10%, shoulders -10% (right of each pair)',
      columns: 8,
      cells: VIEWS.slice(0, 4).flatMap(([view, yaw]) => [
        { label: `${view} | measured`, pose: { yaw, ...WALK[0] } },
        { label: `${view} | altered`, pose: { yaw, ...WALK[0] }, proportions: altered },
      ]),
    },
    squash: {
      title: 'Root-level squash and stretch (0.85 / 1 / 1.12), front and side',
      columns: 6,
      cells: [-90, 0].flatMap((yaw) => [0.85, 1, 1.12].map((squash) => ({ label: `squash ${squash}`, pose: { yaw, squash } }))),
    },
  };
}

/** INTERFACE.md's known-angle test, on the helpers the poser actually uses. */
function knownAngles(projectFn: ProjectFn): void {
  const cam: ViewCamera = { yaw: 0, pitch: PITCH },
    deg = (v: { x: number; y: number; z: number }, c = cam) => (viewAngleOf(v, c, projectFn) * 180) / Math.PI,
    near = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) < 0.01,
    check = (name: string, got: number, want: number) => result.tests.push({ name, pass: near(got, want), detail: `view angle ${got.toFixed(2)} deg, expected ${want}` });
  check('facing +Z at camYaw 0 is front', deg({ x: 0, y: 0, z: 1 }), 90);
  check('facing +X is side (screen-right)', deg({ x: 1, y: 0, z: 0 }), 0);
  check('facing -Z is back', deg({ x: 0, y: 0, z: -1 }), -90);
  check('facing -X is side mirrored', deg({ x: -1, y: 0, z: 0 }), 180);
  check('facing(yaw -90 deg) is +Z (front)', deg(facing(rad(-90))), 90);
  check('facing(yaw 0) is +X (side)', deg(facing(0)), 0);
  check('facing(yaw +90 deg) is -Z (back)', deg(facing(rad(90))), -90);
  for (const [yaw, camYaw] of [[-90, 0], [20, 75], [140, -200], [-33, 310]])
    check(`poser angle equals core viewAngle (yaw ${yaw}, cam ${camYaw})`, deg(facing(rad(yaw)), { yaw: rad(camYaw), pitch: PITCH }), (viewAngle(rad(yaw), rad(camYaw)) * 180) / Math.PI);
  const a = rad(35);
  check('orbiting the camera by +a equals turning the character by -a', deg(facing(rad(-90)), { yaw: a, pitch: PITCH }), deg(facing(rad(-90) - a)));
}

async function main(): Promise<void> {
  const character = await loadCharacterRigs('./rigs', id),
    all = sheets(character.proportions),
    nav = document.getElementById('nav')!;
  nav.innerHTML = ['doug', 'dan'].map((c) => Object.keys(all).map((name) => `<a href="?c=${c}&sheet=${name}&s=${S}">${c}:${name}</a>`).join('')).join('<br>');
  knownAngles(project as ProjectFn);
  const sheet = all[sheetName];
  if (!sheet) throw new Error(`no sheet ${sheetName}`);
  const [mw, mh] = sheet.cell ?? [1.15, 2.1],
    cw = Math.round(mw * S),
    ch = Math.round(mh * S) + 34,
    rows = Math.ceil(sheet.cells.length / sheet.columns),
    out = document.getElementById('sheet') as HTMLCanvasElement,
    scratch = document.createElement('canvas');
  scratch.width = cw;
  scratch.height = ch;
  out.width = cw * sheet.columns;
  out.height = ch * rows + 26;
  const gl = scratch.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true })!,
    view = createCharacterView(gl, character),
    g = out.getContext('2d')!;
  g.fillStyle = '#cfc6b4';
  g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#222';
  g.font = 'bold 14px system-ui';
  g.fillText(`${id} | ${sheet.title} | ${S} px/m (${Math.round(S * 1.73)} px tall)`, 8, 17);
  let step = 0;
  const feetLog: string[] = [];
  let previous: PoserDebug | null = null;
  sheet.cells.forEach((cell, i) => {
    const shoot = (pose: Pose, camDeg: number) => {
      const frame: ViewFrame = buildFrame(cell.proportions ?? character.proportions, pose, step++),
        camera: ViewCamera = { yaw: rad(camDeg), pitch: PITCH };
      gl.viewport(0, 0, cw, ch);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Keep the world origin's ground point at a fixed spot of the cell.
      view.draw(frame, camera, { x: cw / 2, y: ch - 34 - 0.12 * S, scale: S });
    };
    if (!cell.continuous) {
      view.reset();
      step += 100;
    }
    step += cell.gap ?? 0;
    for (const lead of cell.lead ?? []) shoot(lead.pose, lead.cam ?? 0);
    shoot(cell.pose ?? {}, cell.cam ?? 0);
    const x = (i % sheet.columns) * cw,
      y = 26 + Math.floor(i / sheet.columns) * ch,
      debug = view.debug!;
    g.drawImage(scratch, x, y);
    g.strokeStyle = 'rgba(0,0,0,0.15)';
    g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    const standIn = debug.blocks.trunk.standIn;
    g.font = '11px system-ui';
    g.fillStyle = '#111';
    g.fillText(cell.label, x + 4, y + ch - 22);
    g.fillStyle = standIn ? '#a01818' : '#1a6b2a';
    g.fillText((standIn ? 'STAND-IN ' : 'drawn ') + `${debug.blocks.trunk.canonical} <- ${debug.blocks.trunk.kind}${debug.blocks.trunk.mirrored ? ' (mirrored)' : ''}`, x + 4, y + ch - 9);
    if (debug.blocks.head.kind !== debug.blocks.trunk.kind || debug.blocks.head.standIn !== standIn) {
      g.fillStyle = debug.blocks.head.standIn ? '#a01818' : '#1a6b2a';
      g.fillText(`head: ${debug.blocks.head.standIn ? 'STAND-IN ' : ''}${debug.blocks.head.kind}`, x + 4, y + 12);
    }
    if (cell.note) {
      g.fillStyle = '#123a7a';
      g.fillText(cell.note(debug), x + 4, y + 24);
    }
    // Foot log: drawn heel against the projected heel, and across view boundaries.
    const line = (['L', 'R'] as const)
      .map((s) => {
        const f = debug.feet[s];
        return `${s} heel drawn (${f.heel[0].toFixed(2)}, ${f.heel[1].toFixed(2)}) projected (${f.projectedHeel[0].toFixed(2)}, ${f.projectedHeel[1].toFixed(2)}) d=${Math.hypot(f.heel[0] - f.projectedHeel[0], f.heel[1] - f.projectedHeel[1]).toFixed(3)}px`;
      })
      .join(' | ');
    const boundary = previous && cell.continuous && (['legL', 'legR', 'trunk'] as const).some((b) => previous!.blocks[b].kind !== debug.blocks[b].kind);
    feetLog.push(`${boundary ? '>> VIEW CHANGE ' : '   '}${cell.label}: legs ${debug.blocks.legL.kind}/${debug.blocks.legR.kind} trunk ${debug.blocks.trunk.kind} | ${line}`);
    previous = debug;
  });
  // Same frame, two drawings: reach the 43 deg view from the profile side and
  // from the front side of the hysteresis band and compare the drawn feet.
  const probe = (from: number) => {
    view.reset();
    step += 100;
    for (const yaw of [from, -43]) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      view.draw(buildFrame(character.proportions, { yaw }, step++), { yaw: 0, pitch: PITCH }, { x: cw / 2, y: ch - 60, scale: S });
    }
    return view.debug!;
  };
  const asProfile = probe(-30),
    asFront = probe(-60);
  for (const s of ['L', 'R'] as const) {
    const a = asProfile.feet[s],
      b = asFront.feet[s],
      d = Math.hypot(a.heel[0] - b.heel[0], a.heel[1] - b.heel[1]);
    result.tests.push({
      name: `planted foot ${s}: same frame drawn as ${asProfile.blocks[`leg${s}`].kind} and as ${asFront.blocks[`leg${s}`].kind}`,
      pass: d < 0.01 && asProfile.blocks[`leg${s}`].kind !== asFront.blocks[`leg${s}`].kind,
      detail: `drawn heel moves ${d.toFixed(4)} px; drawn toe moves ${Math.hypot(a.toe[0] - b.toe[0], a.toe[1] - b.toe[1]).toFixed(2)} px (different drawings of the shoe)`,
    });
  }
  result.log = feetLog;
  document.getElementById('log')!.textContent =
    result.tests.map((t) => `${t.pass ? 'PASS' : 'FAIL'} ${t.name}: ${t.detail}`).join('\n') + '\n\n' + feetLog.join('\n');
}

main()
  .catch((error: Error) => {
    result.error = error.stack ?? error.message;
    document.getElementById('log')!.textContent = result.error;
  })
  .finally(() => (result.done = true));
