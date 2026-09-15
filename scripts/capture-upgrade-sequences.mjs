import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const base = process.argv[2] ?? 'after';
const before = base.startsWith('before');
const url = before ? 'http://127.0.0.1:3017' : 'http://127.0.0.1:3015';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const out = `work/qa/animation-upgrade/sequences/${base}`;
await fs.mkdir(out, { recursive: true });
let manifest = [];
try {
  manifest = JSON.parse(await fs.readFile(`${out}/manifest.json`, 'utf8'));
} catch {}
const actions = [
  ['basketball', 'primaryAction'],
  ['running', 'run-stop'],
  ['cornhole', 'primaryAction'],
  ['cornhole', 'chestTap'],
  ['cornhole', 'bagFlip'],
  ['cornhole', 'fistPump'],
  ['fighting', 'matchup'],
];
try {
  for (const actor of ['doug', 'dan']) {
    for (const [event, take] of actions) {
      for (const rate of !before &&
      actor === 'doug' &&
      ['basketball', 'running'].includes(event)
        ? [1, 0.25]
        : [1]) {
        const name = `${actor}-${event}-${take}-${rate}x`;
        if (manifest.some((m) => m.name === name)) continue;
        const directory = `${out}/${name}`;
        await fs.mkdir(directory, { recursive: true });
        await page.goto(
          `${url}/human-motion/?event=${event}&actor=${actor}${take === 'matchup' ? '' : '&take=' + take}`,
        );
        await page.waitForFunction(
          () => window.__HERO_MOTION__?.getState().actors,
        );
        await page.evaluate(
          ({ actor, rate }) =>
            window.__HERO_MOTION__.view({
              focus: rate === 1 ? 'arena' : actor,
              skeleton: false,
              trails: false,
            }),
          { actor, rate },
        );
        const seconds = take === 'matchup' ? 4 : 3,
          frames = Math.ceil((seconds / rate) * 30);
        const samples = [];
        for (let f = 0; f < frames; f++) {
          const frame = await page.evaluate(
            async ({ dt, sample }) => {
              const api = window.__HERO_MOTION__;
              api.step(dt);
              await new Promise((r) =>
                requestAnimationFrame(() => requestAnimationFrame(r)),
              );
              return {
                image: document
                  .querySelector('canvas')
                  .toDataURL('image/jpeg', 0.9)
                  .split(',')[1],
                state: sample ? api.getState() : null,
              };
            },
            { dt: rate / 30, sample: f % 6 === 0 },
          );
          await fs.writeFile(
            `${directory}/${String(f).padStart(4, '0')}.jpg`,
            Buffer.from(frame.image, 'base64'),
          );
          if (f % 6 === 0) samples.push(frame.state);
        }
        await fs.writeFile(
          `${directory}/samples.json`,
          JSON.stringify(samples),
        );
        manifest.push({
          name,
          event,
          take,
          actor,
          rate,
          frames,
          fps: 30,
          seconds,
          directory,
        });
        await fs.writeFile(
          `${out}/manifest.json`,
          JSON.stringify(manifest, null, 2),
        );
        console.log(`${base}: ${name} (${frames} frames)`);
      }
    }
  }
} finally {
  await browser.close();
}
