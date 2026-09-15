import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const arg = (n, d) =>
  process.argv.find((a) => a.startsWith('--' + n + '='))?.slice(n.length + 3) ??
  d;
const out = arg('out', 'work/qa/reference-throw/stills'),
  actor = arg('actor', 'dan');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:3010/human-motion/?event=cornhole&actor=${actor}&take=${arg('take', 'primaryAction')}&focus=${actor}`,
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const landmarks = await page.evaluate(
    ({ actor, style }) =>
      window.__HERO_MOTION__.clips(actor).find((c) => c.id === 'throw.' + style)
        .landmarks,
    { actor, style: arg('style', 'flat') },
  );
  const times = landmarks.map((l) => 0.2 + l.at);
  for (const [i, t] of times.entries()) {
    await page.evaluate(
      ({ t, actor }) => {
        const a = window.__HERO_MOTION__;
        a.step(Math.max(0, t - a.getState().time));
        a.view({
          skeleton: false,
          trails: false,
          silhouette: false,
          focus: actor,
        });
      },
      { t, actor },
    );
    await page
      .locator('canvas')
      .first()
      .screenshot({
        path: `${out}/${actor}-${String(i).padStart(2, '0')}.png`,
      });
    if ([0, 6, 11, 13, 16].includes(i)) {
      await page.evaluate(() =>
        window.__HERO_MOTION__.view({ silhouette: true }),
      );
      await page
        .locator('canvas')
        .first()
        .screenshot({
          path: `${out}/${actor}-${String(i).padStart(2, '0')}-silhouette.png`,
        });
    }
  }
  await page.evaluate(() =>
    window.__HERO_MOTION__.view({ silhouette: false, focus: 'arena' }),
  );
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: `${out}/${actor}-arena.png` });
  await fs.writeFile(
    out + '/' + actor + '-review.json',
    JSON.stringify(
      {
        actor,
        times,
        landmarks,
        errors,
        state: await page.evaluate(() => window.__HERO_MOTION__.getState()),
        curves: await page.evaluate(
          (actor) => window.__HERO_MOTION__.curves(actor),
          actor,
        ),
      },
      null,
      2,
    ),
  );
  console.log({ out, actor, errors });
} finally {
  await browser.close();
}
