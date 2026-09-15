import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const label = process.argv[2] ?? 'after';
const out = `work/qa/performance-upgrade/${label}`;
const base = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [],
  manifest = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  for (const event of ['cornhole', 'running', 'basketball', 'fighting']) {
    for (const actor of event === 'fighting' ? ['doug'] : ['doug', 'dan']) {
      for (const rate of label === 'before' ? [1] : [1, 0.25]) {
        const take =
          event === 'running'
            ? 'run-stop'
            : event === 'fighting'
              ? ''
              : 'primaryAction';
        const seconds = event === 'fighting' ? 6 : 3;
        const name = `${event}-${actor}-${rate}`;
        if (
          process.env.ARENA_CAPTURE_FILTER &&
          !name.includes(process.env.ARENA_CAPTURE_FILTER)
        )
          continue;
        const dir = `${out}/${name}`;
        await fs.mkdir(dir, { recursive: true });
        await page.goto(
          `${base}/human-motion/?event=${event}&actor=${actor}&take=${take}&organic=1`,
        );
        await page.waitForFunction(
          () => window.__HERO_MOTION__?.getState().actors,
        );
        await page.evaluate(
          ({ actor, rate, event }) =>
            window.__HERO_MOTION__.view({
              focus: rate === 1 || event === 'fighting' ? 'arena' : actor,
              skeleton: false,
              trails: false,
            }),
          { actor, rate, event },
        );
        const samples = [];
        const frames = Math.round((seconds * 30) / rate);
        for (let f = 0; f < frames; f++) {
          const data = await page.evaluate(
            async ({ dt, sample }) => {
              window.__HERO_MOTION__.step(dt);
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              return {
                image: document
                  .querySelector('canvas')
                  .toDataURL('image/jpeg', 0.91)
                  .split(',')[1],
                state: sample ? window.__HERO_MOTION__.getState() : null,
              };
            },
            { dt: rate / 30, sample: f % 10 === 0 },
          );
          await fs.writeFile(
            `${dir}/${String(f).padStart(4, '0')}.jpg`,
            Buffer.from(data.image, 'base64'),
          );
          if (data.state) samples.push(data.state);
        }
        await fs.writeFile(`${dir}/states.json`, JSON.stringify(samples));
        manifest.push({
          name,
          event,
          actor,
          rate,
          seconds,
          frames,
          fps: 30,
          directory: dir,
        });
        await fs.writeFile(
          `${out}/manifest.json`,
          JSON.stringify(
            {
              label,
              base,
              viewport: { width: 1440, height: 1080 },
              manifest,
              errors,
            },
            null,
            2,
          ),
        );
        console.log(`${label} ${name}: ${frames} frames`);
      }
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
