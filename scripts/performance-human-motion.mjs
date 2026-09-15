/** Real-time observer only. Run without concurrent captures/builds/browser suites. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const output =
  process.argv.find((a) => a.startsWith('--out='))?.slice(6) ??
  'work/qa/v3-review/performance.json';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const results = [];
try {
  for (const event of ['cornhole', 'running', 'basketball', 'fighting']) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `${process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010'}/human-motion/?event=${event}`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.evaluate(() => {
      window.__HERO_MOTION__.view({ skeleton: false, trails: false });
      window.__HERO_MOTION__.resume();
      const observer = { deltas: [], previous: null, handle: 0 };
      const sample = (now) => {
        if (observer.previous !== null)
          observer.deltas.push(now - observer.previous);
        observer.previous = now;
        observer.handle = requestAnimationFrame(sample);
      };
      observer.handle = requestAnimationFrame(sample);
      window.__ARENA_PERF_OBSERVER__ = observer;
    });
    // Sample the running course while athletes are moving, before its finish-line idle.
    const durationMs = event === 'running' ? 4200 : 12000;
    await page.waitForTimeout(durationMs);
    const snapshot = await page.evaluate(() => {
      const observer = window.__ARENA_PERF_OBSERVER__;
      cancelAnimationFrame(observer.handle);
      return {
        state: window.__HERO_MOTION__.getState(),
        performance: window.__HERO_MOTION__.getPerformance(),
        frameDeltas: observer.deltas,
      };
    });
    const sorted = [...snapshot.frameDeltas].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    snapshot.measuredCadence = {
      samples: sorted.length,
      meanMs: mean,
      fps: 1000 / mean,
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      worstMs: sorted.at(-1),
    };
    results.push({
      event,
      observedSeconds: durationMs / 1000,
      ...snapshot,
      errors,
    });
    console.log(event, JSON.stringify(snapshot.measuredCadence));
    await page.close();
  }
} finally {
  await browser.close();
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(
  output,
  JSON.stringify(
    {
      captured: new Date().toISOString(),
      method:
        'One headless Chrome page at a time; 12 seconds real-time per event, except running at 4.2 seconds before finish. measuredCadence is a fresh requestAnimationFrame observer started after assets and actors are ready; no video recorder or manual stepping. Legacy performance buckets are retained separately and may include initialization. Other user apps may remain open.',
      results,
    },
    null,
    2,
  ),
);
