import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import { qaServer, browserLaunchOptions } from './qa-server.mjs';

// Frame-exact motion evidence for every character path (Watch sports, Play
// modes, cornhole performance). Each case is stepped one 60 Hz frame at a time
// through the public Lab API, so software WebGL cannot drop frames. Output:
// per-case WebM (VP8, 1x), sampled frame strips and socket-based smoothness
// metrics (acceleration spikes, dead-still holds, planted-foot slide).
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const label = option('--label', 'motion');
assert.match(label, /^[a-z0-9-]+$/);
const only = option('--cases', '')
  .split(',')
  .filter(Boolean);
const keepFrames = args.includes('--keep-frames');
const directory = `work/qa/motion-quality/${label}`;
await assert.rejects(
  access(directory),
  `${directory} already exists. Use a new --label.`,
);
const labUrl = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3030';
const ffmpeg =
  process.env.ARENA_FFMPEG ?? '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';

/** Each case: scenario, start (checkpoint name or seconds), frames, inputs. */
const CASES = [
  {
    id: 'cornhole-watch',
    scenario: 'cornhole-performance',
    start: 'anticipation',
    frames: 360,
  },
  {
    id: 'cornhole-watch-doug',
    scenario: 'cornhole-performance',
    start: 'doug-anticipation',
    frames: 330,
  },
  { id: 'entrance', scenario: 'football-recorded', start: 0, frames: 240 },
  {
    id: 'football',
    scenario: 'football-recorded',
    start: 'anticipation',
    frames: 300,
  },
  {
    id: 'basketball',
    scenario: 'basketball-recorded',
    start: 'anticipation',
    frames: 300,
  },
  {
    id: 'pong',
    scenario: 'beer-pong-recorded',
    start: 'anticipation',
    frames: 300,
  },
  {
    id: 'cornhole-play',
    scenario: 'keyboard-cornhole',
    start: 'ready',
    frames: 300,
    inputs: [
      [10, 'charge', 1],
      [70, 'charge', 0],
    ],
  },
  {
    id: 'running-play',
    scenario: 'running-live',
    start: 'ready',
    frames: 300,
    inputs: [
      [5, 'move', { x: 1, y: 0 }],
      [60, 'sprint', 1],
      [140, 'jump', 1],
      [146, 'jump', 0],
      [220, 'sprint', 0],
      [250, 'move', { x: 0, y: 0 }],
    ],
  },
  // View turns: camera-facing before the start, profile once under way.
  { id: 'running-start', scenario: 'running-live', start: 0, frames: 150 },
  { id: 'fighting-start', scenario: 'fighting-live', start: 0, frames: 150 },
  {
    id: 'fighting-play',
    scenario: 'fighting-live',
    start: 'ready',
    frames: 300,
    inputs: [
      [5, 'move', { x: 1, y: 0 }],
      [60, 'move', { x: 0, y: 0 }],
      [70, 'primaryAction', 1],
      [74, 'primaryAction', 0],
      [120, 'secondaryAction', 1],
      [124, 'secondaryAction', 0],
      [170, 'move', { x: -1, y: 0 }],
      [230, 'move', { x: 0, y: 0 }],
      [240, 'jump', 1],
      [244, 'jump', 0],
    ],
  },
].filter((c) => !only.length || only.includes(c.id));

const JOINTS = [
  'throwingHand',
  'offHand',
  'head',
  'chest',
  'waist',
  'footL',
  'footR',
];
function analyse(samples) {
  // Samples: [frame][character] -> sockets. Report per character and joint.
  const out = [];
  const characters = Math.max(...samples.map((s) => s.length));
  for (let c = 0; c < characters; c++) {
    const joints = {};
    for (const joint of JOINTS) {
      const p = samples.map((s) => s[c]?.sockets?.[joint] ?? null);
      const v = [],
        a = [];
      for (let i = 1; i < p.length; i++)
        v.push(
          p[i] && p[i - 1]
            ? Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
            : null,
        );
      for (let i = 2; i < p.length; i++)
        a.push(
          p[i] && p[i - 1] && p[i - 2]
            ? Math.hypot(
                p[i].x - 2 * p[i - 1].x + p[i - 2].x,
                p[i].y - 2 * p[i - 1].y + p[i - 2].y,
              )
            : null,
        );
      const finite = (list) => list.filter((n) => n !== null);
      const vs = finite(v),
        as = finite(a);
      if (!vs.length) continue;
      const mean = vs.reduce((n, x) => n + x, 0) / vs.length;
      // A "pop" is a per-frame acceleration far above the joint's typical motion.
      const sorted = [...as].sort((x, y) => x - y),
        median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const pops = a
        .map((x, i) => ({ frame: i + 2, x }))
        .filter((e) => e.x !== null && e.x > Math.max(2.5, 8 * median));
      let longestHold = 0,
        run = 0;
      for (const x of v) {
        run = x !== null && x < 0.04 ? run + 1 : 0;
        longestHold = Math.max(longestHold, run);
      }
      joints[joint] = {
        meanSpeed: +mean.toFixed(3),
        maxSpeed: +Math.max(...vs).toFixed(3),
        maxAccel: +Math.max(...as, 0).toFixed(3),
        medianAccel: +median.toFixed(3),
        pops: pops.length,
        popFrames: pops.slice(0, 12).map((e) => e.frame),
        longestHoldFrames: longestHold,
      };
    }
    out.push(joints);
  }
  return out;
}

