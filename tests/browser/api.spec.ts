import { test, expect } from 'playwright/test';
import { openScenario, snapshot, checkpoint, step } from './helpers';

test('API inputs are detached and clock operations are serialized', async ({
  page,
}) => {
  await openScenario(page, 'keyboard-cornhole');
  await checkpoint(page, 'ready');
  await page.evaluate(() => {
    const vector = { x: 1, y: 0 };
    window.__HERO_ARENA__.input('p0', 'move', vector);
    vector.x = -1;
  });
  await step(page, 1);
  expect((await snapshot(page)).inputs[0].values.move.x).toBe(1);
  const before = await snapshot(page);
  await page.evaluate(async () => {
    await Promise.all([
      window.__HERO_ARENA__.step(30),
      window.__HERO_ARENA__.resume(),
      window.__HERO_ARENA__.pause(),
    ]);
  });
  const after = await snapshot(page);
  expect(after.time - before.time).toBeCloseTo(0.5, 6);
  expect(after.paused).toBe(true);
  expect(after.clockMode).toBe('manual');
  await page.waitForTimeout(80);
  expect((await snapshot(page)).time).toBe(after.time);
});

test('API scenario changes refresh controls and invalid input preserves the provider', async ({
  page,
}) => {
  await openScenario(page, 'cornhole-recorded');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('character-dan'),
  );
  await expect(page.locator('#scenario')).toHaveValue('character-dan');
  const result = await page.evaluate(() => {
    const provider = navigator.getGamepads;
    let rejected = false;
    try {
      window.__HERO_ARENA__.setGamepad({
        id: 'bad',
        connected: true,
        axes: [NaN],
        buttons: [],
      });
    } catch {
      rejected = true;
    }
    return { rejected, sameProvider: navigator.getGamepads === provider };
  });
  expect(result).toEqual({ rejected: true, sameProvider: true });
  expect((await snapshot(page)).scenario.id).toBe('character-dan');
});

test('graphics context loss is visible in diagnostic errors', async ({
  page,
}) => {
  await openScenario(page, 'cornhole-recorded');
  await page
    .locator('#arena canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect
    .poll(async () => (await snapshot(page)).errors.length)
    .toBeGreaterThan(0);
  expect((await snapshot(page)).paused).toBe(true);
});

test('graphics context loss pauses a live match with a notice', async ({
  page,
}) => {
  await openScenario(page, 'running-live');
  await page
    .locator('#arena canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect
    .poll(async () => (await snapshot(page)).event?.notice)
    .toBe('Graphics were interrupted. Resume when the stage is back.');
  expect((await snapshot(page)).event.paused).toBe(true);
});

test('character throw inspection retains production release and full recovery timing', async ({
  page,
}, info) => {
  await openScenario(page, 'character-doug');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('character-doug', {
      animation: 'throw_airmail',
    }),
  );
  const state = await snapshot(page);
  const timeline = state.event.timeline;
  expect(timeline.kind).toBe('production-throw');
  expect(timeline.duration).toBeGreaterThan(2);
  const release = state.checkpoints.find((point) => point.name === 'release')!;
  const recovery = state.checkpoints.find(
    (point) => point.name === 'recovery',
  )!;
  const end = state.checkpoints.find((point) => point.name === 'end')!;
  expect(
    timeline.markers.find(
      (marker: { name: string }) => marker.name === 'release',
    ).time,
  ).toBe(release.time);
  expect(recovery.time).toBeGreaterThan(
    timeline.markers.find(
      (marker: { name: string }) => marker.name === 'contact',
    ).time,
  );
  expect(end.time).toBe(timeline.duration);
  expect(end.time).toBeGreaterThan(recovery.time);
  await checkpoint(page, 'release');
  const released = await snapshot(page);
  expect(released.time).toBe(release.time);
  expect(released.characters[0].animation.clip).toBe('throw_airmail');
  await checkpoint(page, 'end');
  expect((await snapshot(page)).time).toBe(timeline.duration);
  await info.attach('production-throw-timeline', {
    body: JSON.stringify(timeline, null, 2),
    contentType: 'application/json',
  });
});
