import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const out = 'work/qa/presentation-pass/focus';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  for (const [name, event, actor, take, focus, seek] of [
    ['dan-close', 'cornhole', 'dan', 'primaryAction', 'dan', 1.1],
    ['doug-close', 'cornhole', 'doug', 'primaryAction', 'doug', 1.1],
    ['running-stride', 'running', 'dan', 'run-stop', 'arena', 0.9],
  ]) {
    await page.goto(
      `http://127.0.0.1:3010/human-motion/?event=${event}&actor=${actor}&take=${take}&focus=${focus}&seek=${seek}`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.evaluate(() =>
      window.__HERO_MOTION__.view({ skeleton: false, trails: false }),
    );
    await page
      .locator('#stage canvas')
      .screenshot({ path: `${out}/${name}.png` });
    await fs.writeFile(
      `${out}/${name}.json`,
      JSON.stringify(
        await page.evaluate(() => window.__HERO_MOTION__.getState()),
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
