import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const sample = process.argv.includes('--editor')
  ? 'editor'
  : process.argv.includes('--restored')
    ? 'restored'
    : 'authored';
const directory =
  sample === 'authored'
    ? 'work/qa/dan-weighted-motion'
    : `work/qa/dan-${sample}-motion`;
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `${process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010'}/loongbones/dan/?sample=${sample}`,
  );
  await page.waitForFunction(() => window.__HERO_DAN_RIG__?.getState().ready);
  const result = await page.evaluate(async () => {
    const api = window.__HERO_DAN_RIG__;
    const canvas = document.querySelector('#stage canvas');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 4_000_000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    api.play();
    await wait(1000);
    const checkpoints = [];
    for (const [clip, duration] of [
      ['idle_breathe', 3000],
      ['weight_shift', 3100],
      ['arm_check', 2600],
      ['throw_low', 2700],
      ['quiet_nod', 1700],
    ]) {
      api.reset(clip);
      api.play();
      await wait(duration);
      api.pause();
      const { meshes, ...snapshot } = api.getState();
      checkpoints.push(snapshot);
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob),
      video = document.createElement('video');
    const loaded = new Promise((resolve) => {
      video.onloadeddata = resolve;
    });
    video.src = url;
    video.muted = true;
    video.style.cssText =
      'position:fixed;left:-2000px;width:1280px;height:760px';
    document.body.append(video);
    await loaded;
    const frames = [];
    for (const time of [
      1.5, 3, 5.4, 8.2, 9.5, 10.2, 10.55, 10.9, 11.65, 12.2, 13.1,
    ]) {
      const mediaTime = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error('Decoded video frame timed out')),
          5000,
        );
        video.requestVideoFrameCallback((_now, metadata) => {
          clearTimeout(timer);
          resolve(metadata.mediaTime);
        });
        video.currentTime = time;
      });
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      frames.push({
        time,
        mediaTime,
        image: c.toDataURL('image/png').split(',')[1],
      });
    }
    video.remove();
    URL.revokeObjectURL(url);
    return {
      video: Array.from(new Uint8Array(await blob.arrayBuffer())),
      frames,
      checkpoints,
    };
  });
  await fs.writeFile(`${directory}/dan-motion.webm`, Buffer.from(result.video));
  for (const frame of result.frames)
    await fs.writeFile(
      `${directory}/frame-${frame.time}.png`,
      Buffer.from(frame.image, 'base64'),
    );
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('idle_breathe');
    a.play();
  });
  await page.waitForTimeout(3000);
  const performance = await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.pause();
    return a.getState().performance;
  });
  const report = {
    capturedAt: new Date().toISOString(),
    sample,
    errors,
    viewport: { width: 1440, height: 1100 },
    note: 'Normal-speed WebGL canvas recording, 1s encoder preroll; decoded frames inspected separately. Unrecorded headless desktop timing is not a hardware guarantee.',
    performance,
    checkpoints: result.checkpoints,
    decodedFrames: result.frames.map(({ time, mediaTime }) => ({
      requestedTime: time,
      presentedTime: mediaTime,
    })),
  };
  await fs.writeFile(
    `${directory}/state.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await page.screenshot({
    path: `${directory}/review-page.png`,
    fullPage: true,
  });
  console.log(JSON.stringify({ directory, errors, performance }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
