import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
import { decodeMotion } from './decode-motion.mjs';
const arg = (key, fallback) =>
  process.argv
    .find((v) => v.startsWith('--' + key + '='))
    ?.slice(key.length + 3) ?? fallback;
const out = arg('out', 'work/qa/human-motion/motion');
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
  await page.route('**/__motion_decode__', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Motion QA decode</title>',
    }),
  );
  for (const event of arg(
    'events',
    'cornhole,running,basketball,fighting',
  ).split(','))
    for (const rate of arg('rates', '1,.5,.25').split(',').map(Number)) {
      const query = arg('query', '');
      const actor = arg('actor', 'dan');
      const take =
        arg('takes', '0') === '1'
          ? `&actor=${actor}&take=${arg('action', event === 'running' ? 'run-stop' : 'primaryAction')}`
          : '';
      await page.goto(
        `${arg('url', 'http://127.0.0.1:3010')}/human-motion/?event=${event}${take}${query ? '&' + query : ''}`,
      );
      await page.waitForFunction(
        () => window.__HERO_MOTION__?.getState().actors,
      );
      const capture = await page.evaluate(
        async ({ rate, seconds, silhouette }) => {
          const api = window.__HERO_MOTION__;
          api.view({ skeleton: false, trails: false, silhouette });
          api.setRate(rate);
          const source = document.querySelector('canvas'),
            canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 760;
          const context = canvas.getContext('2d'),
            stream = canvas.captureStream(0),
            track = stream.getVideoTracks()[0],
            chunks = [];
          let raf = 0,
            last = -Infinity;
          const copy = (now = 0) => {
            if (now - last >= 30) {
              context.drawImage(source, 0, 0);
              track.requestFrame();
              last = now;
            }
            raf = requestAnimationFrame(copy);
          };
          const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: 3500000,
          });
          recorder.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
          };
          recorder.start();
          const start = performance.now();
          copy();
          await new Promise((r) => setTimeout(r, 900));
          const samples = [
            { wall: (performance.now() - start) / 1000, game: 0 },
          ];
          api.resume();
          while (api.getState().time < seconds) {
            await new Promise((r) => setTimeout(r, 70));
            samples.push({
              wall: (performance.now() - start) / 1000,
              game: api.getState().time,
            });
            if (performance.now() - start > 60000)
              throw Error('Motion proof stalled');
          }
          api.pause();
          await new Promise((r) => {
            recorder.onstop = r;
            recorder.stop();
          });
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          return {
            bytes: Array.from(
              new Uint8Array(await new Blob(chunks).arrayBuffer()),
            ),
            samples,
            state: api.getState(),
            performance: api.getPerformance(),
          };
        },
        {
          rate,
          seconds: Number(arg('seconds', '4')),
          silhouette: arg('silhouette', '0') === '1',
        },
      );
      const name = `${event}-${rate}x`;
      await fs.writeFile(`${out}/${name}.webm`, Buffer.from(capture.bytes));
      const gameTimes = arg('checkpoints', '0.2,0.4,0.6,0.8,1.1,1.5,2.2,3.2')
        .split(',')
        .map(Number);
      const times = gameTimes.map((t) => {
        const b = capture.samples.findIndex((s) => s.game >= t),
          p = capture.samples[Math.max(0, b - 1)],
          q = capture.samples[b];
        return (
          p.wall +
          ((q.wall - p.wall) * (t - p.game)) / Math.max(0.0001, q.game - p.game)
        );
      });
      await page.goto(
        arg('url', 'http://127.0.0.1:3010') + '/__motion_decode__',
      );
      const frames = await page.evaluate(decodeMotion, {
        bytes: capture.bytes,
        times,
      });
      const sheet = await page.evaluate(
        async ({ frames, gameTimes, name }) => {
          const c = document.createElement('canvas');
          c.width = 1280;
          c.height = 1640;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#e9e0c8';
          ctx.fillRect(0, 0, c.width, c.height);
          for (let i = 0; i < frames.length; i++) {
            const image = new Image();
            image.src = 'data:image/png;base64,' + frames[i].png;
            await image.decode();
            const x = (i % 2) * 640,
              y = Math.floor(i / 2) * 410;
            ctx.drawImage(image, x, y + 24, 640, 380);
            ctx.fillStyle = '#161f19';
            ctx.font = '14px sans-serif';
            ctx.fillText(
              `${name} / game ${gameTimes[i].toFixed(2)}s`,
              x + 8,
              y + 17,
            );
          }
          return c.toDataURL('image/png').split(',')[1];
        },
        { frames, gameTimes, name },
      );
      await fs.writeFile(`${out}/${name}.png`, Buffer.from(sheet, 'base64'));
      await fs.writeFile(
        `${out}/${name}.json`,
        JSON.stringify(
          {
            event,
            rate,
            samples: capture.samples,
            state: capture.state,
            performance: capture.performance,
            decode: frames.map(({ time, decodedTime }) => ({
              requested: time,
              decodedTime,
            })),
            errors,
          },
          null,
          2,
        ),
      );
      console.log('Reviewed capture ready:', name, 'errors:', errors.length);
    }
  // Unrecorded real-time telemetry, separate from capture overhead and manual stepping.
  await page.goto(
    'http://127.0.0.1:3010/human-motion/?event=' +
      arg('perf-event', 'basketball'),
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.evaluate(() => {
    window.__HERO_MOTION__.view({ skeleton: false, trails: false });
    window.__HERO_MOTION__.resume();
  });
  await page.waitForTimeout(12000);
  await fs.writeFile(
    `${out}/unrecorded-performance.json`,
    JSON.stringify(
      await page.evaluate(() => window.__HERO_MOTION__.getPerformance()),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
