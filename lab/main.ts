/// <reference types="vite/client" />
import './style.css';
import { LabRuntime } from './LabRuntime';
import { createLabAPI } from './API';
import { SCENARIOS, type ScenarioOptions } from './scenarios';
import type { RigQAOptions } from './rig-qa';

const element = <T = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const select = (id: string) => element<HTMLSelectElement>(id);
const lab = new LabRuntime(element('arena'));
// Deliberately defined only by lab/index.html, never imported by the player app.
const api = createLabAPI(lab);
Object.defineProperty(window, '__HERO_ARENA__', {
  configurable: true,
  value: api,
});
const scenario = select('scenario'),
  character = select('character'),
  animation = select('animation'),
  seed = element<HTMLInputElement>('seed');
for (const s of SCENARIOS) scenario.add(new Option(s.label, s.id));
for (const clip of lab.catalog().animations)
  animation.add(new Option(`${clip.category} / ${clip.id}`, clip.id));
let busy = false;
let setupFingerprint = '';
function error(error: unknown) {
  element('error').textContent = String(error);
}
async function perform(action: () => Promise<unknown>) {
  if (busy) return;
  busy = true;
  element('error').textContent = '';
  element('status').textContent = 'Loading / rendering…';
  document
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) => (b.disabled = true));
  try {
    await action();
    refreshSetup();
  } catch (e) {
    error(e);
  } finally {
    busy = false;
    document
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((b) => (b.disabled = false));
    refresh();
  }
}
function refreshSetup() {
  const s = lab.getState();
  setupFingerprint = JSON.stringify(s.scenario);
  scenario.value = s.scenario.id;
  seed.value = s.scenario.seed;
  character.value = s.scenario.character ?? 'doug';
  animation.value = s.scenario.animation ?? 'chest_tap';
  element('character-field').hidden = element('animation-field').hidden =
    s.runtime !== 'character';
  element('rig-qa-controls').hidden = s.runtime !== 'character';
  for (const option of select('rig-view').options)
    option.disabled =
      option.value !== 'current' && s.scenario.character !== 'dan';
  element('description').textContent = s.scenario.description;
  const buttons = element('checkpoints');
  buttons.replaceChildren();
  for (const checkpoint of s.checkpoints) {
    const button = document.createElement('button');
    button.textContent = checkpoint.name;
    button.title = checkpoint.time.toFixed(3) + ' seconds';
    button.addEventListener('click', () =>
      perform(() => lab.seekCheckpoint(checkpoint.name)),
    );
    buttons.appendChild(button);
  }
}
function values(id: string, pairs: [string, unknown][]) {
  const list = element(id);
  list.replaceChildren();
  for (const [label, value] of pairs) {
    const dt = document.createElement('dt'),
      dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = String(value ?? '—');
    list.appendChild(dt);
    list.appendChild(dd);
  }
}
function refresh() {
  const s = lab.getState(),
    p = s.performance;
  if (s.ready && JSON.stringify(s.scenario) !== setupFingerprint)
    refreshSetup();
  if (!busy)
    element('status').textContent = s.ready
      ? 'Ready · ' + s.scenario.label
      : s.status;
  if (s.errors.length) element('error').textContent = s.errors.join('\n');
  if (s.rigQA) {
    select('rig-view').value = s.rigQA.options.view;
    select('rig-scale').value = s.rigQA.options.scale;
    for (const key of ['overlay', 'silhouette', 'mirror'] as const)
      element<HTMLInputElement>('rig-' + key).checked = s.rigQA.options[key];
  }
  const staticFit = !!s.rigQA?.sourceFit;
  element('animation-field').hidden = s.runtime !== 'character' || staticFit;
  element<HTMLButtonElement>('play').disabled = busy || staticFit;
  element<HTMLButtonElement>('step').disabled = busy || staticFit;
  element<HTMLButtonElement>('second').disabled = busy || staticFit;
  element('checkpoints').hidden = staticFit;
  element('stage-hint').textContent = staticFit
    ? 'Static source fit. Use Anatomy / rig inspection for joints, silhouette, mirror and the existing sunset court. Select Current artwork / evaluated rig for existing animations.'
    : 'Checkpoints pause at exact game times. Live checkpoints reset and replay the named seed. Press Play and focus the arena for real keyboard or controller input.';
  if (staticFit) {
    element('description').textContent =
      'Dan’s user-selected full-body reference, with its original proportions and pose. Uniform scale; static source review. Animation migration pending.';
    element('status').textContent = 'Ready · revised Dan source';
  } else element('description').textContent = s.scenario.description;
  element('time').textContent = s.time.toFixed(3) + 's';
  element('clock-mode').textContent =
    s.clockMode === 'manual'
      ? 'Manual clock · paused'
      : s.paused
        ? 'Real-time · paused by game'
        : 'Real-time clock';
  values('summary', [
    ['Runtime', s.runtime],
    ['Phase', s.event.phase],
    ['Score', JSON.stringify(s.event.scores)],
    ['Characters', s.characters.length],
    [
      'Input',
      s.inputs
        .map(
          (i) =>
            `${i.player}: ${i.family}${i.connected === false ? ' disconnected' : ''}`,
        )
        .join(', ') || 'Recorded / inspection',
    ],
    ['Virtual gamepad', s.syntheticGamepad ? 'Synthetic override' : 'Off'],
    ['API', 'v' + s.apiVersion],
  ]);
  if (p)
    values('performance', [
      ['Real-time FPS', p.realtime.fps?.toFixed(1) ?? 'No live sample'],
      ['Frame p95', p.realtime.frameTiming.p95Ms.toFixed(2) + ' ms'],
      [
        'Update / render CPU',
        `${p.realtime.updateWork.meanMs.toFixed(2)} / ${p.realtime.renderWork.meanMs.toFixed(2)} ms`,
      ],
      ['Manual frames', p.manual.frames],
      ['Draw calls', p.drawCalls],
      ['Objects / meshes', `${p.counters.objects} / ${p.counters.meshes}`],
      ['Texture estimate', p.counters.textureMBEstimate.toFixed(1) + ' MB'],
    ]);
  if (document.querySelector<HTMLDetailsElement>('.raw')!.open)
    element('state').textContent = JSON.stringify(s, null, 2);
}
scenario.addEventListener('change', () =>
  perform(() => lab.loadScenario(scenario.value)),
);
element('load').addEventListener('click', () =>
  perform(async () => {
    const sourceFit =
      !!lab.getState().rigQA?.sourceFit && character.value === 'dan';
    await lab.loadScenario(scenario.value, {
      seed: seed.value,
      ...(SCENARIOS.find((s) => s.id === scenario.value)?.kind === 'character'
        ? { character: character.value, animation: animation.value }
        : {}),
    });
    if (sourceFit && lab.getState().runtime === 'character')
      await lab.setRigQA({ view: 'source-fit' });
  }),
);
for (const input of [character, animation])
  input.addEventListener('change', () =>
    perform(() =>
      lab.loadScenario(scenario.value, {
        seed: seed.value,
        character: character.value,
        animation: animation.value,
      }),
    ),
  );
