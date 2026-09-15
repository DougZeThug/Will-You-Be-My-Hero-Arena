import type * as Phaser from 'phaser';

interface SharedDrawCounter {
  references: number;
  count: number;
  drawCalls: number;
  available: boolean;
  release(): void;
}
const counters = new WeakMap<Phaser.Game, SharedDrawCounter>();

/** One counter per WebGL game. The recorded HUD and a Lab observer may coexist
 * without wrapping the same methods twice or restoring each other. */
export class RenderMetrics {
  private shared: SharedDrawCounter;
  private disposed = false;
  constructor(game: Phaser.Game) {
    let shared = counters.get(game);
    if (!shared) {
      const restores: (() => void)[] = [];
      shared = {
        references: 0,
        count: 0,
        drawCalls: 0,
        available: false,
        release: () => {},
      };
      const counter = shared;
      const gl = (
        game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined
      )?.gl;
      if (gl) {
        for (const name of ['drawArrays', 'drawElements'] as const) {
          const own = Object.getOwnPropertyDescriptor(gl, name);
          const original = gl[name];
          const wrapped = (...args: unknown[]) => {
            counter.count++;
            Reflect.apply(original, gl, args);
          };
          try {
            Object.defineProperty(gl, name, {
              value: wrapped,
              configurable: true,
              writable: true,
            });
            restores.push(() => {
              // Leave a wrapper installed subsequently by another tool intact.
              if (gl[name] !== wrapped) return;
              if (own) Object.defineProperty(gl, name, own);
              else Reflect.deleteProperty(gl, name);
            });
          } catch {
            /* Diagnostics must never prevent rendering. */
          }
        }
        counter.available = restores.length === 2;
      }
      const start = () => {
        counter.count = 0;
      };
      const end = () => {
        counter.drawCalls = counter.count;
      };
      game.events.on('prerender', start);
      game.events.on('postrender', end);
      counter.release = () => {
        game.events.off('prerender', start);
        game.events.off('postrender', end);
        restores.forEach((restore) => restore());
        counters.delete(game);
      };
      counters.set(game, counter);
    }
    this.shared = shared;
    shared.references++;
  }
  get drawCalls() {
    return this.shared.drawCalls;
  }
  get available() {
    return this.shared.available;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    if (--this.shared.references === 0) this.shared.release();
  }
}
