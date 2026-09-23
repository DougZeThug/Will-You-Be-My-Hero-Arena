import { test, expect } from 'playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { openScenario, snapshot, checkpoint, artifact, step } from './helpers';

const recorded = [
  'cornhole-recorded',
  'basketball-recorded',
  'football-recorded',
  'beer-pong-recorded',
];
for (const id of recorded) {
  test(`${id}: release, landing, score and reproducible replay`, async ({
    page,
  }, info) => {
    const failures = await openScenario(page, id);
    const initial = await snapshot(page);
    expect(initial.scenario.kind).toBe('recorded');
    expect(initial.paused).toBe(true);
    const hash = initial.event.recordingHash;
    expect(typeof hash).toBe('string');
    for (const name of ['release', 'landing', 'result', 'finish']) {
      await checkpoint(page, name);
      const state = await snapshot(page);
      expect(state.errors).toEqual([]);
      expect(state.event.recordingHash).toBe(hash);
      expect(Number.isFinite(state.time)).toBe(true);
      expect(state.characters).toHaveLength(2);
      await artifact(page, info, id + '-' + name);
    }
    const final = await snapshot(page);
    expect(final.event.complete ?? final.event.finished).toBe(true);
    expect(final.event.scores).toEqual(final.event.finalScores);
    await page.evaluate(
      (scenario) => window.__HERO_ARENA__.loadScenario(scenario),
      id,
    );
    const repeat = await snapshot(page);
    expect(repeat.event.recordingHash).toBe(hash);
    expect(repeat.event.finalScores).toEqual(final.event.finalScores);
    expect(failures).toEqual([]);
  });
}

for (const id of ['character-doug', 'character-dan']) {
  test(`${id}: clip selection, deterministic pose and screenshot`, async ({
    page,
  }, info) => {
    const failures = await openScenario(page, id);
    await checkpoint(page, 'gesture');
    const first = await snapshot(page);
    expect(first.scenario.kind).toBe('character');
    expect(first.characters.length).toBeGreaterThan(0);
    expect(first.scenario.animation).toBeTruthy();
    await artifact(page, info, id + '-gesture');
    await checkpoint(page, 'recovery');
    await checkpoint(page, 'gesture');
    const again = await snapshot(page);
    expect(again.time).toBeCloseTo(first.time, 7);
    expect(again.characters).toEqual(first.characters);
    expect(failures).toEqual([]);
  });
}

for (const id of ['running-live', 'fighting-live']) {
  test(`${id}: real event update and stable pause`, async ({ page }, info) => {
    const failures = await openScenario(page, id);
    const before = await snapshot(page);
    await step(page, 240);
    const after = await snapshot(page);
    expect(after.scenario.kind).toBe('live');
    expect(after.time).toBeGreaterThan(before.time + 3.9);
    expect(after.characters).not.toEqual(before.characters);
    expect(after.errors).toEqual([]);
    await artifact(page, info, id);
    await page.waitForTimeout(100);
    expect((await snapshot(page)).time).toBe(after.time);
    expect(failures).toEqual([]);
  });
}

test('running-live: Dan and Doug run in profile on the side-view motion rig', async ({
  page,
}, info) => {
  const failures = await openScenario(page, 'running-live');
  const canvas = page.locator('#arena canvas');
  await expect(canvas).toHaveAttribute(
    'data-character-backends',
    'loongbones-side-motion,loongbones-side-motion',
  );
  await expect(canvas).toHaveAttribute(
    'data-character-runtime',
    'play-side-motion-v1',
  );
  // Through the start, strides, a jump and a stumble: the simulation keeps
  // running and nothing in the native rig throws.
  await step(page, 300);
  const state = await snapshot(page);
  expect(state.errors).toEqual([]);
  expect(
    state.characters.every((c: Record<string, any>) => c.body.x > 300),
  ).toBe(true);
  await artifact(page, info, 'running-live-profile');
  expect(failures).toEqual([]);
});

