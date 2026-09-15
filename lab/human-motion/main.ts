import * as Phaser from 'phaser';
import { MotionScene } from './MotionScene';
import { proofEvents, type ProofEvent } from './MotionSession';
import { FrameTelemetry } from '../../lib/arena/engine/core/FrameTelemetry';
import {
  importReference,
  retargetReference,
  retargetMotion,
} from '../../lib/arena/engine/motion-tools/ReferenceMotion';
import type { Intent } from '../../lib/arena/engine/input/InputActions';
import { motionReview } from './MotionReview';
import { installReviewTake } from './ReviewTake';
import { referenceComparison } from './ReferenceComparison';
import { defaultReference, referenceCatalog } from './ReferenceCatalog';
import { workshopControls } from './WorkshopControls';
const get = <T = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;
const params = new URLSearchParams(location.search),
  candidate = params.get('event') ?? 'cornhole';
const event: ProofEvent =
  candidate in proofEvents ? (candidate as ProofEvent) : 'cornhole';
const stage = get<HTMLDivElement>('stage'),
  scene = new MotionScene(event, stage);
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  width: 1280,
  height: 760,
  parent: stage,
  backgroundColor: '#282820',
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [scene],
  render: { antialias: true },
  fps: { target: 60, smoothStep: false },
});
const telemetry = new FrameTelemetry(game);
const review = motionReview(scene);
const comparison = referenceComparison(scene, game);
let pendingSeek: number | null = null,
  pendingResume = false;
