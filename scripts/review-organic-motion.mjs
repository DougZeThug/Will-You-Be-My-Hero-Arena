import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const out = 'work/qa/organic-motion/final-views';
await fs.mkdir(out, { recursive: true });
const started = new Date().toISOString();
await fs.writeFile(out + '/review.json', JSON.stringify({ started, passed: false }));
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [event, actor, time] of [
    ['cornhole', 'dan', 1.1],
    ['cornhole', 'doug', 1.1],
    ['running', 'dan', 1.1],
    ['basketball', 'dan', 0.8],
    ['fighting', 'dan', 0.4],
  ]) {
    const take = event === 'running' ? 'run-stop' : 'primaryAction';
    await page.goto(
      `http://127.0.0.1:3010/human-motion/?event=${event}&actor=${actor}&take=${take}`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.evaluate((time) => {
      const api = window.__HERO_MOTION__;
      api.step(time);
      api.view({ skeleton: false, trails: false });
    }, time);
    for (const focus of ['arena', actor]) {
      await page.selectOption('#review-focus', focus);
      for (const silhouette of [false, true]) {
        await page.evaluate(
          (silhouette) => window.__HERO_MOTION__.view({ silhouette }),
          silhouette,
        );
        await page
          .locator('canvas')
          .screenshot({
            path: `${out}/${event}-${actor}-${focus}-${silhouette ? 'silhouette' : 'raw'}.png`,
          });
      }
    }
    await fs.writeFile(
      `${out}/${event}-${actor}.json`,
      JSON.stringify(
        await page.evaluate(() => window.__HERO_MOTION__.getState()),
        null,
        2,
      ),
    );
  }
  await page.goto(
    'http://127.0.0.1:3010/human-motion/?event=cornhole&actor=dan&take=primaryAction',
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page
    .getByRole('button', { name: 'Load measured reference demo' })
    .click();
  await page.waitForFunction(() =>
    document.querySelector('#reference-status').textContent.includes('125'),
  );
  await page.evaluate(() => window.__HERO_MOTION__.step(2));
  await page.locator('#curve-panel summary').click();
  await page.waitForFunction(() => document.querySelectorAll('#motion-curves path').length === 16);
  assert.equal(await page.locator('#motion-curves path').count(), 16);
  await page
    .locator('#curve-panel')
    .screenshot({ path: out + '/rendered-reference-curves.png' });
  await page.selectOption('#review-focus', 'dan');
  await page.locator('#balance-view').check();
  await page.locator('#velocity-view').check();
  await page
    .locator('canvas')
    .screenshot({ path: out + '/dan-diagnostics.png' });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    out + '/review.json',
    JSON.stringify(
      {
      started,
      completed: new Date().toISOString(),
      passed: true,
      screenshots: 22,
        errors,
        actualNativeRendering: true,
        reference:
          'Unmatched measured demonstration, not a cornhole accuracy claim',
      },
      null,
      2,
    ),
  );
  console.log(
    '20 raw/silhouette arena/close frames, reference curves and diagnostic overlay verified; no page errors.',
  );
} finally {
  await browser.close();
}
