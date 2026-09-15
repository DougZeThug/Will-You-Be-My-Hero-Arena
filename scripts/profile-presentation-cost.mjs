/** Browser-only render ablation. It never alters source, event rules or stored results. */
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const results = [];
try {
  for (const mode of ['presentation', 'control', 'control', 'presentation']) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 },
      }),
      page = await context.newPage();
    if (mode === 'control') {
      await page.route('**/ArenaHud.ts*', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: 'export class ArenaHud { update(s){this.s=s;} snapshot(){return this.s;} setVisible(){} destroy(){} }',
        }),
      );
      await page.route('**/ArenaEnvironment.ts*', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: 'export class ArenaEnvironment { setVisible(){} destroy(){} }',
        }),
      );
    }
    await page.goto('http://127.0.0.1:3010/human-motion/?event=cornhole');
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.evaluate(() => {
      window.__HERO_MOTION__.view({ skeleton: false, trails: false });
      window.__HERO_MOTION__.resume();
    });
    await page.waitForTimeout(1500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
    const sample = await page.evaluate(async () => {
      const deltas = [];
      let previous = performance.now(),
        id;
      const next = (now) => {
        deltas.push(now - previous);
        previous = now;
        id = requestAnimationFrame(next);
      };
      id = requestAnimationFrame(next);
      await new Promise((r) => setTimeout(r, 5000));
      cancelAnimationFrame(id);
      return { deltas, performance: window.__HERO_MOTION__.getPerformance() };
    });
    const { profile } = await cdp.send('Profiler.stop');
    const total = sample.deltas.reduce((a, b) => a + b, 0);
    const self = profile.nodes
      .filter((n) => n.hitCount)
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 20)
      .map((n) => ({
        function: n.callFrame.functionName,
        url: n.callFrame.url,
        hits: n.hitCount,
      }));
    results.push({
      mode,
      fps: (1000 * sample.deltas.length) / total,
      ...sample,
      self,
    });
    console.log(mode, results.at(-1).fps);
    await context.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  'work/qa/presentation-pass/render-ablation.json',
  JSON.stringify(
    {
      method:
        'ABBA browser-only render ablation; same cornhole mechanics, rigs, seed, new background, viewport and warm-up. Control suppresses only new HUD/decor creation. Five seconds with V8 CPU profiler per sample, so these are diagnostic comparisons, not production FPS claims.',
      results,
    },
    null,
    2,
  ),
);
