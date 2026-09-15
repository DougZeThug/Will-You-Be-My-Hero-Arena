import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
import { decodeMotion } from './decode-motion.mjs';
const out =
  process.argv.find((a) => a.startsWith('--output='))?.slice(9) ??
  'work/qa/biomechanics/motion';
const people = process.argv.includes('--dan-only')
  ? ['dan']
  : process.argv.includes('--doug-only')
    ? ['doug']
    : ['dan', 'doug'];
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
  });
  const errors = [];
  await page.route('**/__qa_decode__', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Recorded motion decode</title>',
    }),
  );
  page.on('pageerror', (e) => errors.push(e.message));
  for (const character of people) {
    for (const silhouette of [false, true]) {
      const stem = `${character}-${silhouette ? 'silhouette' : 'art'}`;
      await page.goto(
        `http://127.0.0.1:3010/loongbones/doug/?character=${character}`,
      );
      await page.waitForFunction(
        () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
      );
      const cached = process.argv.includes('--reuse-captures')
        ? await fs
            .readFile(`${out}/${stem}.json`, 'utf8')
            .then(JSON.parse)
            .catch(() => null)
        : null;
      const capture = cached
        ? {
            ...cached,
            bytes: Array.from(await fs.readFile(`${out}/${stem}.webm`)),
          }
        : await page.evaluate(
            async ({ character, silhouette }) => {
              const api = window.__HERO_WEIGHTED_RIG__;
              api.view({
                silhouette,
                overlay: false,
                court: false,
                mirrored: false,
              });
              const clip = `cornhole_throw_flat_R_${character}`;
              api.reset(clip);
              const state = api.getState(),
                segments = [];
              const source = document.querySelector('#stage canvas');
              const captureCanvas = document.createElement('canvas');
              captureCanvas.width = 510;
              captureCanvas.height = 680;
              const captureContext = captureCanvas.getContext('2d');
              const stream = captureCanvas.captureStream(0),
                chunks = [];
              const track = stream.getVideoTracks()[0];
              let raf = 0,
                lastCopy = -Infinity;
              const copyFrame = (now = 0) => {
                if (now - lastCopy >= 30) {
                  captureContext.drawImage(
                    source,
                    720,
                    50,
                    510,
                    680,
                    0,
                    0,
                    510,
                    680,
                  );
                  track.requestFrame();
                  lastCopy = now;
                }
                raf = requestAnimationFrame(copyFrame);
              };
              const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8',
                videoBitsPerSecond: 2200000,
              });
              recorder.ondataavailable = (e) => {
                if (e.data.size) chunks.push(e.data);
              };
              recorder.start();
              const start = performance.now();
              copyFrame();
              // Warm the encoder before the first action; capture every explicitly
              // copied render, including small mesh-only changes on a WebGL canvas.
              await new Promise((r) => setTimeout(r, 900));
              for (const rate of [1, 0.5, 0.25]) {
                api.reset(clip);
                api.setPlaybackRate(rate);
                const wallStart = (performance.now() - start) / 1000;
                const samples = [];
                api.play();
                // Completion follows the actual Phaser clock, not a guessed wall timeout.
                while (api.getState().seconds < state.duration + 0.12) {
                  await new Promise((r) => setTimeout(r, 80));
                  samples.push({
                    wall: (performance.now() - start) / 1000,
                    clip: api.getState().seconds,
                  });
                  if (performance.now() - start > 120000)
                    throw Error('Motion clock stalled');
                }
                api.pause();
                segments.push({
                  rate,
                  start: wallStart,
                  samples,
                  performance: api.getState().performance,
                });
              }
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
                segments,
                landmarks: state.landmarks,
              };
            },
            { character, silhouette },
          );
      await fs.writeFile(`${out}/${stem}.webm`, Buffer.from(capture.bytes));
      await fs.writeFile(
        `${out}/${stem}.json`,
        JSON.stringify(
          {
            segments: capture.segments,
            landmarks: capture.landmarks,
            errors,
            capture: { width: 510, height: 680, maximumFps: 30 },
            decodeVerified: false,
          },
          null,
          2,
        ),
      );
      const timings = capture.segments.flatMap((s) =>
        capture.landmarks.map((p) => {
          const upper = s.samples.findIndex((v) => v.clip >= p.seconds);
          if (upper < 0) return s.samples.at(-1).wall;
          const a = upper ? s.samples[upper - 1] : { wall: s.start, clip: 0 },
            b = s.samples[upper];
          return (
            a.wall +
            ((b.wall - a.wall) * (p.seconds - a.clip)) /
              Math.max(0.0001, b.clip - a.clip)
          );
        }),
      );
      // Decode on an empty page so the live WebGL scene and debug snapshots
      // cannot compete with video decoding or reload it through HMR.
      await page.goto('http://127.0.0.1:3010/__qa_decode__');
      const frames = await page.evaluate(decodeMotion, {
        bytes: capture.bytes,
        times: timings,
      });
      // Contact sheets derive from recorded video frames, not re-rendered poses.
      const sheets = await page.evaluate(
        async ({ frames, landmarks }) => {
          const outputs = [];
          for (let run = 0; run < 3; run++) {
            const c = document.createElement('canvas');
            c.width = 1000;
            c.height = 1320;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#e5e2d7';
            ctx.fillRect(0, 0, c.width, c.height);
            for (let i = 0; i < landmarks.length; i++) {
              const img = new Image();
              img.src =
                'data:image/png;base64,' +
                frames[run * landmarks.length + i].png;
              await img.decode();
              const col = i % 5,
                row = Math.floor(i / 5),
                x = col * 200,
                y = row * 330;
              ctx.drawImage(img, 30, 10, 440, 655, x, y + 24, 200, 298);
              ctx.fillStyle = '#17221b';
              ctx.font = '12px sans-serif';
              ctx.fillText(landmarks[i].name, x + 5, y + 15);
            }
            outputs.push(c.toDataURL('image/png').split(',')[1]);
          }
          return outputs;
        },
        { frames, landmarks: capture.landmarks },
      );
      for (let i = 0; i < sheets.length; i++)
        await fs.writeFile(
          `${out}/${stem}-${[1, 0.5, 0.25][i]}x.png`,
          Buffer.from(sheets[i], 'base64'),
        );
      await fs.writeFile(
        `${out}/${stem}.json`,
        JSON.stringify(
          {
            segments: capture.segments,
            landmarks: capture.landmarks,
            decoded: frames.map(({ png, ...f }) => f),
            errors,
            capture: { width: 510, height: 680, maximumFps: 30 },
            decodeVerified: true,
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          character,
          silhouette,
          frames: frames.length,
          errors,
          performance: capture.segments.map((s) => ({
            rate: s.rate,
            ...s.performance,
          })),
        }),
      );
    }
  }
} finally {
  await browser.close();
}
