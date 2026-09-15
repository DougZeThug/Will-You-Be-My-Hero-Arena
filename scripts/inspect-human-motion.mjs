import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const dir =
  process.argv.find((a) => a.startsWith('--out='))?.slice(6) ??
  'work/qa/human-motion/first';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  for (const event of ['cornhole', 'running', 'basketball', 'fighting']) {
    const page = await browser.newPage({
        viewport: { width: 1500, height: 1100 },
      }),
      errors = [];
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.log(e.stack);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('http://127.0.0.1:3010/human-motion/?event=' + event);
    await page
      .waitForFunction(() => window.__HERO_MOTION__?.getState().actors, {
        timeout: 15000,
      })
      .catch(async (e) => {
        console.log(await page.locator('body').innerText());
        throw e;
      });
    for (const time of [0.1, 0.4, 0.7, 1.1, 1.5, 2.4, 4]) {
      await page.evaluate((t) => {
        const api = window.__HERO_MOTION__;
        api.step(Math.max(0, t - api.getState().time));
      }, time);
      await page.waitForTimeout(70);
      await page
        .locator('canvas')
        .screenshot({ path: `${dir}/${event}-${time}.png` });
      await fs.writeFile(
        `${dir}/${event}-${time}.json`,
        JSON.stringify(
          await page.evaluate(() => window.__HERO_MOTION__.getState()),
          null,
          2,
        ),
      );
    }
    console.log(
      event,
      JSON.stringify({
        errors,
        ...(await page.evaluate(() => {
          const s = window.__HERO_MOTION__.getState();
          return {
            actors: s.actors.map((a) => ({
              id: a.id,
              health: a.health,
              score: a.score,
              motor: a.motor,
              feet: a.rig.feet,
              maxStep: a.motion.maxStep,
            })),
            event: s.event,
          };
        })),
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
