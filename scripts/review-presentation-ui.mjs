import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const out = 'work/qa/presentation-pass/player-ui';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const report = { errors: [], views: [] };
try {
  for (const [label, width, height] of [
    ['desktop', 1440, 1080],
    ['phone', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(e.message));
    await page.goto('http://localhost:3001/');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^Start / }).click();
    await page.locator('.live-game-host canvas').waitFor();
    try {
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector('.live-caption span')
              ?.textContent?.match(/^(\d+)s/)?.[1] ?? 0,
          ) >= 2 && !document.querySelector('.live-state-overlay'),
        undefined,
        { timeout: 60000 },
      );
    } catch (error) {
      await page.screenshot({
        path: `${out}/${label}-load-failure.png`,
        fullPage: true,
      });
      console.log(await page.locator('body').innerText(), report.errors);
      throw error;
    }
    await page.screenshot({
      path: `${out}/${label}-play-active.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Pause game', exact: true }).click();
    await page.screenshot({ path: `${out}/${label}-play.png`, fullPage: true });
    for (const view of ['play', 'watch']) {
      if (view === 'watch') {
        await page.getByRole('button', { name: 'Watch', exact: true }).click();
        await page.getByRole('button', { name: /Set up showdown/i }).click();
        assert.equal(
          await page
            .getByRole('tab', { name: 'Exhibition · no points', exact: true })
            .getAttribute('aria-selected'),
          'true',
        );
        await page
          .getByRole('button', { name: 'Start showdown', exact: true })
          .click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.scoreboard small')].some((n) =>
            /^[1-9]\d*\/\d+/.test(n.textContent ?? ''),
          ),
        );
        await page
          .getByRole('button', { name: 'Pause playback', exact: true })
          .click();
        await page.screenshot({
          path: `${out}/${label}-watch.png`,
          fullPage: true,
        });
      }
      const geometry = await page.evaluate(() => ({
        viewport: innerWidth,
        width: document.documentElement.scrollWidth,
        canvases: document.querySelectorAll('canvas').length,
      }));
      report.views.push({ label, view, ...geometry });
      assert.ok(
        geometry.width <= geometry.viewport + 1,
        `${label} ${view} overflow`,
      );
      assert.equal(geometry.canvases, 1);
    }
    await context.close();
  }
  const multi = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await multi.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto('http://localhost:3001/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Add player', exact: true }).click();
  await page.getByRole('button', { name: 'Add player', exact: true }).click();
  await page.getByRole('button', { name: /^Start / }).click();
  await page.waitForFunction(
    () =>
      Number(
        document
          .querySelector('.live-caption span')
          ?.textContent?.match(/^(\d+)s/)?.[1] ?? 0,
      ) >= 2 && !document.querySelector('.live-state-overlay'),
  );
  assert.equal(await page.locator('.live-score-strip>div').count(), 4);
  await page.screenshot({
    path: `${out}/four-player-play.png`,
    fullPage: true,
  });
  report.views.push({ label: 'desktop', view: 'four-player', participants: 4 });
  await multi.close();
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
