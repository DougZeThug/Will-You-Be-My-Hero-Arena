import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const out =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  'work/qa/cornhole-side-v3';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const id of ['dan', 'doug']) {
  await page.goto(`http://127.0.0.1:3010/loongbones/doug/?character=${id}`);
  await page.waitForFunction(
    () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
  );
  for (const t of [0, 0.45, 0.82, 1.08, 1.7]) {
    const state = await page.evaluate(
      ({ id, t }) => {
        const api = window.__HERO_WEIGHTED_RIG__;
        api.reset(`cornhole_throw_flat_R_${id}`);
        api.step(t);
        return api.getState();
      },
      { id, t },
    );
    await page
      .locator('#stage canvas')
      .screenshot({ path: `${out}/${id}-${t}.png` });
    await fs.writeFile(`${out}/${id}-${t}.json`, JSON.stringify(state));
  }
}
console.log({ errors });
await browser.close();
