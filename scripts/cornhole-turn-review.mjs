import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { qaServer, browserLaunchOptions } from './qa-server.mjs';
import { shippedPerformanceRevision } from './performance-revision.mjs';
import { sourceFingerprint } from './source-fingerprint.mjs';

// One repeatable case, not an editor. All state is isolated from the user's saves.
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const label = option('--label', 'candidate');
assert.match(label, /^[a-z0-9-]+$/);
const directory = `work/qa/turn-polish/${label}`;
const labUrl = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3020';
const appUrl = process.env.ARENA_APP_URL ?? 'http://127.0.0.1:3022';
const seed = 'velvet-paw-29',
  viewport = { width: 1440, height: 1080 };
const labOnly = args.includes('--lab-only'),
  journeyOnly = args.includes('--journey-only');
assert.ok(
  !(labOnly && journeyOnly),
  'Choose one partial review mode, or omit both for the complete package.',
);
await assert.rejects(
  access(directory),
  `Review package ${directory} already exists. Use a new --label so baseline and candidate evidence remain separate.`,
);
const startedAt = performance.now();
const marks = {};
const mark = (name) => {
  marks[name] = Number(((performance.now() - startedAt) / 1000).toFixed(3));
};
const revision = option(
  '--expected-runtime',
  await shippedPerformanceRevision(),
);
await mkdir(directory, { recursive: true });
if (args.includes('--build')) {
  execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
  mark('buildComplete');
}
if (args.includes('--require-fresh-build')) {
  const build = JSON.parse(
    await readFile('dist/client/arena-build.json', 'utf8'),
  );
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  assert.equal(
    build.head,
    head,
    'Production build is from a different commit. Run pnpm build at the current revision.',
  );
  assert.equal(
    build.sourceFingerprint,
    sourceFingerprint(),
    'Production build is stale. Run pnpm build after the final source edit.',
  );
}
const save = (name, value) =>
  writeFile(`${directory}/${name}.json`, JSON.stringify(value, null, 2) + '\n');
const report = {
  label,
  seed,
  viewport,
  speed: 1,
  revision,
  workflow: labOnly
    ? 'fast-candidate'
    : journeyOnly
      ? 'acceptance'
      : 'complete',
  errors: [],
  console: [],
  limitations: [
    'Headless Chrome; timings are desktop diagnostics, not a physical-device guarantee.',
    'Pose images are manually stepped. MP4 files are real-time captures at 1×.',
  ],
};
const hashes = {};
for (const file of [
  'lab/performance/compile.ts',
  'lib/arena/engine/performance/BodyMechanics.ts',
  'lib/arena/engine/performance/profiles/doug.json',
  'lib/arena/engine/performance/profiles/dan.json',
  'lab/loongbones/assets/cornhole-side-v3/dan_ske.json',
  'lab/loongbones/assets/cornhole-side-v3/dan_tex.png',
  'lab/loongbones/assets/cornhole-side-v3/doug_ske.json',
  'lab/loongbones/assets/cornhole-side-v3/doug_tex.png',
  'docs/showcase-recording.json',
])
  hashes[file] = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
