import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const out = process.argv[2] ?? 'work/qa/v3-probe';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [event, take, actor] of [
    ['cornhole', 'personality', 'doug'],
    ['running', 'run-stop', 'dan'],
    ['basketball', 'primaryAction', 'dan'],
    ['basketball', 'primaryAction', 'doug'],
    ['fighting', '', 'dan'],
  ]) {
    if (process.argv[3] && event !== process.argv[3]) continue;
    await page.goto(
      `http://127.0.0.1:3010/human-motion/?event=${event}&take=${take}&actor=${actor}`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.evaluate(() =>
      window.__HERO_MOTION__.view({ skeleton: false, trails: false }),
    );
    const rows = [];
    let t = 0;
    for (const until of [
      0.2, 0.4, 0.65, 0.8, 1, 1.2, 1.45, 1.8, 2.3, 3.2, 4.3, 5.6,
    ]) {
      const result = await page.evaluate(
        ({ seconds }) => {
          const api = window.__HERO_MOTION__;
          const rows = [];
          for (let k = 0; k < Math.round(seconds * 120); k++) {
            api.step(1 / 120);
            const s = api.getState();
            rows.push({
              time: s.time,
              actors: s.actors.map((a) => ({
                id: a.id,
                root: a.motor.position,
                velocity: a.motor.velocity,
                grounded: a.motor.grounded,
                height: a.motor.height,
                feet: a.rig.feet,
                stride: a.strideFit,
                limbs: a.motion.limbLengthError,
                maxStep: a.motion.maxStep,
                joints: a.motion.latest.joints,
                phase: a.phase,
                compression: a.contacts.compression,
              })),
              projectiles: s.event.projectiles,
            });
          }
          return { rows, state: api.getState() };
        },
        { seconds: until - t },
      );
      rows.push(...result.rows);
      t = until;
      await page
        .locator('canvas')
        .screenshot({ path: `${out}/${event}-${actor}-${until}.png` });
      await fs.writeFile(
        `${out}/${event}-${actor}-state.json`,
        JSON.stringify(result.state, null, 2),
      );
    }
    await fs.writeFile(
      `${out}/${event}-${actor}-rows.json`,
      JSON.stringify(rows),
    );
    console.log(event, actor, JSON.stringify({ errors }));
  }
} finally {
  await browser.close();
}
