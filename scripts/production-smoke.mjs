import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { qaServer, browserLaunchOptions } from './qa-server.mjs';
import { auditProductionAssets } from './production-assets.mjs';

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
  requests: [],
  consoleErrors: [],
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
  const assets = await auditProductionAssets();
  report.assets = assets.report;
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
  context.setDefaultTimeout(30000);
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    report.errors.push(
      `Request failed: ${request.url()} (${request.failure()?.errorText})`,
    );
  });
  page.on('response', (response) => {
    const requestUrl = new URL(response.url());
    if (!['http:', 'https:'].includes(requestUrl.protocol)) return;
    const file =
      decodeURIComponent(requestUrl.pathname.slice(1)) || 'index.html';
    report.requests.push({
      path: requestUrl.pathname,
      status: response.status(),
    });
    if (requestUrl.origin !== url)
      report.errors.push(`External dependency: ${response.url()}`);
    else if (!assets.files.has(file))
      report.errors.push(`Missing or wrong-case production URL: ${file}`);
    if (response.status() >= 400)
      report.errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
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
  report.playCharacterBackends = await page
    .locator('.live-game-host canvas')
    .getAttribute('data-character-backends');
  report.playCharacterRuntime = await page
    .locator('.live-game-host canvas')
    .getAttribute('data-character-runtime');
  assert.equal(
    report.playCharacterBackends,
    'loongbones-performance,loongbones-performance',
  );
  assert.equal(report.playCharacterRuntime, 'cornhole-finish-settle-v1');
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
    .getByRole('checkbox', { name: 'Replayable showcase seed' })
    .check();
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
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await page.getByRole('button', { name: 'Mute sound', exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Resume playback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Replay same recording', exact: true })
    .waitFor({ timeout: 90000 });
  await page
    .getByRole('progressbar', { name: 'Contest playback', exact: true })
    .filter({ visible: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      Number(
        document
          .querySelector('[aria-label="Contest playback"]')
          ?.getAttribute('aria-valuenow'),
      ) === 100,
  );
  report.completedMatch = {
    seed: 'velvet-paw-29',
    speed: '1×',
    score: await page.locator('.scoreboard').innerText(),
    stage: await page.locator('.stage-bottom').innerText(),
  };
  assert.match(report.completedMatch.score, /4\/4 bags/);
  assert.match(report.completedMatch.stage, /FINAL SCORE/);
  await page.screenshot({
    path: path.join(directory, 'production-results.png'),
    fullPage: true,
  });
  const savedFacts = () =>
    page.evaluate(() => {
      const envelope = JSON.parse(localStorage.getItem('wybmh-paper-arena-v2'));
      const state = JSON.parse(envelope.payload);
      return {
        recordings: state.recordings,
        ledger: state.ledger,
        policy: state.policy,
      };
    });
  const beforeReplay = await savedFacts();
  assert.equal(
    beforeReplay.recordings.at(-1).setup.seed,
    report.completedMatch.seed,
  );
  await page
    .getByRole('button', { name: 'Replay same recording', exact: true })
    .click();
  await page.waitForFunction(() => {
    const progress = Number(
      document
        .querySelector('[aria-label="Contest playback"]')
        ?.getAttribute('aria-valuenow'),
    );
    return progress > 0 && progress < 10;
  });
  await page
    .getByRole('button', { name: 'Pause playback', exact: true })
    .click();
  assert.deepEqual(await savedFacts(), beforeReplay);
  // These menus are React state on /, not server routes. A reload restores the
  // lobby and offers the saved contest through the existing Resume control.
  assert.equal(new URL(page.url()).pathname, '/');
  await page.reload();
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await page
    .getByRole('button', { name: 'Resume contest', exact: true })
    .waitFor();
  assert.deepEqual(await savedFacts(), beforeReplay);
  report.refreshPreservedMatch = true;
  await page
    .getByRole('button', { name: 'Resume contest', exact: true })
    .click();
  await page.locator('.arena-loading').waitFor({ state: 'detached' });
  // Restoring a nonzero saved position intentionally starts paused.
  await page
    .getByRole('button', { name: 'Resume playback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Pause playback', exact: true })
    .click();
  await page.screenshot({
    path: path.join(directory, 'production-resumed.png'),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => typeof window.__HERO_ARENA__),
    'undefined',
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.consoleErrors, []);
  await context.close();
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