const servers = [];
let browser;
const summary = { label, labUrl, cases: {} };
try {
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
      label: `motion-lab-${label}`,
      reuse: false,
      identify: 'Arena Lab',
    }),
  );
  browser = await chromium.launch({ ...browserLaunchOptions(), headless: true });
  const context = await browser.newContext({
    viewport: { width: 1000, height: 760 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  await mkdir(directory, { recursive: true });
  for (const c of CASES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(labUrl + '/?scenario=' + encodeURIComponent(c.scenario));
    await page.waitForFunction(() => window.__HERO_ARENA__?.ready, null, {
      timeout: 60000,
    });
    await page.evaluate(() => window.__HERO_ARENA__.pause());
    if (typeof c.start === 'string')
      await page.evaluate(
        (name) => window.__HERO_ARENA__.seekCheckpoint(name),
        c.start,
      );
    else if (c.start > 0)
      await page.evaluate((t) => window.__HERO_ARENA__.seekTime(t), c.start);
    const frames = path.join(directory, c.id);
    await mkdir(frames, { recursive: true });
    const samples = [];
    const inputs = new Map();
    for (const [frame, intent, value] of c.inputs ?? [])
      inputs.set(frame, [...(inputs.get(frame) ?? []), [intent, value]]);
    for (let f = 0; f < c.frames; f++) {
      // Step, read the WebGL canvas in the same task (before the drawing
      // buffer is presented and cleared), and sample sockets in one round trip.
      const result = await page.evaluate(async (inputs) => {
        const api = window.__HERO_ARENA__;
        for (const [intent, value] of inputs) api.input('p0', intent, value);
        await api.step(1);
        const image = document
          .querySelector('#arena canvas')
          .toDataURL('image/jpeg', 0.8);
        const s = api.getState();
        return {
          image,
          time: s.time,
          characters: s.characters.map((ch) => ({
            sockets: ch.sockets ?? null,
            clip: ch.animation?.clip ?? null,
            phase: ch.animation?.phase ?? ch.substate ?? null,
          })),
        };
      }, inputs.get(f) ?? []);
      samples.push(result.characters);
      await writeFile(
        path.join(frames, String(f).padStart(4, '0') + '.jpg'),
        Buffer.from(result.image.split(',')[1], 'base64'),
      );
    }
    // The bundled Playwright ffmpeg reads image sequences only from a pipe.
    const sequence = Buffer.concat(
      await Promise.all(
        Array.from({ length: c.frames }, (_, f) =>
          readFile(path.join(frames, String(f).padStart(4, '0') + '.jpg')),
        ),
      ),
    );
    execFileSync(
      ffmpeg,
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        '60',
        '-c:v',
        'mjpeg',
        '-i',
        'pipe:0',
        '-c:v',
        'libvpx',
        '-b:v',
        '4M',
        path.join(directory, c.id + '.webm'),
      ],
      { input: sequence, stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const metrics = analyse(samples);
    summary.cases[c.id] = {
      scenario: c.scenario,
      start: c.start,
      frames: c.frames,
      errors,
      metrics,
      clips: [
        ...new Set(samples.flatMap((s) => s.map((ch) => ch?.clip ?? null))),
      ],
    };
    await writeFile(
      path.join(directory, c.id + '-samples.json'),
      JSON.stringify(samples),
    );
    if (!keepFrames) {
      // Keep every 4th frame for strips and inspection; the WebM keeps all.
      for (let f = 0; f < c.frames; f++)
        if (f % 4)
          await rm(path.join(frames, String(f).padStart(4, '0') + '.jpg'));
    }
    await page.close();
    console.log(`captured ${c.id}`);
  }
} finally {
  await browser?.close();
  for (const s of servers.reverse()) await s.stop();
}
await writeFile(
  path.join(directory, 'summary.json'),
  JSON.stringify(summary, null, 2),
);
console.log(`Wrote ${directory}`);
