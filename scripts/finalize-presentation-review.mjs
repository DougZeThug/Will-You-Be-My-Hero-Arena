import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const qa = 'work/qa/presentation-pass',
  out = 'docs/review/presentation-pass';
const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
await fs.mkdir(out, { recursive: true });
const before = await read(`${qa}/before/states.json`),
  after = await read(`${qa}/after/states.json`);
const comparisons = after.results.map((a) => {
  const b = before.results.find((b) => b.id === a.id).state,
    s = a.state;
  return {
    scenario: a.id,
    event: isDeepStrictEqual(s.event, b.event),
    characters: isDeepStrictEqual(
      s.actors ?? s.characters,
      b.actors ?? b.characters,
    ),
    projectiles: isDeepStrictEqual(
      s.rendering?.projectiles,
      b.rendering?.projectiles,
    ),
    inputs: isDeepStrictEqual(s.inputs ?? s.input, b.inputs ?? b.input),
  };
});
if (comparisons.some((c) => Object.values(c).includes(false)))
  throw Error('Presentation changed a compared gameplay state');
const perfBefore = await read(`${qa}/performance-before.json`),
  perfAfter = await read(`${qa}/performance-after.json`),
  slow = await read(`${qa}/performance-after-slow-run.json`);
const performance = perfAfter.results.map((a) => {
  const b = perfBefore.results.find((b) => b.event === a.event);
  return {
    event: a.event,
    before: b.measuredCadence,
    after: a.measuredCadence,
    slowerRun: slow.results.find((s) => s.event === a.event).measuredCadence,
    drawCalls: {
      before: b.performance.drawCalls,
      after: a.performance.drawCalls,
    },
    counters: { before: b.performance.counters, after: a.performance.counters },
  };
});
const assets = [];
for (const [file, width, height, role] of [
  [
    'public/assets/paper-arena.webp',
    1672,
    941,
    'preserved original background',
  ],
  [
    'public/assets/arena-sunset-v2.png',
    1672,
    941,
    'generated environment derivative',
  ],
  [
    'public/assets/equipment/board.png',
    2206,
    713,
    'preserved original equipment',
  ],
  [
    'public/assets/equipment/board-finish-v2.png',
    2170,
    725,
    'generated registered appearance derivative',
  ],
]) {
  const bytes = await fs.readFile(file);
  assets.push({
    file,
    width,
    height,
    role,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const baselines = [];
for (const file of await fs.readdir(
  'tests/browser/baselines/desktop-chromium/scenarios.spec.ts',
)) {
  const current = await fs.readFile(
      `tests/browser/baselines/desktop-chromium/scenarios.spec.ts/${file}`,
    ),
    old = await fs.readFile(`${qa}/baselines-before/${file}`);
  baselines.push({ file, changed: !current.equals(old) });
}
for (const [src, dest] of [
  ['before/motion-cornhole.png', 'before.png'],
  ['after/motion-cornhole.png', 'cornhole.png'],
  ['after/basketball-recorded.png', 'basketball.png'],
  ['focus/running-stride.png', 'running.png'],
  ['after/motion-fighting.png', 'fighting.png'],
])
  await fs.copyFile(`${qa}/${src}`, `${out}/${dest}`);
await fs.writeFile(
  `${out}/evidence.json`,
  JSON.stringify(
    {
      captured: new Date().toISOString(),
      conditions: {
        viewport: '1440×1080',
        browser: 'desktop Chrome, headless',
        clock:
          'named manual checkpoints for images; independent real-time requests for performance',
        reference: 'Codex Image Sep 15, 2026, 10_49_32 AM.png',
      },
      comparisons,
      performance,
      renderAblation: (await read(`${qa}/render-ablation.json`)).results.map(
        (r) => ({ mode: r.mode, fps: r.fps, self: r.self }),
      ),
      video: await read(`${qa}/motion/video-verification.json`),
      assets,
      baselines,
      playerUI: await read(`${qa}/player-ui/report.json`),
      production: await read('work/qa/production/report.json'),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      comparisons,
      performance: performance.map((p) => ({
        event: p.event,
        before: p.before.fps,
        after: p.after.fps,
        slowerRun: p.slowerRun.fps,
      })),
      baselines,
    },
    null,
    2,
  ),
);
