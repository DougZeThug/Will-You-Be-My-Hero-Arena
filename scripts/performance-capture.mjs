import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserLaunchOptions } from './qa-server.mjs';
const directory = 'work/qa/performance-review';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    (process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3020') + '/performance/',
  );
  await page.getByRole('status').filter({ hasText: 'Doug · idle' }).waitFor();
  await page.getByRole('checkbox', { name: 'Close view', exact: true }).check();
  for (const character of ['doug', 'dan']) {
    await page.evaluate((c) => window.__HERO_PERFORMANCE__.load(c), character);
    const catalog = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.catalog(),
    );
    for (const name of [
      'anticipate',
      'windup',
      'release',
      'followThrough',
      'celebrate',
      'recover',
    ]) {
      await page.evaluate(
        (t) => window.__HERO_PERFORMANCE__.seek(t),
        catalog.checkpoints.find((c) => c.name === name).time,
      );
      await page
        .locator('#stage')
        .screenshot({ path: `${directory}/${character}-${name}.png` });
    }
  }
  await page
    .getByRole('checkbox', { name: 'Close view', exact: true })
    .uncheck();
  // Chrome's canvas recorder avoids a separate FFmpeg installation for local QA.
  await page.evaluate(() => {
    const chunks = [];
    const recorder = new MediaRecorder(
      document.querySelector('#stage canvas').captureStream(60),
      {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 4_000_000,
      },
    );
    window.__reviewRecording = {
      recorder,
      finished: new Promise((resolve) => {
        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = () => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
        };
      }),
    };
    recorder.start();
  });
  const realTime = {};
  for (const character of ['doug', 'dan']) {
    await page.evaluate((c) => window.__HERO_PERFORMANCE__.load(c), character);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__HERO_PERFORMANCE__
          .getState()
          .performance.events.some((e) => e.name === 'ACTION_COMPLETED'),
      null,
      { timeout: 25000 },
    );
    realTime[character] = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.getState(),
    );
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page
      .locator('#stage')
      .screenshot({ path: `${directory}/${character}-complete.png` });
  }
  await writeFile(
    `${directory}/review.json`,
    JSON.stringify(
      {
        scenario: 'performance/cornhole',
        viewport: [1440, 1080],
        runtime: 'Phaser 3.90 / LoongBones',
        realTime,
        errors,
      },
      null,
      2,
    ),
  );
  const video = await page.evaluate(async () => {
    const recording = window.__reviewRecording;
    recording.recorder.stop();
    const result = await recording.finished;
    for (const track of recording.recorder.stream.getTracks()) track.stop();
    delete window.__reviewRecording;
    return result;
  });
  await writeFile(
    `${directory}/performance-review.webm`,
    Buffer.from(video.split(',')[1], 'base64'),
  );
  await context.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    JSON.stringify({
      errors,
      characters: Object.fromEntries(
        Object.entries(realTime).map(([id, take]) => [
          id,
          {
            frameTiming: take.frameTiming,
            rigWarnings: take.rig.warnings,
            events: take.performance.events.length,
          },
        ]),
      ),
      video: `${directory}/performance-review.webm`,
    }),
  );
} finally {
  await browser.close();
}