const replay = (time: number, playing = false) => {
  if (!Number.isFinite(time) || time < 0 || time > 12)
    throw Error('Review seek accepts 0–12 seconds');
  pendingSeek = time;
  pendingResume = playing;
  scene.ready = false;
  scene.scene.restart();
};
const workshop = workshopControls(scene, replay);
scene.onAdvance = workshop.tick;
let lastDetailedReport = -Infinity;
const report = () => {
  if (!scene.ready) return;
  const selected = scene.session.actors.find(
    (a) => a.id === get<HTMLSelectElement>('review-character').value,
  );
  const clipTime =
    selected?.planner.graph.get('action')?.time ??
    selected?.planner.graph.get('base')?.time ??
    0;
  get('clock').textContent =
    `Scene ${scene.session.time.toFixed(3)}s · Clip ${clipTime.toFixed(3)}s · ${scene.rate}×`;
  get('reference-status').textContent = scene.reference
    ? `${scene.reference.samples.length} measured frames loaded`
    : 'No reference loaded';
  get<HTMLInputElement>('timeline').value = String(scene.session.time);
  // Keep the clock responsive while expensive diagnostic tables refresh at
  // 2 Hz during playback. Paused inspection and manual stepping stay exact.
  if (!scene.session.paused && performance.now() - lastDetailedReport < 500)
    return;
  lastDetailedReport = performance.now();
  const s = scene.session.snapshot();
  get('summary').textContent = s.actors
    .map(
      (a) =>
        `${a.id.toUpperCase()} · ${a.phase} · ${a.graph.map((g) => g.id + ' ' + g.time.toFixed(2)).join(' / ')}\nvelocity ${a.motor.velocity.x.toFixed(1)}px/s · grounded ${a.motor.grounded} · native starts ${a.rig.starts} / ticks ${a.rig.ticks} · score ${a.score} · health ${a.health}\ncontacts ${a.rig.feet.map((f) => f.foot + ': ' + f.maxSlide.toFixed(2) + 'px' + (f.warning ? ' ⚠' : '')).join(', ')}`,
    )
    .join('\n\n');
  review.update();
};
scene.onState = report;
scene.onReady = report;
const reset = () => {
  location.href = './?event=' + get<HTMLSelectElement>('event').value;
};
get<HTMLSelectElement>('event').value = event;
get('event').onchange = reset;
get('reset').onclick = reset;
const resume = () => {
  workshop.ready();
  scene.session.pause(false);
  telemetry.setMode('realtime');
  stage.focus();
};
get('play').onclick = resume;
get('pause').onclick = () => {
  scene.session.pause(true, false);
  telemetry.setMode('manual');
  report();
};
get('step').onclick = () => {
  scene.session.pause(true, false);
  scene.session.step(1 / 60);
  scene.renderState();
  report();
};
get('speed').onchange = () => {
  scene.rate = Number(get<HTMLSelectElement>('speed').value);
};
const initialRate = Number(params.get('rate') ?? 1);
if ([0.25, 0.5, 1].includes(initialRate)) {
  scene.rate = initialRate;
  get<HTMLSelectElement>('speed').value = String(initialRate);
}
get('device').onchange = () => {
  scene.device(
    get<HTMLSelectElement>('device').value as 'ai' | 'keyboard' | 'gamepad',
  );
};
get('skeleton').onchange = () => {
  scene.overlay = get<HTMLInputElement>('skeleton').checked;
  scene.renderState();
};
get('trails').onchange = () => {
  scene.trails = get<HTMLInputElement>('trails').checked;
  scene.renderState();
};
get('silhouette').onchange = () => {
  scene.session.actors.forEach((a) =>
    a.animator.setSilhouette(get<HTMLInputElement>('silhouette').checked),
  );
  scene.renderState();
};
// Seeking replays a fresh AI baseline, not an untracked hardware history. Never runs live side effects twice.
get('timeline').onchange = () => {
  const t = Number(get<HTMLInputElement>('timeline').value);
  replay(t);
};
const download = () => {
  const blob = new Blob([JSON.stringify(scene.session.snapshot(), null, 2)], {
      type: 'application/json',
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = 'arena-human-motion-' + event + '.json';
  a.click();
  URL.revokeObjectURL(url);
};
get('download').onclick = download;
get('reference').onchange = async () => {
  try {
    const file = get<HTMLInputElement>('reference').files?.[0];
    if (!file) return;
    if (file.size > 24_000_000) throw Error('Reference exceeds 24MB');
    scene.reference = importReference(JSON.parse(await file.text()));
    report();
    scene.renderState();
  } catch (e) {
    get('error').textContent = String(e);
  }
};
get('offset').onchange = () => {
  scene.referenceOffset = Number(get<HTMLInputElement>('offset').value) || 0;
  scene.renderState();
};
get('demo-reference').onclick = async () => {
  try {
    const selected =
      referenceCatalog.find(
        (r) => r.id === get<HTMLSelectElement>('reference-choice').value,
      ) ?? defaultReference(event);
    const response = await fetch(selected.data);
    if (!response.ok) throw Error('Could not load measured reference');
    scene.reference = importReference(await response.json());
    report();
    scene.overlay = true;
    get<HTMLInputElement>('skeleton').checked = true;
    scene.renderState();
  } catch (e) {
    get('error').textContent = String(e);
  }
};
get('retarget-overlay').onchange = () => {
  scene.retargetOverlay = get<HTMLInputElement>('retarget-overlay').checked;
  scene.renderState();
};
get('export-reference').onclick = () => {
  try {
    if (!scene.reference) throw Error('Load a reference first');
    const actor = scene.session.actors[0];
    const proposal = retargetMotion(
      scene.reference,
      actor.animator.pose(scene.session.time, actor.motor).joints,
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(proposal, null, 2)], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dan-motion-proposal.json';
    link.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    get('error').textContent = String(e);
  }
};
window.addEventListener('blur', () => {
  if (scene.ready) scene.session.pause(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && scene.ready) scene.session.pause(true);
});
const api = Object.freeze({
  version: 2,
  catalog: () => Object.keys(proofEvents),
  soles: (character: string) => {
    const a = scene.session.actors.find((a) => a.id === character);
    if (!a) throw Error('Unknown character');
    return a.animator.soleVertices();
  },
  clips: (character: string) => {
    const a = scene.session.actors.find((a) => a.id === character);
    if (!a) throw Error('Unknown character');
    return structuredClone(a.animator.library.metadata);
  },
  getState: () =>
    scene.ready
      ? { ...scene.session.snapshot(), presentation: scene.hud.snapshot() }
      : { ready: false },
  exportRig: (character: string) => {
    const actor = scene.session.actors.find((a) => a.id === character);
    if (!actor) throw Error('Unknown character');
    return actor.animator.exportAuthoring();
  },
  getPerformance: () => telemetry.snapshot(),
  workshop: () => workshop.snapshot(),
  seek: (time: number) => replay(time),
  comparison: () => comparison.snapshot(),
  curves: (character: string) => {
    const a = scene.session.actors.find((a) => a.id === character);
    if (!a) throw Error('Unknown character');
    return a.analyzer.curveSnapshot();
  },
  pause: () => scene.session.pause(true, false),
  resume,
  step: (s: number) => {
    scene.session.pause(true, false);
    scene.session.step(s);
    scene.renderState();
    report();
  },
  input: (
    id: string,
    intent: Intent,
    value: number | { x: number; y: number },
  ) => scene.session.inject(id, intent, value),
  setRate: (rate: number) => {
    if (![0.25, 0.5, 1].includes(rate))
      throw Error('Allowed speed: .25 / .5 / 1');
    scene.rate = rate;
  },
  view: (options: {
    skeleton?: boolean;
    trails?: boolean;
    silhouette?: boolean;
    balance?: boolean;
    velocity?: boolean;
    collisions?: boolean;
    equipment?: boolean;
    focus?: 'arena' | 'dan' | 'doug';
  }) => {
    if (options.skeleton !== undefined) scene.overlay = options.skeleton;
    if (options.trails !== undefined) scene.trails = options.trails;
    if (options.balance !== undefined) scene.balanceView = options.balance;
    if (options.velocity !== undefined) scene.velocityView = options.velocity;
    if (options.collisions !== undefined)
      scene.collisionView = options.collisions;
    if (options.equipment !== undefined)
      scene.equipmentView = options.equipment;
    if (options.focus !== undefined) scene.focus = options.focus;
    if (options.silhouette !== undefined)
      scene.session.actors.forEach((a) =>
        a.animator.setSilhouette(options.silhouette!),
      );
    scene.renderState();
  },
  reference: (data: unknown) => {
    scene.reference = importReference(data);
    scene.renderState();
    return {
      samples: scene.reference.samples.length,
      warnings: scene.reference.warnings,
    };
  },
  retarget: (character: string, index: number) => {
    const a = scene.session.actors.find((a) => a.id === character),
      sample = scene.reference?.samples[index];
    if (!a || !sample) throw Error('Load reference and valid sample');
    return retargetReference(
      sample,
      a.animator.pose(scene.session.time, a.motor).joints,
    );
  },
});
Object.defineProperty(window, '__HERO_MOTION__', {
  value: api,
  configurable: true,
});
scene.onReady = () => {
  review.initialize();
  const take = params.get('take');
  if (take)
    installReviewTake(
      scene.session,
      params.get('actor') === 'doug' ? 'doug' : 'dan',
      take,
    );
  const seek = pendingSeek ?? Number(params.get('seek') ?? 0);
  if (seek > 0 && seek <= 12) scene.session.step(seek);
  workshop.ready();
  if (pendingResume) scene.session.pause(false);
  pendingSeek = null;
  pendingResume = false;
  scene.renderState();
  report();
};
window.addEventListener('error', (e) => {
  get('error').textContent = e.message;
});
