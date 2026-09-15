import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const characters = [];
try {
  const page = await browser.newPage();
  for (const id of ['doug', 'dan']) {
    await page.goto(
      `http://127.0.0.1:3015/human-motion/?event=cornhole&actor=${id}&take=primaryAction`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const result = await page.evaluate((id) => {
      const api = window.__HERO_MOTION__,
        initial = api.soles(id);
      let maximum = 0,
        release = null;
      for (let i = 0; i < 360; i++) {
        api.step(1 / 120);
        api.soles(id).forEach((p, j) => {
          maximum = Math.max(
            maximum,
            Math.hypot(p.x - initial[j].x, p.y - initial[j].y),
          );
        });
      }
      const s = api.getState(),
        a = s.actors.find((a) => a.id === id);
      return {
        id,
        soleSamples: initial.length,
        maximumSoleDrift: maximum,
        footLocks: a.rig.feet,
        projectile: s.event.projectiles.find((p) => p.owner === id),
        rig: a.rig.integrity,
      };
    }, id);
    characters.push(result);
    console.log(
      JSON.stringify({ id, maximumSoleDrift: result.maximumSoleDrift }),
    );
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  'docs/review/animation-upgrade/contact-measurements.json',
  JSON.stringify(
    {
      units: 'world pixels',
      method:
        'Actual rendered sole vertices, compared with initial planted stance through three seconds of the primary cornhole action at 120 Hz; both characters.',
      characters,
    },
    null,
    2,
  ),
);
