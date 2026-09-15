import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const label = process.argv[2] ?? 'baseline';
const root = `work/qa/animation-upgrade/${label}`;
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const takes = [
  [
    'basketball',
    'primaryAction',
    [0.5, 0.7, 0.85, 0.95, 0.967, 1, 1.1, 1.3, 1.5],
  ],
  ['running', 'run-stop', [0.5, 0.7, 0.85, 1, 1.2, 1.45, 1.65, 1.9]],
  ['cornhole', 'primaryAction', [0.5, 0.9, 1.15, 1.3, 1.5, 1.8, 2.1]],
  ['cornhole', 'chestTap', [0.5, 0.7, 0.8, 0.95, 1.05, 1.25]],
  ['cornhole', 'bagFlip', [0.5, 0.6, 0.75, 0.9, 1, 1.1]],
  ['cornhole', 'fistPump', [0.5, 0.65, 0.75, 0.9, 1.15]],
  ['fighting', 'primaryAction', [0.4, 0.6, 0.8, 1]],
];
try {
  for (const actor of ['doug', 'dan'])
    for (const [event, take, times] of takes) {
      if (
        process.argv[3] &&
        !`${actor}-${event}-${take}`.includes(process.argv[3])
      )
        continue;
      const name = `${actor}-${event}-${take}`;
      await page.goto(
        `http://127.0.0.1:3015/human-motion/?event=${event}&take=${take}&actor=${actor}`,
      );
      await page.waitForFunction(
        () => window.__HERO_MOTION__?.getState().actors,
      );
      await page.evaluate(
        (actor) =>
          window.__HERO_MOTION__.view({
            focus: actor,
            skeleton: false,
            trails: false,
          }),
        actor,
      );
      const states = [];
      let previous = 0;
      for (const t of times) {
        await page.evaluate(
          (dt) => window.__HERO_MOTION__.step(dt),
          t - previous,
        );
        previous = t;
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        await page
          .locator('canvas')
          .screenshot({ path: `${root}/${name}-${t.toFixed(3)}.png` });
        states.push(
          await page.evaluate(() => window.__HERO_MOTION__.getState()),
        );
      }
      await fs.writeFile(`${root}/${name}.json`, JSON.stringify(states));
      console.log(name);
    }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
