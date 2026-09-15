import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const dir = 'docs/review/animation-upgrade/silhouettes';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  for (const actor of ['doug', 'dan'])
    for (const [event, take, time] of [
      ['basketball', 'primaryAction', 1.3],
      ['cornhole', 'fistPump', 0.75],
      ['cornhole', 'chestTap', 0.7],
      ['running', 'run-stop', 0.85],
    ]) {
      await page.goto(
        `http://127.0.0.1:3015/human-motion/?event=${event}&take=${take}&actor=${actor}&neutral=1`,
      );
      await page.waitForFunction(
        () => window.__HERO_MOTION__?.getState().actors,
      );
      await page.evaluate(
        ({ actor, time }) => {
          const api = window.__HERO_MOTION__;
          api.step(time);
          api.view({
            focus: actor,
            silhouette: true,
            skeleton: false,
            trails: false,
          });
        },
        { actor, time },
      );
      await page
        .locator('canvas')
        .screenshot({ path: `${dir}/${actor}-${event}-${take}.png` });
    }
} finally {
  await browser.close();
}
