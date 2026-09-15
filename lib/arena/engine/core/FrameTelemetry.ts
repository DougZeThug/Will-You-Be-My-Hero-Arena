import type * as Phaser from 'phaser';
import { RenderMetrics } from './RenderMetrics';

export type TelemetryMode = 'realtime' | 'manual';
export interface TimingSummary {
  samples: number;
  meanMs: number;
  p95Ms: number;
  worstMs: number;
}
export interface TelemetryBucket {
  frames: number;
  windowFrames: number;
  frameTiming: TimingSummary;
  updateWork: TimingSummary;
  renderWork: TimingSummary;
  slowFrames: number;
  fps: number | null;
}
export interface RenderCounters {
  scenes: number;
  objects: number;
  visibleObjects: number;
  meshes: number;
  meshVertices: number;
  meshTriangles: number;
  textures: number;
  textureSources: number;
  textureMBEstimate: number;
}
export interface FrameTelemetrySnapshot {
  mode: TelemetryMode;
  capacity: number;
  realtime: TelemetryBucket;
  manual: TelemetryBucket;
  drawCalls: number | null;
  counters: RenderCounters;
  notes: string[];
}

type Sample = { frame: number; update: number; render: number };
type History = { frames: number; slowFrames: number; samples: Sample[] };
const history = (): History => ({ frames: 0, slowFrames: 0, samples: [] });
const emptyCounters = (): RenderCounters => ({
  scenes: 0,
  objects: 0,
  visibleObjects: 0,
  meshes: 0,
  meshVertices: 0,
  meshTriangles: 0,
  textures: 0,
  textureSources: 0,
  textureMBEstimate: 0,
});
const round = (value: number) => Math.round(value * 1000) / 1000;

export function summarizeTiming(values: readonly number[]): TimingSummary {
  if (!values.length) return { samples: 0, meanMs: 0, p95Ms: 0, worstMs: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    meanMs: round(
      sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    ),
    p95Ms: round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]),
    worstMs: round(sorted[sorted.length - 1]),
  };
}

/** Lab-only observer. It observes the existing Phaser clock; it never advances
 * simulation, changes playback settings, or owns requestAnimationFrame. */
export class FrameTelemetry {
  private mode: TelemetryMode = 'realtime';
  private histories = { realtime: history(), manual: history() };
  private metrics?: RenderMetrics;
  private counters = emptyCounters();
  private lastCounterSample = -Infinity;
  private previousFrame?: number;
  private updateStart = 0;
  private renderStart = 0;
  private pending: Sample = { frame: 0, update: 0, render: 0 };
  private disposed = false;
  private cleanup: (() => void)[] = [];
  readonly capacity: number;

  constructor(
    private game: Phaser.Game,
    capacity = 240,
  ) {
    this.capacity = Math.max(30, Math.min(3600, Math.floor(capacity)));
    const bind = (name: string, callback: (...args: any[]) => void) => {
      game.events.on(name, callback);
      this.cleanup.push(() => game.events.off(name, callback));
    };
    const attachMetrics = () => {
      if (!this.metrics && game.renderer)
        this.metrics = new RenderMetrics(game);
    };
    attachMetrics();
    bind('boot', attachMetrics);
    bind('prestep', (_time: number, delta: number) => {
      const now = performance.now();
      this.updateStart = now;
      this.pending = {
        // Observe cadence instead of Phaser's smoothed delta in realtime mode.
        frame:
          this.mode === 'manual'
            ? Math.max(0, delta)
            : this.previousFrame === undefined
              ? 0
              : Math.max(0, now - this.previousFrame),
        update: 0,
        render: 0,
      };
      this.previousFrame = now;
    });
    bind('poststep', () => {
      this.pending.update = Math.max(0, performance.now() - this.updateStart);
    });
    bind('prerender', () => {
      this.renderStart = performance.now();
    });
    bind('postrender', () => {
      const now = performance.now();
      this.pending.render = Math.max(0, now - this.renderStart);
      const bucket = this.histories[this.mode];
      bucket.frames++;
      if (this.pending.frame > 1000 / 30) bucket.slowFrames++;
      bucket.samples.push({ ...this.pending });
      if (bucket.samples.length > this.capacity) bucket.samples.shift();
      if (now - this.lastCounterSample >= 1000) this.sampleCounters();
    });
    bind('pause', () => {
      this.previousFrame = undefined;
    });
    bind('resume', () => {
      this.previousFrame = undefined;
    });
    bind('destroy', () => this.destroy());
  }

