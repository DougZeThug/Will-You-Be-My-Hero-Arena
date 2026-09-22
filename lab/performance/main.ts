import * as Phaser from 'phaser';
import { PerformanceScene } from './PerformanceScene';
import { performanceProfiles } from '../../lib/arena/engine/performance/PerformanceProfiles';
import { verifyRig } from '../loongbones/arena/provider';
import { performanceDefinitions } from './definitions';
import './style.css';
import { bindTuning } from './Tuning';
const element = <T = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;
const select = (id: string) => element<HTMLSelectElement>(id);
const reportBootstrapFailure = (reason: unknown) => {
  element('status').textContent = `Performance failed: ${String(reason)}`;
};
window.addEventListener('error', (event) =>
  reportBootstrapFailure(event.error),
);
window.addEventListener('unhandledrejection', (event) =>
  reportBootstrapFailure(event.reason),
);
const scene = new PerformanceScene();
const query = new URLSearchParams(location.search);
if (query.get('character') === 'dan') {
  scene.selected = 'dan';
  scene.profile = { ...performanceProfiles.dan };
  select('character').value = 'dan';
}
await Promise.all(performanceDefinitions.map(verifyRig));
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  width: 1280,
  height: 760,
  scene: [scene],
  audio: { noAudio: true },
  antialias: true,
  fps: { target: 60 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
const profile = element<HTMLTextAreaElement>('profile');
const tuning = bindTuning(
  element('tuning'),
  () => scene.profile,
  (value) =>
    safe(() => {
      scene.applyProfile(value);
      controls();
    }),
);
const filesLifetime = new AbortController();
let lastEvents = '';
function refresh() {
  if (!scene.ready) return;
  const state = scene.snapshot();
  const release = state.playback?.release?.time;
  const contact = state.playback?.contactAt;
  element('status').textContent =
    `${scene.selected === 'doug' ? 'Doug' : 'Dan'} · ${state.performance.state} · ${state.playing ? 'Playing' : 'Paused'}`;
  element('time').textContent = `${state.elapsed.toFixed(2)}s`;
  element<HTMLInputElement>('timeline').value = String(state.elapsed);
  element('result').textContent =
    scene.action !== 'cornholeThrow'
      ? 'Isolated character action'
      : state.playback?.resultRevealed
        ? `Recorded ${state.playback.contact} · ${state.playback.points} points · release ${release?.toFixed(2)}s · contact ${contact?.toFixed(2)}s · not saved`
        : `Recorded cornhole · ${contact !== null && contact !== undefined ? 'contact made' : release !== undefined ? 'bag in flight' : 'preparing'}`;
  const text = state.performance.events.map(
    (e) => `${e.time.toFixed(3)}  ${e.name}${e.detail ? ' · ' + e.detail : ''}`,
  );
  const key = text.join('\n');
  if (lastEvents !== key) {
    element('events').replaceChildren(
      ...text
        .slice()
        .reverse()
        .map((t) => {
          const li = document.createElement('li');
          li.textContent = t;
          return li;
        }),
    );
    lastEvents = key;
  }
  element('checks').textContent = [
    `Runtime: ${state.rig.runtimeRevision}`,
    `Native states started: ${state.rig.starts}`,
    `Pose updates: ${state.rig.ticks}`,
    `Clock difference: ${(state.rig.maxNativeDrift * 1000).toFixed(3)} ms`,
    `Arm registration: ${state.rig.correctedVertices} vertices${state.rig.armCorrectionRecipe ? ` · ${state.rig.armCorrectionRecipe}` : ''}`,
    ...state.rig.limbs
      .slice(0, 2)
      .map(
        (l) =>
          `${l.id}: length ${l.lengthRatio.toFixed(3)}× · width ${l.widthRatio?.toFixed(3)}×`,
      ),
    `Foot drift: ${Math.max(...state.rig.feet.map((f) => f.error)).toFixed(3)} px`,
    `Chest contact error: ${state.rig.chestContactError.toFixed(3)} px`,
    `Frame p95: ${state.frameTiming.p95?.toFixed(1) ?? '—'} ms (${state.frameTiming.samples} running frames)`,
    ...(state.rig.warnings.length
      ? state.rig.warnings
      : ['No current constraint warnings']),
  ].join('\n');
  if (element('snapshot').parentElement?.hasAttribute('open'))
    element('snapshot').textContent = JSON.stringify(state, null, 2);
}
function controls() {
  profile.value = JSON.stringify(scene.profile, null, 2);
  tuning.refresh(scene.profile);
  select('character').value = scene.selected;
  select('action').value = scene.action;
  select('outcome').value = scene.outcome;
  const phase = select('phase');
  phase.replaceChildren(new Option('Choose a state', ''));
  for (const checkpoint of scene.checkpoints())
    phase.add(new Option(checkpoint.name, String(checkpoint.time)));
  refresh();
}
function safe(fn: () => void) {
  try {
    fn();
    element('profile-error').textContent = '';
  } catch (error) {
    element('profile-error').textContent = String(error);
  }
  refresh();
}
for (const [id, fn] of Object.entries({
  play: () => {
    scene.playing = true;
  },
  pause: () => {
    scene.playing = false;
  },
  restart: () => {
    scene.reset();
    controls();
  },
  step: () => {
    scene.playing = false;
    scene.step(1 / 60);
  },
  apply: () => {
    scene.applyProfile(JSON.parse(profile.value));
    controls();
  },
  defaults: () => {
    scene.applyProfile(performanceProfiles[scene.selected as 'dan' | 'doug']);
    controls();
  },
  export: () => {
    const file = new Blob([JSON.stringify(scene.profile, null, 2) + '\n'], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scene.selected}-performance-candidate.json`;
    link.click();
    URL.revokeObjectURL(url);
  },
}))
  element(id).addEventListener('click', () => safe(fn));
element<HTMLInputElement>('import-profile').addEventListener(
  'change',
  async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 16000)
        throw Error('Profile JSON must be smaller than 16 KB');
      const candidate = JSON.parse(await file.text());
      // reset validates before disposing the current rig; invalid files preserve it.
      scene.reset({ character: candidate.id, profile: candidate });
      scene.playing = false;
      controls();
      element('profile-error').textContent = '';
    } catch (error) {
      element('profile-error').textContent = String(error);
    } finally {
      input.value = '';
    }
  },
  { signal: filesLifetime.signal },
);
for (const id of ['character', 'action', 'outcome'])
  select(id).addEventListener('change', () =>
    safe(() => {
      scene.reset({
        character: select('character').value,
        action: select('action').value,
        outcome: select('outcome').value as 'success' | 'board' | 'miss',
      });
      controls();
    }),
  );
select('phase').addEventListener('change', () =>
  safe(() => {
    if (select('phase').value !== '') scene.seek(Number(select('phase').value));
  }),
);
select('speed').addEventListener('change', () => {
  scene.rate = Number(select('speed').value);
});
element<HTMLInputElement>('loop').addEventListener('change', (e) => {
  scene.loop = (e.target as HTMLInputElement).checked;
});
element<HTMLInputElement>('timeline').addEventListener('change', (e) =>
  safe(() => scene.seek(Number((e.target as HTMLInputElement).value))),
);
element<HTMLInputElement>('audio').addEventListener('change', (e) =>
  scene.setAudio((e.target as HTMLInputElement).checked),
);
for (const key of Object.keys(scene.view) as (keyof typeof scene.view)[])
  element<HTMLInputElement>(key).addEventListener('change', (e) => {
    scene.view[key] = (e.target as HTMLInputElement).checked;
    scene.refreshView();
    refresh();
  });
scene.onReady = controls;
const refreshTimer = setInterval(refresh, 200);
// Frozen development facade: copies out; only bounded semantic operations in.
const api = Object.freeze({
  version: 1,
  get ready() {
    return scene.ready;
  },
  getState: () => scene.snapshot(),
  catalog: () => ({
    characters: ['doug', 'dan'],
    actions: [...scene.controller.actions.keys()],
    checkpoints: scene.checkpoints(),
  }),
  pause: () => {
    scene.playing = false;
  },
  play: () => {
    scene.playing = true;
  },
  step: (seconds: number) => {
    scene.playing = false;
    scene.step(seconds);
    refresh();
  },
  seek: (seconds: number) => {
    scene.seek(seconds);
    refresh();
  },
  load: (
    character: 'doug' | 'dan',
    outcome: 'success' | 'board' | 'miss' = 'success',
  ) => {
    scene.playing = false;
    scene.reset({ character, outcome });
    select('character').value = character;
    select('outcome').value = outcome;
    controls();
  },
  perform: (action: string) => scene.controller.perform(action),
  applyProfile: (profile: unknown) => {
    scene.applyProfile(profile);
    controls();
  },
});
export type PerformanceLabApi = typeof api;
Object.defineProperty(window, '__HERO_PERFORMANCE__', {
  value: api,
  configurable: true,
});
window.addEventListener(
  'pagehide',
  () => {
    clearInterval(refreshTimer);
    tuning.destroy();
    filesLifetime.abort();
    game.destroy(true);
  },
  { once: true },
);
