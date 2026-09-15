import * as Phaser from 'phaser';
import { DanRigScene } from './DanRigScene';
import { chooseDanSample, danSamples, verifyDanSample } from './samples';
const sample = chooseDanSample(
  new URLSearchParams(location.search).get('sample'),
);
document.querySelector('#dataset-status')!.textContent =
  danSamples[sample].note;
const verified = await verifyDanSample(sample).catch((error) => {
  document.querySelector('#status')!.textContent =
    'Rig failed: ' + error.message;
  throw error;
});
const scene = new DanRigScene(sample, verified);
const status = document.querySelector<HTMLOutputElement>('#status')!;
const details = document.querySelector<HTMLPreElement>('#state')!;
const select = document.getElementById('clip') as unknown as HTMLSelectElement;
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
const render = () => {
  if (!scene.ready) return;
  const s = scene.snapshot();
  status.textContent = `Dan · ${s.clip} · ${s.seconds.toFixed(3)}s · ${s.playing ? 'Playing' : 'Paused'} · ${danSamples[sample].label}`;
  const { meshes, bones, ...small } = s;
  details.textContent = JSON.stringify(
    { ...small, boneCount: bones.length },
    null,
    2,
  );
};
scene.onReady = () => {
  for (const clip of scene.actor.animation.animationNames)
    select.add(new Option(clip, clip));
  select.value = scene.clipName;
  render();
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
      render();
    }
  });
select.addEventListener('change', () => {
  scene.playClip(select.value);
  render();
});
for (const key of ['overlay', 'silhouette', 'mirrored', 'court'] as const) {
  const input = document.getElementById(key) as HTMLInputElement;
  input.addEventListener('change', () => {
    scene.view({ [key]: input.checked });
    render();
  });
}
let last = 0;
game.events.on('poststep', (t: number) => {
  if (t - last > 200) {
    render();
    last = t;
  }
});
const api = Object.freeze({
  getState: () => (scene.ready ? scene.snapshot() : { ready: false as const }),
  reset: (clip?: string) => {
    scene.playing = false;
    scene.reset(clip);
    select.value = scene.clipName;
    render();
  },
  clip: (name: string) => {
    scene.playClip(name);
    select.value = name;
    render();
  },
  play: () => {
    scene.playing = true;
  },
  pause: () => {
    scene.playing = false;
  },
  step: (seconds: number) => {
    scene.playing = false;
    scene.step(seconds);
    render();
  },
  view: (options: Parameters<DanRigScene['view']>[0]) => {
    scene.view(options);
    for (const key of ['overlay', 'silhouette', 'mirrored', 'court'] as const)
      (document.getElementById(key) as HTMLInputElement).checked = scene[key];
    render();
  },
});
Object.defineProperty(window, '__HERO_DAN_RIG__', {
  value: api,
  configurable: true,
});
declare global {
  interface Window {
    __HERO_DAN_RIG__: typeof api;
  }
}
window.addEventListener('error', (e) => {
  status.textContent = 'Rig failed: ' + e.message;
});
window.addEventListener('beforeunload', () => game.destroy(true), {
  once: true,
});
