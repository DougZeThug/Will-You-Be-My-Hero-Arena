import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage();
  for (const id of ['dan', 'doug']) {
    await page.goto(
      'http://127.0.0.1:3015/human-motion/?event=basketball&actor=' +
        id +
        '&take=primaryAction',
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    console.log(
      JSON.stringify(
        await page.evaluate((id) => {
          const api = window.__HERO_MOTION__;
          api.step(3.333333333333);
          const s = api.getState(),
            a = s.actors.find((a) => a.id === id);
          return { id, score: a.score, projectile: s.event.projectiles[0] };
        }, id),
      ),
    );
  }
} finally {
  await browser.close();
}
