import * as Phaser from 'phaser';
import { PassAScene } from './PassAScene';

declare global {
  interface Window {
    __PROTO__: {
      ready: boolean;
      error?: string;
      step(n: number): void;
      input(name: 'move' | 'charge', value: number): void;
      state(): object;
    };
  }
}

const query = new URLSearchParams(location.search),
  live = query.get('live') === '1';
const scene = new PassAScene(query.get('mirror') !== '0');
const proto: Window['__PROTO__'] = {
  ready: false,
  step: () => {
    throw Error('Prototype is not ready');
  },
  input: (name, value) => {
    if (name === 'move') scene.input_.move = Math.max(-1, Math.min(1, value));
    else if (name === 'charge') scene.input_.charge = value ? 1 : 0;
    else throw Error('Unknown input ' + String(name));
  },
  state: () => scene.state(),
};
window.__PROTO__ = proto;
const fail = (reason: unknown) => {
  proto.error = String(reason);
  document.getElementById('status')!.textContent = 'Pass A failed: ' + reason;
};
window.addEventListener('error', (event) => fail(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => fail(event.reason));

await scene.prepare();
// The 1280x720 world drawn at exactly 964x542 CSS px (the Lab capture size).
const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'arena',
  width: 1280,
  height: 720,
  backgroundColor: '#0a100c',
  antialias: true,
  audio: { noAudio: true },
  render: { antialias: true, preserveDrawingBuffer: true },
  fps: { target: 60 },
  scale: { mode: Phaser.Scale.NONE },
  scene: [scene],
});
let timestamp = 0;
const render = () => {
  timestamp += 1000 / 60;
  game.step(timestamp, 1000 / 60);
};
const start = () => {
  if (live) {
    scene.live = true;
    const keys = new Set<string>();
    const sync = () => {
      scene.input_.move =
        (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      scene.input_.charge = keys.has('Space') ? 1 : 0;
    };
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') event.preventDefault();
      keys.add(event.code);
      sync();
    });
    window.addEventListener('keyup', (event) => {
      keys.delete(event.code);
      sync();
    });
    window.addEventListener('blur', () => {
      keys.clear();
      sync();
    });
  } else {
    // Manual stepping: the page owns the clock and renders synchronously.
    game.loop.stop();
    timestamp = game.loop.now;
    render();
  }
  proto.step = (n) => {
    if (live) throw Error('step() is for manual mode (omit ?live=1)');
    for (let i = 0; i < Math.max(0, Math.floor(n)); i++) scene.tick();
    render();
  };
  proto.ready = true;
  document.getElementById('status')!.textContent = live
    ? 'Pass A · live: A/D move, hold Space to charge, release to throw'
    : 'Pass A · paused: drive with window.__PROTO__.step(n)';
};
const poll = () => {
  if (proto.error) return;
  if (scene.ready) game.events.once('poststep', start);
  else setTimeout(poll, 30);
};
poll();
