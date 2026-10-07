import { LiveArenaGame } from '../lib/arena/engine/core/LiveArenaGame';
import { bindingsFor } from '../lib/arena/engine/input/InputBindings';
const host = document.querySelector<HTMLElement>('#arena')!,
  status = document.querySelector<HTMLOutputElement>('#status')!,
  event = document.querySelector('#event') as unknown as HTMLSelectElement,
  control = document.querySelector('#control') as unknown as HTMLSelectElement;
let runtime: LiveArenaGame,
  charging = false,
  exporting = false,
  readyResolve: (error?: string) => void = () => {};
function boot() {
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
      readyResolve(e);
    },
    onSnapshot: (s) => {
      if (!exporting) status.textContent = JSON.stringify(s, null, 2);
    },
  });
}
// A synchronous throw from boot (e.g. no WebGL) must not leave the export's
// ready gate unsettled, so report it where the async onError path does.
function start() {
  try {
    boot();
  } catch (e) {
    const message = String(e);
    status.textContent = message;
    readyResolve(message);
  }
}
// An export has stopped the runtime's loop, so a restart then could never
// finish destroying it.
document.querySelector('#start')!.addEventListener('click', () => {
  if (!exporting) start();
});
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
  let booted = false;
  let error: string | undefined;
  try {
    // A failed start settles the gate with its error (never rejects it), so the
    // handler reaches the outer finally, resets `exporting`, and surfaces the
    // error in `#status`. Without the inner try/catch a synchronous throw out
    // of `start()` (e.g. WebGL boot fails on the reboot canvas) would reject
    // the promise here, the `await` would re-throw out of the listener, and
    // both buttons would wedge until the page is reloaded.
    error = await new Promise<string | undefined>((resolve) => {
      readyResolve = resolve;
      try {
        start();
      } catch (e) {
        resolve(String(e));
      }
    });
    if (error) {
      status.textContent = error;
      return;
    }
    booted = true;
    runtime.game.loop.stop();
    try {
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
    }
  } finally {
    exporting = false;
    // Only restart the loop for a cleanly booted new runtime. On a sync start()
    // throw `runtime` still points at the previous (pendingDestroy) game, and
    // calling loop.start on it is pointless; the harness recovers via #start.
    if (booted) runtime.game.loop.start(runtime.game.step.bind(runtime.game));
  }
});
start();
