import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserLaunchOptions } from './qa-server.mjs';
const editorExport = process.argv.includes('--editor-export');
const directory = editorExport
  ? 'work/qa/loongbones-editor-export'
  : 'work/qa/loongbones-proof';
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  await page.goto(
    `${process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010'}/loongbones/${editorExport ? '?sample=editor' : ''}`,
  );
  await page.waitForFunction(
    () => window.__HERO_LOONGBONES_PROOF__?.getState().ready,
  );
  if (editorExport)
    await page.waitForFunction(
      () =>
        window.__HERO_LOONGBONES_PROOF__.getState()
          .freshLoongBonesExportVerified,
    );
  const result = await page.evaluate(async (editorExport) => {
    const api = window.__HERO_LOONGBONES_PROOF__;
    const canvas = document.querySelector('#stage canvas');
    api.play();
    await new Promise((resolve) => setTimeout(resolve, 500));
    api.pause();
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 2_500_000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const completed = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    api.play();
    // Warm the browser encoder before the action being inspected.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    api.reset();
    api.play();
    if (editorExport) {
      for (const [clip, duration] of [
        ['stand', 1200],
        ['walk', 1800],
        ['turn face', 4000],
        ['atc', 1500],
      ]) {
        api.clip(clip, 'sample', 0.18);
        await new Promise((resolve) => setTimeout(resolve, duration));
      }
    } else {
      api.clip('walk', 'sample', 0.18);
      api.clip('throw', 'arm', 0);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    api.pause();
    recorder.stop();
    await completed;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    const video = document.createElement('video'),
      url = URL.createObjectURL(blob);
    video.src = url;
    video.muted = true;
    await new Promise((resolve) => (video.onloadeddata = resolve));
    const frames = [],
      targets = editorExport
        ? [1.2, 1.7, 2.5, 3.3, 4.3, 5.4, 7.5, 8.4, 9.1]
        : [1.1, 1.28, 1.4, 1.7, 2.2, 3.2];
    // Sample presented decoded frames. `seeked` alone can expose a stale WebGL/video frame.
    video.style.cssText =
      'position:fixed;left:-2000px;width:1200px;height:680px';
    document.body.append(video);
    for (const time of targets) {
      const mediaTime = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error('Video frame inspection timed out')),
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
      snapshot: api.getState(),
    };
  }, editorExport);
  await fs.writeFile(
    path.join(directory, 'native-motion.webm'),
    Buffer.from(result.video),
  );
  for (const frame of result.frames)
    await fs.writeFile(
      path.join(directory, `frame-${frame.time}.png`),
      Buffer.from(frame.image, 'base64'),
    );
  await page.evaluate(() => {
    const api = window.__HERO_LOONGBONES_PROOF__;
    api.reset();
    api.clip('walk');
    api.step(0.3);
  });
  await page.screenshot({
    path: path.join(directory, 'proof-page.png'),
    fullPage: true,
  });
  // Separate unrecorded short performance sample from video-encoding overhead.
  await page.evaluate(() => {
    const api = window.__HERO_LOONGBONES_PROOF__;
    api.reset();
    api.clip('walk');
    api.play();
  });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.pause());
  const performance = await page.evaluate(
    () => window.__HERO_LOONGBONES_PROOF__.getState().performance,
  );
  const report = {
    capturedAt: new Date().toISOString(),
    scenario: editorExport
      ? 'supplied-loongbones-1.2.3-export'
      : 'official-reference-and-authored-fixture',
    clips: editorExport
      ? ['stand', 'walk', 'turn face', 'atc']
      : ['walk', 'throw'],
    viewport: { width: 1440, height: 1200 },
    errors,
    note: 'Actual canvas capture at normal speed; unrecorded headless desktop performance is not a hardware guarantee.',
    encoderPrerollSeconds: 1,
    decodedFrames: result.frames.map((f) => ({
      requestedTime: f.time,
      presentedTime: f.mediaTime,
    })),
    snapshot: result.snapshot,
    unrecordedPerformance: performance,
  };
  await fs.writeFile(
    path.join(directory, 'state.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      errors,
      performance,
      video: path.join(directory, 'native-motion.webm'),
      events: result.snapshot.events,
    }),
  );
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
