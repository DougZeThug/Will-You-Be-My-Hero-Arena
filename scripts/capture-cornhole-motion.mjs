import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
import { decodeMotion } from './decode-motion.mjs';
const side = process.argv.includes('--side');
const dir =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  (side ? 'work/qa/cornhole-side-v3' : 'work/qa/cornhole-motion-v2');
await fs.mkdir(dir, { recursive: true });
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
  for (const character of ['dan', 'doug']) {
    await page.goto(
      `http://127.0.0.1:3010/loongbones/doug/?character=${character}${side ? '' : '&version=2'}`,
    );
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const capture = await page.evaluate(async (character) => {
      const api = window.__HERO_WEIGHTED_RIG__,
        data = await (await fetch(api.getState().rig.skeleton)).json();
      const animations = data.armature[0].animation,
        playlist = [
          'idle_breathe',
          'weight_shift',
          `cornhole_throw_flat_R_${character}`,
          `cornhole_throw_airmail_R_${character}`,
          character === 'dan' ? 'quiet_nod' : 'celebrate_open_hand',
        ];
      const stream = document.querySelector('#stage canvas').captureStream(60),
        chunks = [],
        recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8',
          videoBitsPerSecond: 5000000,
        });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.start();
      const start = performance.now(),
        segments = [];
      for (const clip of playlist) {
        const authored = animations.find((a) => a.name === clip),
          duration = authored.duration / 60 + 0.15;
        api.reset(clip);
        segments.push({
          clip,
          start: (performance.now() - start) / 1000,
          duration,
          marker: clip.startsWith('cornhole')
            ? api.getState().rig.releaseMarker
            : null,
        });
        api.play();
        await new Promise((r) => setTimeout(r, duration * 1000));
        api.pause();
      }
      await new Promise((r) => {
        recorder.onstop = r;
        recorder.stop();
      });
      stream.getTracks().forEach((t) => t.stop());
      return {
        bytes: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())),
        segments,
      };
    }, character);
    await fs.writeFile(`${dir}/${character}.webm`, Buffer.from(capture.bytes));
    const times = capture.segments.flatMap((s) =>
      s.marker === null
        ? [s.start + s.duration * 0.5]
        : [-0.24, -0.12, 0, 0.12, 0.3, 0.65].map((t) => s.start + s.marker + t),
    );
    const frames = await page.evaluate(decodeMotion, {
      bytes: capture.bytes,
      times,
    });
    for (const [i, f] of frames.entries())
      await fs.writeFile(
        `${dir}/${character}-motion-${i}.png`,
        Buffer.from(f.png, 'base64'),
      );
    await fs.writeFile(
      `${dir}/${character}-motion.json`,
      JSON.stringify(
        {
          segments: capture.segments,
          frames: frames.map(({ png, ...m }) => m),
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ character, frames: frames.length, errors }));
  }
} finally {
  await browser.close();
}
