import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const dir = 'work/qa/cornhole-motion-v2';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
      viewport: { width: 1500, height: 1080 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3010/?scenario=cornhole-recorded');
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  const evidence = [];
  for (const name of [
    'anticipation',
    'release',
    'flight',
    'landing',
    'recovery',
    'doug-anticipation',
    'doug-release',
    'doug-follow',
    'doug-recovery',
  ]) {
    await page.evaluate((n) => window.__HERO_ARENA__.seekCheckpoint(n), name);
    const s = await page.evaluate(() => window.__HERO_ARENA__.getState());
    await page
      .locator('#arena canvas')
      .screenshot({ path: `${dir}/${name}.png` });
    evidence.push({ checkpoint: name, state: s });
  }
  for (const character of ['dan', 'doug']) {
    await page.goto(
      `http://127.0.0.1:3010/loongbones/doug/?character=${character}`,
    );
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    for (const [style, time] of [
      ['flat', 0],
      ['flat', 0.55],
      ['flat', character === 'dan' ? 61 / 60 : 55 / 60],
      ['flat', character === 'dan' ? 74 / 60 : 67 / 60],
      ['airmail', character === 'dan' ? 68 / 60 : 62 / 60],
    ]) {
      await page.evaluate(
        ({ clip, time }) => {
          const a = window.__HERO_WEIGHTED_RIG__;
          a.reset(clip);
          a.step(time);
        },
        { clip: `cornhole_throw_${style}_R_${character}`, time },
      );
      await page
        .locator('#stage canvas')
        .screenshot({
          path: `${dir}/${character}-${style}-${time.toFixed(3)}.png`,
        });
    }
  }
  await fs.writeFile(
    `${dir}/audit.json`,
    JSON.stringify({ evidence, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      errors,
      release: evidence
        .filter((e) => e.checkpoint.endsWith('release'))
        .map((e) => ({
          checkpoint: e.checkpoint,
          characters: e.state.characters.map((c) => ({
            rig: c.rigDetails,
            hand: c.sockets.throwingHand,
          })),
          projectile: e.state.event.projectile.filter(
            (p) => p.visible && !p.attached,
          ),
        })),
    }),
  );
} finally {
  await browser.close();
}
