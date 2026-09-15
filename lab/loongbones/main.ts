import * as Phaser from 'phaser';
import { ProofScene } from './ProofScene';
import { importExport } from './import-export';
import { readBundledEditorExport } from './editor-export';
const scene = new ProofScene();
const status = document.querySelector<HTMLOutputElement>('#status')!;
const state = document.querySelector<HTMLPreElement>('#state')!;
let failure = '';
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  width: 1200,
  height: 680,
  audio: { noAudio: true },
  antialias: true,
  scene: [scene],
  fps: { target: 60 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
const guarded = (fn: () => void) => {
  try {
    if (scene.ready) fn();
    failure = '';
    render();
  } catch (e) {
    failure = String(e);
    status.textContent = failure;
    throw e;
  }
};
function render() {
  if (!scene.ready) return;
  const snapshot = scene.snapshot();
  status.textContent =
    failure ||
    `Phaser ${snapshot.phaser} · DragonBones ${snapshot.runtime} · ${snapshot.playing ? 'Playing' : 'Paused'} · ${snapshot.seconds.toFixed(3)}s · ${snapshot.bag.attached ? 'Bag attached to hand' : 'Bag released by animation marker'}`;
  state.textContent = JSON.stringify(
    {
      phaser: snapshot.phaser,
      runtime: snapshot.runtime,
      status: snapshot.status,
      editorExportVerified: snapshot.freshLoongBonesExportVerified,
      editorExportScope: snapshot.editorExport,
      hand: snapshot.hand,
      bag: snapshot.bag,
      release: snapshot.release,
      events: snapshot.events,
      performance: snapshot.performance,
    },
    null,
    2,
  );
}
for (const [id, fn] of Object.entries({
  play: () => {
    scene.playing = true;
  },
  pause: () => {
    scene.playing = false;
  },
  step: () => {
    scene.playing = false;
    scene.step(1 / 60);
  },
  reset: () => scene.reset(),
  throw: () => scene.clip('throw', 'arm', 0),
  deform: () => scene.clip('deform', 'arm'),
  mirror: () => {
    scene.sample.scaleX *= -1;
    scene.arm.scaleX *= -1;
    scene.present();
  },
  bones: () => {
    scene.overlay = !scene.overlay;
    scene.present();
  },
}))
  document.getElementById(id)!.addEventListener('click', () => guarded(fn));
const select = document.getElementById('clip') as unknown as HTMLSelectElement;
let autoLoadStarted = false;
scene.onReady = () => {
  select.replaceChildren();
  for (const name of scene.sample.animation.animationNames)
    select.add(new Option(name, name));
  if (scene.editorExport)
    document.getElementById('provenance')!.textContent =
      'Verified supplied export: LoongBones 1.2.3 → DragonBones 5.5 → Phaser 3.90.0. Textures, bones and mesh deformation. This export has no blended skin weights or release markers; the separate right-hand fixture tests those features.';
  else if (scene.sampleSource.kind === 'local-import')
    document.getElementById('provenance')!.textContent =
      `Local import: ${scene.sampleSource.armature} / DragonBones ${scene.sampleSource.version}. Editor origin requires separate provenance review.`;
  render();
  if (
    !autoLoadStarted &&
    new URLSearchParams(location.search).get('sample') === 'editor'
  ) {
    autoLoadStarted = true;
    void loadEditor();
  }
};
const files = document.getElementById('export-files') as HTMLInputElement;
const editorButton = document.getElementById(
  'editor-export',
) as HTMLButtonElement;
let importing = false;
async function loadFiles(getFiles: () => Promise<File[]>) {
  if (!scene.ready || importing) return;
  importing = true;
  files.disabled = editorButton.disabled = true;
  scene.playing = false;
  try {
    await importExport(scene, await getFiles());
    failure = '';
    render();
  } catch (e) {
    failure = `Import failed: ${String(e)}`;
    status.textContent = failure;
  } finally {
    importing = false;
    files.disabled = editorButton.disabled = false;
  }
}
function loadEditor() {
  return loadFiles(readBundledEditorExport);
}
files.addEventListener(
  'change',
  () => void loadFiles(async () => Array.from(files.files ?? [])),
);
editorButton.addEventListener('click', () => void loadEditor());
select.addEventListener('change', () =>
  guarded(() => scene.clip(select.value)),
);
let lastRender = 0;
game.events.on('poststep', (time: number) => {
  if (time - lastRender > 150) {
    render();
    lastRender = time;
  }
});
const api = Object.freeze({
  getState: () => (scene.ready ? scene.snapshot() : { ready: false }),
  play: () =>
    guarded(() => {
      scene.playing = true;
    }),
  pause: () =>
    guarded(() => {
      scene.playing = false;
    }),
  step: (seconds: number) =>
    guarded(() => {
      scene.playing = false;
      scene.step(seconds);
    }),
  reset: () =>
    guarded(() => {
      scene.playing = false;
      scene.reset();
    }),
  clip: (name: string, actor?: 'sample' | 'arm', fade?: number) =>
    guarded(() => scene.clip(name, actor, fade)),
});
Object.defineProperty(window, '__HERO_LOONGBONES_PROOF__', {
  value: api,
  configurable: true,
});
declare global {
  interface Window {
    __HERO_LOONGBONES_PROOF__: typeof api;
  }
}
window.addEventListener('error', (e) => {
  failure = `Proof failed: ${e.message}`;
  status.textContent = failure;
});
window.addEventListener('beforeunload', () => game.destroy(true), {
  once: true,
});
