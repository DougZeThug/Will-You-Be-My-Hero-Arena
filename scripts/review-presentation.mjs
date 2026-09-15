import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const label = process.argv[2] ?? 'after';
const out = `work/qa/presentation-pass/${label}`;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [id, point] of [
    ['cornhole-recorded', 'release'],
    ['basketball-recorded', 'flight'],
    ['football-recorded', 'landing'],
    ['beer-pong-recorded', 'result'],
    ['running-live', null],
    ['fighting-live', null],
  ]) {
    await page.goto(`http://127.0.0.1:3010/?scenario=${id}`);
    await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
    if (point)
      await page.evaluate(
        (p) => window.__HERO_ARENA__.seekCheckpoint(p),
        point,
      );
    else await page.evaluate(() => window.__HERO_ARENA__.step(90));
    const state = await page.evaluate(() => window.__HERO_ARENA__.getState());
    await page
      .locator('#arena canvas')
      .screenshot({ path: `${out}/${id}.png` });
    results.push({ id, state });
    console.log(label, id);
  }
  for (const event of ['cornhole', 'running', 'basketball', 'fighting']) {
    await page.goto(
      `http://127.0.0.1:3010/human-motion/?event=${event}&actor=dan&take=primaryAction&seek=1.1`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.evaluate(() =>
      window.__HERO_MOTION__.view({ skeleton: false, trails: false }),
    );
    const state = await page.evaluate(() => window.__HERO_MOTION__.getState());
    await page
      .locator('#stage canvas')
      .screenshot({ path: `${out}/motion-${event}.png` });
    results.push({ id: `motion-${event}`, state });
    console.log(label, 'motion-' + event);
  }
  await fs.writeFile(
    `${out}/states.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
