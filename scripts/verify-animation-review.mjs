import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3019');
  await page.waitForFunction(
    () => document.querySelectorAll('#action option').length === 7,
  );
  const actions = await page
    .locator('#action option')
    .evaluateAll((es) => es.map((e) => e.value));
  for (const actor of ['doug', 'dan']) {
    await page.selectOption('#actor', actor);
    for (const action of actions) {
      await page.selectOption('#action', action);
      await page.waitForFunction(
        () =>
          ['before', 'after'].every((id) => {
            const v = document.getElementById(id);
            return !v.hidden && v.readyState >= 2 && v.videoWidth === 1280;
          }),
        {},
        { timeout: 15000 },
      );
    }
  }
  await page.selectOption('#actor', 'doug');
  await page.selectOption('#action', 'basketball|primaryAction');
  await page.waitForFunction(() =>
    ['before', 'after'].every(
      (id) => document.getElementById(id).readyState >= 2,
    ),
  );
  await page.click('#play');
  await page.waitForTimeout(600);
  const playing = await page
    .locator('main video')
    .evaluateAll((es) =>
      es.map((v) => ({ time: v.currentTime, paused: v.paused })),
    );
  if (playing.some((v) => v.paused || v.time < 0.1))
    throw Error('Video playback failed');
  await page.click('#pause');
  await page.click('#release');
  await page.waitForTimeout(150);
  await page.screenshot({
    path: 'docs/review/animation-upgrade/review-page.png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/review/animation-upgrade/review-phone.png',
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join('\n'));
  await fs.writeFile(
    'docs/review/animation-upgrade/review-check.json',
    JSON.stringify(
      { passed: true, combinations: 14, playing, errors },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, combinations: 14, playing }));
} finally {
  await browser.close();
}