element('play').addEventListener('click', () => perform(() => lab.resume()));
element('pause').addEventListener('click', () => perform(() => lab.pause()));
element('step').addEventListener('click', () => perform(() => lab.step(1)));
element('second').addEventListener('click', () => perform(() => lab.step(60)));
element('copy-link').addEventListener('click', () =>
  perform(async () => {
    await navigator.clipboard.writeText(location.href);
  }),
);
element('export').addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(lab.getState(), null, 2)], {
      type: 'application/json',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${lab.getState().scenario.id}-state.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document
  .querySelectorAll<HTMLButtonElement>('[data-intent]')
  .forEach((button) => {
    button.addEventListener('pointerdown', (e) => {
      try {
        button.setPointerCapture(e.pointerId);
        lab.input('p0', button.dataset.intent!, 1);
      } catch (e) {
        error(e);
      }
    });
    const release = () => {
      try {
        lab.input('p0', button.dataset.intent!, 0);
      } catch {}
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
select('pad').addEventListener('change', () => {
  const value = select('pad').value;
  if (value === 'hardware') lab.restoreGamepad();
  else
    lab.setGamepad(
      value === 'disconnected'
        ? null
        : {
            connected: true,
            id:
              value === 'xbox'
                ? 'Xbox synthetic Lab pad'
                : 'DualSense synthetic Lab pad',
            mapping: 'standard',
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, () => ({
              value: 0,
              pressed: false,
            })),
          },
    );
  refresh();
});
for (const key of [
  'view',
  'scale',
  'overlay',
  'silhouette',
  'mirror',
] as const) {
  element('rig-' + key).addEventListener('change', () =>
    perform(() =>
      lab.setRigQA({
        [key]:
          key === 'view' || key === 'scale'
            ? select('rig-' + key).value
            : element<HTMLInputElement>('rig-' + key).checked,
      } as Partial<RigQAOptions>),
    ),
  );
}
const query = new URLSearchParams(location.search),
  options: ScenarioOptions = {};
for (const key of ['seed', 'character', 'animation', 'checkpoint'] as const)
  if (query.has(key)) options[key] = query.get(key)!;
void perform(async () => {
  await lab.loadScenario(query.get('scenario') ?? 'cornhole-recorded', options);
  if (query.has('rigView')) {
    await lab.setRigQA({ view: query.get('rigView') as RigQAOptions['view'] });
    element<HTMLDetailsElement>('rig-qa-controls').open = true;
  }
});
const refreshInterval = setInterval(refresh, 250);
window.addEventListener(
  'pagehide',
  () => {
    clearInterval(refreshInterval);
    lab.destroy();
  },
  { once: true },
);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearInterval(refreshInterval);
    lab.destroy();
  });
