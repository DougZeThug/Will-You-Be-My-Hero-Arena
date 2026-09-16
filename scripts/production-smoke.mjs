import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { qaServer, browserLaunchOptions } from './qa-server.mjs';

const directory = 'work/qa/production';
await mkdir(directory, { recursive: true });
const report = {
  passed: false,
  inspectedFiles: 0,
  noLabGlobal: false,
  play: false,
  watch: false,
  noPracticeSaveWrites: false,
  errors: [],
};
let server, browser;
try {
  async function scan(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (/\.(?:js|html|css)$/.test(entry.name)) {
        report.inspectedFiles++;
        const source = await readFile(file, 'utf8');
        for (const symbol of [
          '__HERO_ARENA__',
          '__HERO_LOONGBONES_PROOF__',
          '__HERO_DAN_RIG__',
          '__HERO_WEIGHTED_RIG__',
          '__HERO_MOTION__',
          '__HERO_PERFORMANCE__',
        ])
          assert.ok(
            !source.includes(symbol),
            `Lab global ${symbol} leaked into ${file}`,
          );
      }
    }
  }
  await scan('dist/client');
  const port = process.env.ARENA_PRODUCTION_QA_PORT ?? '3011';
  assert.match(port, /^\d{4,5}$/);
  const url = `http://127.0.0.1:${port}`;
  server = await qaServer({
    url,
    args: ['scripts/serve.mjs'],
    label: 'production',
    env: { PORT: port },
  });
  browser = await chromium.launch({
    ...browserLaunchOptions(),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(url);
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_MOTION__),
    'undefined',
  );
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_PERFORMANCE__),
    'undefined',
  );
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_ARENA__),
    'undefined',
  );
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_LOONGBONES_PROOF__),
    'undefined',
  );
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_DAN_RIG__),
    'undefined',
  );
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_WEIGHTED_RIG__),
    'undefined',
  );
  assert.equal(
    await page.getByRole('heading', { name: 'Arena Lab', exact: true }).count(),
    0,
  );
  report.noLabGlobal = true;
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const savedBefore = await page.evaluate(() =>
    localStorage.getItem('wybmh-paper-arena-v2'),
  );
  await page.getByRole('button', { name: /^Start / }).click();
  await page.locator('.live-game-host canvas').waitFor();
  // A mounted canvas precedes asset readiness. Wait on actual production HUD
  // progress so screenshots contain the landed characters, not a loading frame.
  await page.waitForFunction(() => {
    const caption = document.querySelector('.live-caption');
    const seconds = Number(
      caption?.querySelector('span')?.textContent?.match(/^(\d+)s/)?.[1] ?? 0,
    );
    return (
      seconds >= 2 &&
      !document.querySelector('.live-state-overlay') &&
      !!caption?.querySelector('p')?.textContent
    );
  });
  report.playReadyEvidence = await page.locator('.live-caption').innerText();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await page
    .getByRole('button', { name: 'Resume game', exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem('wybmh-paper-arena-v2')),
    savedBefore,
  );
  report.noPracticeSaveWrites = true;
  report.play = true;
  await page.locator('.live-game-host canvas').screenshot({
    path: path.join(directory, 'production-play.png'),
  });
  await page.screenshot({
    path: path.join(directory, 'production-play-page.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await page.getByRole('button', { name: /Set up showdown/i }).waitFor();
  await page.locator('.arena-loading').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Set up showdown/i }).click();
  const exhibition = page.getByRole('tab', {
    name: 'Exhibition · no points',
    exact: true,
  });
  await exhibition.waitFor();
  assert.equal(await exhibition.getAttribute('aria-selected'), 'true');
  await page
    .getByRole('button', { name: 'Start showdown', exact: true })
    .click();
  await page.locator('.setup-dialog').waitFor({ state: 'hidden' });
  await page.locator('.arena-loading').waitFor({ state: 'detached' });
  await page.waitForFunction(() => {
    const round =
      document.querySelector('.stage-bottom span')?.textContent ?? '';
    const progress = Number(
      document
        .querySelector('[aria-label="Contest playback"]')
        ?.getAttribute('aria-valuenow') ?? 0,
    );
    const completedAttempt = [
      ...document.querySelectorAll('.scoreboard small'),
    ].some((node) => /^[1-9]\d*\/\d+/.test(node.textContent ?? ''));
    return (
      round.startsWith('ROUND ') &&
      progress > 0 &&
      completedAttempt &&
      !document.querySelector('.arena-loading')
    );
  });
  await page
    .getByRole('button', { name: 'Pause playback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Resume playback', exact: true })
    .waitFor();
  assert.equal(await page.locator('.arena-loading').count(), 0);
  report.watchReadyEvidence = {
    round: await page.locator('.stage-bottom').innerText(),
    score: await page.locator('.scoreboard').innerText(),
    progressPercent: Number(
      await page
        .getByRole('progressbar', { name: 'Contest playback', exact: true })
        .getAttribute('aria-valuenow'),
    ),
    mode: 'exhibition',
    characterRuntime: await page
      .locator('canvas[data-character-runtime]')
      .getAttribute('data-character-runtime'),
  };
  assert.equal(
    report.watchReadyEvidence.characterRuntime,
    'cornhole-finish-settle-v1',
    'Production cornhole must use the reviewed performance runtime',
  );
  report.watch = true;
  await page.screenshot({
    path: path.join(directory, 'production-watch.png'),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_ARENA__),
    'undefined',
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.errors.push(String(error));
} finally {
  await browser?.close();
  await server?.stop();
  await writeFile(
    path.join(directory, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed ? 0 : 1;
