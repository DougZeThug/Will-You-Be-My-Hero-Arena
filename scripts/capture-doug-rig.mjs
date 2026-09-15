import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
import { decodeMotion } from './decode-motion.mjs';
const directory = 'work/qa/doug-weighted-motion';
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3010/loongbones/doug/');
  await page.waitForFunction(
    () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
  );
  const capture = await page.evaluate(async () => {
    const api = window.__HERO_WEIGHTED_RIG__,
      stream = document.querySelector('#stage canvas').captureStream(60),
      chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 5000000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.start();
    const start = performance.now(),
      segments = [];
    for (const [clip, duration] of [
      ['neutral', 1],
      ['enter_lockin', 1.8],
      ['idle_scan', 3.6],
      ['weight_shift', 3],
      ['cornhole_throw_flat_R_doug', 2.3],
      ['cornhole_throw_airmail_R_doug', 2.8],
      ['celebrate_open_hand', 2.3],
      ['inspect_hand', 2],
    ]) {
      api.reset(clip);
      segments.push({
        clip,
        start: (performance.now() - start) / 1000,
        duration,
      });
      api.play();
      await new Promise((resolve) => setTimeout(resolve, duration * 1000));
      api.pause();
    }
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });
    stream.getTracks().forEach((t) => t.stop());
    return {
      bytes: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())),
      segments,
    };
  });
  await fs.writeFile(
    `${directory}/doug-motion.webm`,
    Buffer.from(capture.bytes),
  );
  const times = capture.segments.flatMap((s) =>
    s.clip.startsWith('cornhole_throw_')
      ? [
          s.start + 0.45,
          s.start + 0.65,
          s.start + 0.85,
          s.start + 1.1,
          s.start + 1.6,
        ]
      : [s.start + s.duration * 0.48],
  );
  const frames = await page.evaluate(decodeMotion, {
    bytes: capture.bytes,
    times,
  });
  for (const [i, frame] of frames.entries())
    await fs.writeFile(
      `${directory}/frame-${i}.png`,
      Buffer.from(frame.png, 'base64'),
    );
  await fs.writeFile(
    `${directory}/motion.json`,
    JSON.stringify(
      {
        segments: capture.segments,
        frames: frames.map(({ png, ...f }) => f),
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      segments: capture.segments,
      frames: frames.length,
      errors,
    }),
  );
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
