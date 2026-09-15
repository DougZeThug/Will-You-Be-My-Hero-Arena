import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const out = `work/qa/performance-upgrade/${process.argv[2] ?? 'poses'}`;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  for (const event of ['cornhole', 'running', 'basketball', 'fighting'])
    for (const actor of ['doug', 'dan']) {
      const take =
        event === 'running'
          ? 'run-stop'
          : event === 'fighting'
            ? ''
            : 'primaryAction';
      await page.goto(
        `http://127.0.0.1:3010/human-motion/?event=${event}&actor=${actor}&take=${take}`,
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
      const times =
        event === 'running'
          ? [0.5, 0.7, 0.85, 1, 1.15, 1.3, 1.65, 2]
          : event === 'fighting'
            ? [0.5, 1, 1.4, 1.8, 2.3, 3, 4, 5]
            : [0.2, 0.5, 0.75, 0.95, 1.1, 1.35, 1.7, 2.3];
      let previous = 0;
      const states = [];
      for (let i = 0; i < times.length; i++) {
        await page.evaluate(
          (dt) => window.__HERO_MOTION__.step(dt),
          times[i] - previous,
        );
        previous = times[i];
        await page
          .locator('canvas')
          .screenshot({ path: `${out}/${event}-${actor}-${i}.png` });
        states.push(
          await page.evaluate(() => window.__HERO_MOTION__.getState()),
        );
      }
      await fs.writeFile(
        `${out}/${event}-${actor}.json`,
        JSON.stringify(states),
      );
      console.log(event, actor);
    }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