test('scenario lifecycle: one canvas, detached snapshots and no save writes', async ({
  page,
}, info) => {
  const failures = await openScenario(page, 'cornhole-recorded');
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  const initialCounters = (await snapshot(page)).performance.counters;
  for (const id of [
    'running-live',
    'character-dan',
    'beer-pong-recorded',
    'fighting-live',
    'cornhole-recorded',
  ]) {
    await page.evaluate(
      (scenario) => window.__HERO_ARENA__.loadScenario(scenario),
      id,
    );
    await step(page, 2);
    await expect(page.locator('#arena canvas')).toHaveCount(1);
    expect((await snapshot(page)).scenario.id).toBe(id);
  }
  const detached = await page.evaluate(() => {
    const state = window.__HERO_ARENA__.getState();
    state.scenario.id = 'mutated-outside';
    state.characters.length = 0;
    return window.__HERO_ARENA__.getState();
  });
  expect(detached.scenario.id).toBe('cornhole-recorded');
  expect(detached.characters).toHaveLength(2);
  expect(detached.performance.counters.textures).toBe(initialCounters.textures);
  expect(detached.performance.counters.objects).toBeLessThanOrEqual(
    initialCounters.objects + 6,
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
  await artifact(page, info, 'lifecycle');
  expect(failures).toEqual([]);
});

test('live performance publishes finite frame timing and render counters', async ({
  page,
}, info) => {
  await openScenario(page, 'running-live');
  await page.evaluate(() => window.__HERO_ARENA__.resume());
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__HERO_ARENA__.pause());
  const performance = await page.evaluate(() =>
    window.__HERO_ARENA__.getPerformance(),
  );
  expect(performance.realtime.frames).toBeGreaterThan(0);
  expect(performance.realtime.frameTiming.meanMs).toBeGreaterThan(0);
  expect(Number.isFinite(performance.realtime.frameTiming.p95Ms)).toBe(true);
  expect(performance.counters.objects).toBeGreaterThan(0);
  expect(performance.counters.textures).toBeGreaterThan(0);
  expect(Number.isFinite(performance.drawCalls)).toBe(true);
  await info.attach('realtime-performance', {
    body: JSON.stringify(performance, null, 2),
    contentType: 'application/json',
  });
  // No absolute FPS gate: headless/software rendering is not player GPU performance.
});

test('@visual fixed-clock approved reference images', async ({ page }) => {
  // Six separately loaded scenarios, each waiting for a stable canvas capture.
  test.setTimeout(180_000);
  test.skip(
    process.env.ARENA_VISUAL_BASELINES !== '1',
    'Run test:browser:visual for reviewed, environment-specific pixel baselines.',
  );
  for (const [id, point] of [
    ['cornhole-recorded', 'release'],
    ['basketball-recorded', 'flight'],
    ['football-recorded', 'landing'],
    ['beer-pong-recorded', 'result'],
    ['character-dan', 'gesture'],
    ['character-doug', 'gesture'],
  ]) {
    await openScenario(page, id);
    await checkpoint(page, point);
    await expect
      .soft(page.locator('#arena canvas'))
      .toHaveScreenshot(id + '-' + point + '.png', {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
      });
  }
});

test('@visual current cornhole performance approved images', async ({
  page,
}) => {
  const baselineDirectory = path.join(
    'tests/browser/baselines/desktop-chromium/scenarios.spec.ts',
  );
  const baselines = [
    'cornhole-performance-isolated-dan-release.png',
    'cornhole-performance-isolated-doug-release.png',
    'cornhole-performance-court-dan-release.png',
    'cornhole-performance-court-doug-release.png',
  ];
  test.skip(
    process.env.ARENA_UPDATE_BASELINES !== '1' &&
      baselines.some((name) => !existsSync(path.join(baselineDirectory, name))),
    'Current-performance captures remain candidates until all four images are visually reviewed and committed together.',
  );
  test.skip(
    process.env.ARENA_VISUAL_BASELINES !== '1',
    'Run test:browser:visual for reviewed, environment-specific pixel baselines.',
  );
  // Freeze the engine's deterministic clocks before capture. Playwright's CSS
  // animation option is not a substitute for pausing the performance clock.
  await page.goto('/performance/');
  await expect(page.getByRole('status').first()).toContainText('Doug · idle');
  for (const id of ['dan', 'doug'] as const) {
    await page.evaluate((character) => {
      const api = window.__HERO_PERFORMANCE__;
      api.load(character, 'board');
      const release = api
        .catalog()
        .checkpoints.find((point) => point.name === 'release')!.time;
      api.seek(release);
    }, id);
    await expect
      .soft(page.locator('#stage canvas'))
      .toHaveScreenshot(`cornhole-performance-isolated-${id}-release.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
      });
  }
  await openScenario(page, 'cornhole-performance');
  for (const [character, point] of [
    ['dan', 'release'],
    ['doug', 'doug-release'],
  ]) {
    await checkpoint(page, point);
    await expect
      .soft(page.locator('#arena canvas'))
      .toHaveScreenshot(`cornhole-performance-court-${character}-release.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.002,
      });
  }
});
