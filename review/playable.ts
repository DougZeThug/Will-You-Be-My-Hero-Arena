import { LiveArenaGame } from '../lib/arena/engine/core/LiveArenaGame';
import { bindingsFor } from '../lib/arena/engine/input/InputBindings';
const host = document.querySelector<HTMLElement>('#arena')!,
  status = document.querySelector<HTMLOutputElement>('#status')!,
  event = document.querySelector('#event') as unknown as HTMLSelectElement,
  control = document.querySelector('#control') as unknown as HTMLSelectElement;
let runtime: LiveArenaGame,
  charging = false,
  exporting = false,
  readyResolve: () => void = () => {},
  startError = '';
function start() {
  runtime?.destroy();
  runtime = new LiveArenaGame(host, {
    config: {
      event: event.value,
      seed: 'live-review-2026',
      players: ['card-doug', 'card-dan'].map((cardId, i) => ({
        id: 'p' + i,
        cardId,
        device: i ? 'ai' : (control.value as 'ai' | 'keyboard' | 'touch'),
        bindings: bindingsFor(i),
      })),
      options: { movement: 'lanes' },
    },
    reduced: false,
    sound: false,
    onReady: () => {
      status.textContent = 'Ready';
      readyResolve();
    },
    onError: (e) => {
      status.textContent = e;
      startError = e;
      readyResolve();
    },
    onSnapshot: (s) => {
      if (!exporting) status.textContent = JSON.stringify(s, null, 2);
    },
  });
}
document.querySelector('#start')!.addEventListener('click', start);
document
  .querySelector('#pause')!
  .addEventListener('click', () =>
    runtime.session.pause(!runtime.session.paused),
  );
document.querySelector('#charge')!.addEventListener('click', () => {
  charging = !charging;
  runtime.session.inject('p0', 'charge', charging ? 1 : 0);
});
for (const [id, intent] of [
  ['primary', 'primaryAction'],
  ['secondary', 'secondaryAction'],
] as const)
  document.querySelector('#' + id)!.addEventListener('click', () => {
    runtime.session.inject('p0', intent, 1);
    runtime.session.inject('p0', intent, 0);
  });
document.querySelector('#export')!.addEventListener('click', async () => {
  if (exporting) return;
  exporting = true;
  startError = '';
  await new Promise<void>((resolve) => {
    readyResolve = resolve;
    start();
  });
  runtime.game.loop.stop();
  try {
    if (startError) throw Error(startError);
    for (let i = 0; i < 300; i++) {
      runtime.session.paused = false;
      runtime.game.isPaused = false;
      const blob = await new Promise<Blob>((resolve) => {
        runtime.game.events.once('postrender', () =>
          runtime.game.canvas.toBlob((b) => resolve(b!), 'image/png'),
        );
        runtime.game.step(performance.now(), 1000 / 30);
      });
      const response = await fetch(
        `/review-capture?name=after-playable-${event.value}-${String(i).padStart(4, '0')}.png`,
        { method: 'POST', body: blob },
      );
      if (!response.ok) throw Error('Capture failed');
      status.textContent = `Captured ${i + 1}/300`;
    }
    status.textContent = 'Complete';
  } catch (e) {
    status.textContent = String(e);
  } finally {
    exporting = false;
    runtime.game.loop.start(runtime.game.step.bind(runtime.game));
  }
});
start();