  setMode(mode: TelemetryMode) {
    if (mode !== 'manual' && mode !== 'realtime')
      throw Error('Unknown telemetry mode.');
    this.mode = mode;
    this.previousFrame = undefined;
  }

  reset() {
    this.histories = { realtime: history(), manual: history() };
    this.previousFrame = undefined;
    this.lastCounterSample = -Infinity;
  }

  private sampleCounters() {
    const counts = emptyCounters();
    const visited = new Set<Phaser.GameObjects.GameObject>();
    const visit = (
      object: Phaser.GameObjects.GameObject,
      parentVisible = true,
    ) => {
      if (visited.has(object)) return;
      visited.add(object);
      const node = object as Phaser.GameObjects.GameObject & {
        visible?: boolean;
        alpha?: number;
        list?: Phaser.GameObjects.GameObject[];
        vertices?: unknown[];
        faces?: unknown[];
      };
      const visible =
        parentVisible && node.visible !== false && node.alpha !== 0;
      counts.objects++;
      if (visible) counts.visibleObjects++;
      if (node.type === 'Mesh') {
        counts.meshes++;
        counts.meshVertices += node.vertices?.length ?? 0;
        counts.meshTriangles += node.faces?.length ?? 0;
      }
      node.list?.forEach((child) => visit(child, visible));
    };
    for (const scene of this.game.scene?.getScenes(true) ?? []) {
      counts.scenes++;
      scene.children?.list.forEach((object) => visit(object));
    }
    for (const texture of Object.values(this.game.textures?.list ?? {})) {
      counts.textures++;
      for (const source of texture.source) {
        counts.textureSources++;
        counts.textureMBEstimate +=
          (source.width * source.height * 4) / 1048576;
      }
    }
    counts.textureMBEstimate = round(counts.textureMBEstimate);
    this.counters = counts;
    this.lastCounterSample = performance.now();
  }

  snapshot(refreshCounters = false): FrameTelemetrySnapshot {
    if (
      !this.disposed &&
      (refreshCounters || this.lastCounterSample === -Infinity)
    )
      this.sampleCounters();
    const summarize = (mode: TelemetryMode): TelemetryBucket => {
      const bucket = this.histories[mode];
      const frameTiming = summarizeTiming(
        bucket.samples.map((s) => s.frame).filter((ms) => ms > 0),
      );
      return {
        frames: bucket.frames,
        windowFrames: bucket.samples.length,
        frameTiming,
        updateWork: summarizeTiming(bucket.samples.map((s) => s.update)),
        renderWork: summarizeTiming(bucket.samples.map((s) => s.render)),
        slowFrames: bucket.slowFrames,
        fps:
          mode === 'realtime' && frameTiming.meanMs > 0
            ? round(1000 / frameTiming.meanMs)
            : null,
      };
    };
    return {
      mode: this.mode,
      capacity: this.capacity,
      realtime: summarize('realtime'),
      manual: summarize('manual'),
      drawCalls: this.metrics?.available ? this.metrics.drawCalls : null,
      counters: { ...this.counters },
      notes: [
        'Frame cadence is wall-clock time in realtime mode; manual mode reports requested step delta and does not measure display FPS.',
        'Update/render work are CPU wall-clock estimates, not GPU timings. Slow frames exceed 33.33 ms; counts span the run while percentiles use the bounded window.',
        'Texture memory estimates RGBA source pixels only; it excludes driver overhead, mipmaps, render targets and browser copies.',
        'Visible objects have visible ancestors and nonzero alpha; this is not camera culling or draw-call count.',
      ],
    };
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanup.forEach((off) => off());
    this.cleanup = [];
    this.metrics?.destroy();
    this.metrics = undefined;
  }
}
