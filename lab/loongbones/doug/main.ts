import * as Phaser from 'phaser';
import { RigReviewScene } from '../arena/RigReviewScene';
import { danDefinition, dougDefinition } from '../arena/definitions';
import { sideDefinitions } from '../side-rig/definitions';
const query = new URLSearchParams(location.search);
const character = query.get('character') === 'dan' ? 'dan' : 'doug';
const definition =
  query.get('version') === '2'
    ? character === 'dan'
      ? danDefinition
      : dougDefinition
    : sideDefinitions.find((d) => d.id === character)!;
const characterSelect = document.getElementById(
  'character',
) as unknown as HTMLSelectElement;
characterSelect.value = definition.id;
characterSelect.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('character', characterSelect.value);
  location.href = url.href;
});
(document.getElementById('import-pack') as HTMLAnchorElement).href =
  query.get('version') === '2'
    ? `../assets/cornhole-motion-v2/${definition.id}-motion-v2-import.zip`
    : `../assets/cornhole-side-v3/${definition.id}-side-v3-import.zip`;
import { verifyRig } from '../arena/provider';
const status = document.querySelector<HTMLOutputElement>('#status')!,
  select = document.getElementById('clip') as unknown as HTMLSelectElement;
await verifyRig(definition).catch((error) => {
  status.textContent = String(error);
  throw error;
});
document.querySelector('h1')!.textContent =
  (definition.id === 'dan' ? 'Dan' : 'Doug') + ' · cornhole motion';
const scene = new RigReviewScene(definition);
const speedSelect = document.getElementById(
  'speed',
) as unknown as HTMLSelectElement;
const phaseSelect = document.getElementById(
  'phase',
) as unknown as HTMLSelectElement;
let shownClip = '';
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
const refresh = () => {
  if (!scene.ready) return;
  const state = scene.snapshot();
  if (shownClip !== state.clip) {
    phaseSelect.replaceChildren(new Option('Choose pose landmark', ''));
    for (const p of state.landmarks)
      phaseSelect.add(
        new Option(`${p.name} · ${p.seconds.toFixed(3)}s`, String(p.seconds)),
      );
    phaseSelect.disabled = !state.landmarks.length;
    shownClip = state.clip;
  }
  const phase =
    state.landmarks.findLast((p) => p.seconds <= state.seconds)?.name ?? 'idle';
  status.textContent = `${definition.id === 'dan' ? 'Dan' : 'Doug'} · ${state.clip} · ${phase} · ${state.seconds.toFixed(3)}s · ${state.playbackRate}× · ${state.playing ? 'Playing' : 'Paused'}`;
  const { pose, ...small } = state;
  document.querySelector('#state')!.textContent = JSON.stringify(
    { ...small, bones: pose.bones },
    null,
    2,
  );
};
scene.onReady = () => {
  for (const clip of scene.rig.debugInfo().authoredClips as string[])
    select.add(new Option(clip, clip));
  select.value = scene.clipName;
  const requested = query.get('clip');
  if (
    requested &&
    Array.from(select.options).some((o) => o.value === requested)
  ) {
    scene.reset(requested);
    select.value = requested;
  }
  refresh();
};
for (const [id, fn] of Object.entries({
  play: () => {
    scene.playing = true;
  },
  pause: () => {
    scene.playing = false;
  },
  reset: () => {
    scene.playing = false;
    scene.reset(select.value);
  },
  step: () => {
    scene.playing = false;
    scene.step(1 / 60);
  },
}))
  document.getElementById(id)!.addEventListener('click', () => {
    if (scene.ready) {
      fn();
      refresh();
    }
  });
select.addEventListener('change', () => {
  scene.reset(select.value);
  refresh();
});
speedSelect.addEventListener('change', () => {
  scene.setPlaybackRate(Number(speedSelect.value));
  refresh();
});
phaseSelect.addEventListener('change', () => {
  if (phaseSelect.value !== '') {
    scene.seek(Number(phaseSelect.value));
    refresh();
  }
});
for (const key of ['overlay', 'silhouette', 'mirrored', 'court'] as const)
  document.getElementById(key)!.addEventListener('change', (e) => {
    scene.view({ [key]: (e.target as HTMLInputElement).checked });
    refresh();
  });
let last = 0;
game.events.on('poststep', (time: number) => {
  if (time - last > 200) {
    refresh();
    last = time;
  }
});
const api = Object.freeze({
  getState: () => (scene.ready ? scene.snapshot() : { ready: false as const }),
  reset: (clip?: string) => {
    scene.playing = false;
    scene.reset(clip);
    select.value = scene.clipName;
    refresh();
  },
  step: (seconds: number) => {
    scene.playing = false;
    scene.step(seconds);
    refresh();
  },
  play: () => {
    scene.playing = true;
  },
  pause: () => {
    scene.playing = false;
  },
  setPlaybackRate: (rate: number) => {
    scene.setPlaybackRate(rate);
    speedSelect.value = String(rate);
    refresh();
  },
  seek: (seconds: number) => {
    scene.seek(seconds);
    refresh();
  },
  view: (options: Parameters<RigReviewScene['view']>[0]) => {
    scene.view(options);
    refresh();
  },
});
Object.defineProperty(window, '__HERO_WEIGHTED_RIG__', {
  configurable: true,
  value: api,
});
declare global {
  interface Window {
    __HERO_WEIGHTED_RIG__: typeof api;
  }
}
window.addEventListener('error', (e) => {
  status.textContent = 'Rig failed: ' + e.message;
});
window.addEventListener('beforeunload', () => game.destroy(true), {
  once: true,
});