report.checkpoint = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  status: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
  sourceFingerprint: sourceFingerprint(),
  hashes,
};
const servers = [];
let browser;
function monitor(page) {
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (e) => {
    if (['warning', 'error'].includes(e.type()))
      report.console.push({ type: e.type(), text: e.text() });
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/favicon.ico'))
      report.errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
}
async function startVideo(page, selector) {
  await page.evaluate((selector) => {
    const canvas = document.querySelector(selector),
      chunks = [];
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=avc1.420034',
      videoBitsPerSecond: 5_000_000,
    });
    window.__turnCapture = {
      recorder,
      stream,
      finished: new Promise((resolve) => {
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(',')[1]);
          r.readAsDataURL(new Blob(chunks, { type: 'video/mp4' }));
        };
      }),
    };
    recorder.start();
  }, selector);
}
async function stopVideo(page, name) {
  const data = await page.evaluate(async () => {
    const c = window.__turnCapture;
    c.recorder.stop();
    const data = await c.finished;
    c.stream.getTracks().forEach((t) => t.stop());
    delete window.__turnCapture;
    return data;
  });
  await writeFile(`${directory}/${name}.mp4`, Buffer.from(data, 'base64'));
}
async function motionCase() {
  const context = await browser.newContext({ viewport }),
    page = await context.newPage();
  monitor(page);
  await page.goto(labUrl + '/performance/');
  await page.getByRole('status').filter({ hasText: 'Doug · idle' }).waitFor();
  report.characters = {};
  for (const id of ['doug', 'dan']) {
    await page.evaluate(
      (c) => window.__HERO_PERFORMANCE__.load(c, 'board'),
      id,
    );
    const catalog = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.catalog(),
    );
    const checkpoints = catalog.checkpoints.filter((c) =>
      [
        'settle',
        'windup',
        'drive',
        'release',
        'followThrough',
        'watchTarget',
        'recover',
      ].includes(c.name),
    );
    const poses = [];
    for (const checkpoint of checkpoints) {
      await page.evaluate(
        (t) => window.__HERO_PERFORMANCE__.seek(t),
        checkpoint.time,
      );
      const state = await page.evaluate(() =>
        window.__HERO_PERFORMANCE__.getState(),
      );
      poses.push({ phase: checkpoint.name, state });
      await page
        .locator('#stage canvas')
        .screenshot({ path: `${directory}/${id}-${checkpoint.name}.png` });
    }
    await page.evaluate(
      (c) => window.__HERO_PERFORMANCE__.load(c, 'board'),
      id,
    );
    const frames = await page.evaluate(() => {
      const frames = [];
      for (let i = 0; i < 480; i++) {
        window.__HERO_PERFORMANCE__.step(1 / 60);
        const s = window.__HERO_PERFORMANCE__.getState();
        frames.push({
          time: s.elapsed,
          state: s.performance.state,
          segmentTime: s.performance.segmentTime,
          joints: s.rig.joints,
          feet: s.rig.feet,
          soles: s.rig.soles,
          warnings: s.rig.warnings,
        });
      }
      return frames;
    });
    const final = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.getState(),
    );
    assert.equal(final.performance.state, 'idle');
    assert.equal(
      final.performance.events.filter((e) => e.name === 'OBJECT_RELEASED')
        .length,
      1,
    );
    assert.deepEqual(final.rig.warnings, []);
    await save(id, { poses, frames, final });
    // Continuous native playback is separate from the reconstructed pose pass.
    await page.evaluate(
      (c) => window.__HERO_PERFORMANCE__.load(c, 'board'),
      id,
    );
    await startVideo(page, '#stage canvas');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(
      () => {
        const s = window.__HERO_PERFORMANCE__.getState();
        return (
          !s.playing &&
          s.performance.events.some((e) => e.name === 'ACTION_COMPLETED')
        );
      },
      null,
      { timeout: 25000 },
    );
    await stopVideo(page, id);
    const running = await page.evaluate(() =>
      window.__HERO_PERFORMANCE__.getState(),
    );
    report.characters[id] = {
      profile: final.performance.profile,
      fixture: final.fixture,
      events: final.performance.events,
      frameTiming: running.frameTiming,
      maxSoleDrift: Math.max(
        ...frames.flatMap((f) => f.soles.map((s) => s.error)),
      ),
    };
  }
  await page.goto(labUrl + '/?scenario=cornhole-performance&seed=' + seed);
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  const initial = await page.evaluate(() => window.__HERO_ARENA__.getState());
  const recording = JSON.parse(await readFile('docs/showcase-recording.json'));
  const first = recording.attempts[0];
  const next = recording.attempts[1];
  const finalDoug = recording.attempts.at(-1);
  // These named samples are exact game-clock steps, not CSS-animation freezes.
  const samples = [
    ['preparation', first.start + 0.08],
    ['release', first.releaseAt],
    ['follow-through', first.releaseAt + 0.3],
    ['first-impact', first.contactAt],
    ['reaction', first.scoreAt + 0.25],
    ['recovery', first.end - 0.12],
    ['next-turn', next.start + 0.12],
    ['doug-chest-contact', finalDoug.scoreAt + 0.55],
  ];
  let frame = 0;
  const court = [];
  for (const [phase, time] of samples) {
    const target = Math.round(time * 60);
    await page.evaluate((n) => window.__HERO_ARENA__.step(n), target - frame);
    frame = target;
    const s = await page.evaluate(() => window.__HERO_ARENA__.getState());
    court.push({ phase, time, state: s });
    await page
      .locator('#arena canvas')
      .screenshot({ path: `${directory}/game-${phase}.png` });
  }
  const remaining = Math.ceil((initial.event.duration + 0.5) * 60) - frame;
  await page.evaluate((n) => window.__HERO_ARENA__.step(n), remaining);
  const finish = await page.evaluate(() => window.__HERO_ARENA__.getState());
  assert.deepEqual(finish.event.scores, finish.event.finalScores);
  assert.equal(finish.event.recordingHash, initial.event.recordingHash);
  for (const c of finish.characters) {
    assert.deepEqual(c.rigDetails.warnings, []);
    assert.equal(
      c.rigDetails.performance.events.filter(
        (e) => e.name === 'OBJECT_RELEASED',
      ).length,
      4,
    );
  }
  await save('court', { initial, poses: court, finish });
  report.court = {
    score: finish.event.scores,
    hash: finish.event.recordingHash,
    camera: 'normal ArenaScene camera; both lane scales preserved',
    canvasCount: await page.locator('#arena canvas').count(),
  };
  report.replays = [];
  for (let replay = 0; replay < 3; replay++) {
    await page.evaluate(async () => {
      await window.__HERO_ARENA__.seekCheckpoint('intro');
      const duration = window.__HERO_ARENA__.getState().event.duration;
      await window.__HERO_ARENA__.step(Math.ceil((duration + 0.5) * 60));
    });
    const s = await page.evaluate(() => window.__HERO_ARENA__.getState());
    for (const character of s.characters)
      assert.equal(
        character.rigDetails.performance.events.filter(
          (event) => event.name === 'OBJECT_RELEASED',
        ).length,
        4,
      );
    const c = s.rendering.counters;
    report.replays.push({
      characters: c.characters,
      cards: c.cards,
      projectiles: c.projectiles,
      objects: c.displayObjects,
      listeners: s.characters.map(
        (c) => c.rigDetails.performance.listenerCount,
      ),
    });
  }
  assert.deepEqual(report.replays[1], report.replays[0]);
  assert.deepEqual(report.replays[2], report.replays[0]);
  await context.close();
  mark('labCaptureComplete');
}
async function userJourney() {
  const context = await browser.newContext({ viewport }),
    page = await context.newPage();
  monitor(page);
  await page.goto(appUrl);
  await page.getByRole('button', { name: 'Watch', exact: true }).click();
  await page.locator('.arena-loading').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Set up showdown/i }).click();
  await page
    .getByRole('checkbox', { name: 'Replayable showcase seed' })
    .check();
  await page.screenshot({ path: `${directory}/selection.png` });
  await page
    .getByRole('button', { name: 'Start showdown', exact: true })
    .click();
  // Starting the match boots a fresh Phaser WebGL game. Under CI's software
  // renderer that boot compiles every shader synchronously on the main thread
  // (profiled: about 31 s in getShaderParameter, checkFramebufferStatus and
  // getProgramParameter against 2.9 s with a GPU), during which the dialog
  // cannot close and no in-page wait can observe it. The production smoke
  // only avoids this because its earlier Play session warmed the shader
  // cache. The budget covers that compile; it is not a match-time change.
  await page
    .locator('.setup-dialog')
    .waitFor({ state: 'hidden', timeout: 120_000 });
  await page.locator('.arena-loading').waitFor({ state: 'detached' });
  await page
    .getByRole('button', { name: 'Pause playback', exact: true })
    .click();
  for (const expected of ['2×', '0.5×', '1×']) {
    await page
      .getByRole('button', { name: /^Playback speed / })
      .click();
    assert.equal(
      await page
        .getByRole('button', { name: /^Playback speed / })
        .innerText(),
      expected,
    );
  }
  assert.equal(
    await page
      .locator('canvas[data-character-runtime]')
      .getAttribute('data-character-runtime'),
    revision,
    'Build does not match the requested runtime. Run this command with --build.',
  );
  const storage = await context.storageState();
  const saved = storage.origins
    .flatMap((o) => o.localStorage)
    .map((s) => {
      try {
        const e = JSON.parse(s.value);
        return e.payload ? JSON.parse(e.payload) : e;
      } catch {
        return null;
      }
    })
    .find((s) => s?.recordings?.length);
  const recording = saved.recordings.find((r) => r.id === saved.active.id);
  assert.equal(recording.setup.seed, seed);
  assert.deepEqual(
    recording.setup.participants.map((p) => p.cardId),
    ['card-dan', 'card-doug'],
  );
  await save('recording', recording);
  await page.evaluate(() => {
    window.__turnLongFrames = [];
    if (
      PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
    ) {
      window.__turnObserver = new PerformanceObserver((list) =>
        window.__turnLongFrames.push(
          ...list.getEntries().map((e) => e.duration),
        ),
      );
      window.__turnObserver.observe({ type: 'long-animation-frame' });
    }
  });
  await startVideo(page, 'canvas[data-character-runtime]');
  await page
    .getByRole('button', { name: 'Resume playback', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Replay same recording', exact: true })
    .waitFor({ timeout: 90000 });
  // Result UI precedes the immutable recording's authored recovery tail.
  await page.waitForTimeout(
    (recording.duration - recording.attempts.at(-1).end + 0.2) * 1000,
  );
  await stopVideo(page, 'match');
  const longFrames = await page.evaluate(() => {
    window.__turnObserver?.disconnect();
    return window.__turnLongFrames;
  });
  await page.screenshot({ path: `${directory}/results.png`, fullPage: true });
  const score = await page.locator('.scoreboard').innerText();
  // Replay must reuse the save and must not award or simulate again.
  const before = await context.storageState();
  await page
    .getByRole('button', { name: 'Replay same recording', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Pause playback', exact: true })
    .click();
  const after = await context.storageState();
  const facts = (state) => {
    const envelope = JSON.parse(
      state.origins
        .flatMap((o) => o.localStorage)
        .find((s) => s.name === 'wybmh-paper-arena-v2').value,
    );
    const saved = JSON.parse(envelope.payload);
    return {
      recordings: saved.recordings,
      ledger: saved.ledger,
      policy: saved.policy,
    };
  };
  // The resume timestamp may change; recorded facts and awards must not.
  assert.deepEqual(facts(after), facts(before));
  report.journey = {
    score,
    duration: recording.duration,
    seed,
    flow: 'Watch → selection → Start → pause/resume → eight bags → results → replay/pause',
    replayPreservedSave: true,
    longFramesOver50ms: longFrames,
    longFrameObserverSupported: await page.evaluate(() =>
      PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'),
    ),
    canvasCount: await page.locator('canvas[data-character-runtime]').count(),
    labGlobals: await page.evaluate(() => [
      typeof window.__HERO_PERFORMANCE__,
      typeof window.__HERO_ARENA__,
    ]),
  };
  assert.deepEqual(report.journey.labGlobals, ['undefined', 'undefined']);
  await context.close();
  mark('watchJourneyComplete');
}
async function videoFrames(name, times) {
  const page = await browser.newPage();
  // Decode the saved native frames. These are not screenshots of a re-simulated take.
  await page.goto(
    labUrl +
      '/@fs/' +
      path.resolve(directory, name + '.mp4').replaceAll('\\', '/'),
  );
  const result = await page.evaluate(async (times) => {
    const video = document.querySelector('video');
    video.pause();
    if (video.readyState < 2)
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
      });
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = Math.ceil(times.length / 3) * 396;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#15211c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [i, time] of times.entries()) {
      const t = Math.min(time, video.duration - 0.04);
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = t;
      });
      const x = (i % 3) * 640,
        y = Math.floor(i / 3) * 396;
      ctx.drawImage(video, x, y + 36, 640, 360);
      ctx.fillStyle = '#f8edce';
      ctx.font = '18px system-ui';
      ctx.fillText(
        `${t.toFixed(2)}s · frame from 1× recording`,
        x + 10,
        y + 26,
      );
    }
    const started = video.currentTime;
    await video.play();
    await new Promise((resolve) => video.requestVideoFrameCallback(resolve));
    video.pause();
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      played: video.currentTime >= started,
      png: canvas.toDataURL('image/png').split(',')[1],
    };
  }, times);
  await writeFile(
    `${directory}/${name}-video-frames.png`,
    Buffer.from(result.png, 'base64'),
  );
  const { png: _png, ...metadata } = result;
  report.media ??= {};
  report.media[name] = metadata;
  await page.close();
}
async function sheets() {
  const page = await browser.newPage();
  for (const id of ['doug', 'dan']) {
    const phases = [
      'settle',
      'windup',
      'drive',
      'release',
      'followThrough',
      'recover',
    ];
    const images = await Promise.all(
      phases.map(async (phase) => ({
        phase,
        src:
          'data:image/png;base64,' +
          (await readFile(`${directory}/${id}-${phase}.png`)).toString(
            'base64',
          ),
      })),
    );
    const data = await page.evaluate(async (images) => {
      const c = document.createElement('canvas');
      c.width = 1920;
      c.height = 824;
      const x = c.getContext('2d');
      x.fillStyle = '#15211c';
      x.fillRect(0, 0, c.width, c.height);
      for (const [i, item] of images.entries()) {
        const image = new Image();
        image.src = item.src;
        await image.decode();
        const px = (i % 3) * 640,
          py = Math.floor(i / 3) * 412;
        x.drawImage(image, px, py + 32, 640, 380);
        x.fillStyle = '#f8edce';
        x.font = '19px system-ui';
        x.fillText(item.phase + ' · controlled pose', px + 12, py + 24);
      }
      return c.toDataURL('image/png').split(',')[1];
    }, images);
    await writeFile(
      `${directory}/${id}-poses.png`,
      Buffer.from(data, 'base64'),
    );
  }
  await page.close();
}
try {
  // The small Lab server also serves saved-media review assets for journey-only captures.
  if (!journeyOnly || !labOnly)
    servers.push(
      await qaServer({
        url: labUrl,
        args: [
          'node_modules/vite/bin/vite.js',
          '--config',
          'lab/vite.config.ts',
          '--port',
          new URL(labUrl).port,
        ],
        label: 'turn-lab',
        reuse: false,
        identify: 'Arena Lab',
      }),
    );
  if (!labOnly)
    servers.push(
      await qaServer({
        url: appUrl,
        args: ['scripts/serve.mjs'],
        env: { PORT: new URL(appUrl).port },
        label: 'turn-app',
        reuse: false,
        identify: 'Will You Be My Hero?',
      }),
    );
  browser = await chromium.launch({
    ...browserLaunchOptions(),
    headless: true,
  });
  report.browser = {
    name: 'Chromium',
    version: browser.version(),
    headless: true,
  };
  if (!journeyOnly) {
    await motionCase();
    await sheets();
    for (const id of ['doug', 'dan']) {
      const release = report.characters[id].events.find(
        (e) => e.name === 'OBJECT_RELEASED',
      ).time;
      await videoFrames(
        id,
        Array.from({ length: 12 }, (_, i) => release + 0.25 + i * 0.24),
      );
    }
  }
  if (!labOnly) {
    await userJourney();
    await videoFrames(
      'match',
      [10.7, 11.2, 11.7, 12.2, 12.7, 13.2, 13.7, 14.2, 14.7, 15.2, 28.1, 28.5],
    );
  }
  assert.deepEqual(report.errors, []);
  mark('packageComplete');
  report.timingsSeconds = marks;
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error);
  throw error;
} finally {
  await save('review', report);
  await browser?.close();
  for (const server of servers.reverse()) await server.stop();
}
await writeFile(
  `${directory}/review.html`,
  `<!doctype html><meta charset="utf-8"><title>Arena · complete turn review</title><style>body{background:#15211c;color:#f8edce;font:16px/1.5 system-ui;max-width:1400px;margin:24px auto;padding:0 20px}video,img{width:100%;display:block}h2{margin-top:32px}a{color:#efba53}</style><h1>Cornhole · finish and recovery</h1><p>${label} · ${seed} · 1× recordings; controlled pose images are separately labelled.</p>${!labOnly ? '<h2>Full match · normal speed</h2><video controls src="match.mp4"></video>' : ''}${!journeyOnly ? ['doug', 'dan'].map((id) => '<h2>' + id + ' · normal speed</h2><video controls src="' + id + '.mp4"></video><img src="' + id + '-poses.png" alt="Six controlled poses">').join('') : ''}<p><a href="review.json">Events and capture conditions</a></p>`,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      directory,
      revision,
      score: report.journey?.score,
      characters: report.characters,
    },
    null,
    2,
  ),
);
