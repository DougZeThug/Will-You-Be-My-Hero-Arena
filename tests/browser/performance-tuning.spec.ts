import { test, expect } from 'playwright/test';
import { readFile } from 'node:fs/promises';

const waitForPerformance = async (page: import('playwright/test').Page) => {
  const status = page.getByRole('status').first();
  await expect(status).not.toHaveText('Loading character…', {
    timeout: 15_000,
  });
  await expect(status).toContainText('Doug · idle');
};

test('performance finish: both characters retain the directed arm and settle without a vertical rebound', async ({
  page,
}) => {
  await page.goto('/performance/');
  await waitForPerformance(page);
  for (const id of ['doug', 'dan'] as const) {
    const sample = await page.evaluate((id) => {
      const api = window.__HERO_PERFORMANCE__;
      api.load(id, 'board');
      api.step(8);
      const end = api.getState();
      const release = end.performance.events.find(
        (e) => e.name === 'OBJECT_RELEASED',
      )!.time;
      api.seek(release + 1.1);
      const finish = api.getState();
      const recovery = end.performance.events.find(
        (e) => e.name === 'STATE_CHANGED' && e.state === 'recover',
      )!.time;
      api.seek(recovery);
      const pelvisY = [];
      for (let i = 0; i < 60; i++) {
        api.step(1 / 60);
        pelvisY.push(api.getState().rig.joints.pelvis.y);
      }
      return { finish, end, pelvisY, recovery };
    }, id);
    const j = sample.finish.rig.joints;
    const reach = j.rightWrist.x - j.rightShoulder.x;
    const armLength =
      Math.hypot(
        j.rightElbow.x - j.rightShoulder.x,
        j.rightElbow.y - j.rightShoulder.y,
      ) +
      Math.hypot(
        j.rightWrist.x - j.rightElbow.x,
        j.rightWrist.y - j.rightElbow.y,
      );
    // This chosen default take's finish should still point down the lane before
    // the result. World-space ratio removes camera/lane scale; not a quality score.
    expect(reach / armLength).toBeGreaterThan(0.6);
    // Y points down. Recovery must not rise past its final resting pelvis then
    // bounce back down; 0.25 render-world pixels allows numeric/native blending.
    expect(Math.min(...sample.pelvisY)).toBeGreaterThanOrEqual(
      sample.end.rig.joints.pelvis.y - 0.25,
    );
    expect(
      sample.end.performance.events.filter((e) => e.name === 'OBJECT_RELEASED'),
    ).toHaveLength(1);
    expect(
      sample.end.performance.events.filter(
        (e) => e.name === 'ACTION_COMPLETED',
      ),
    ).toHaveLength(1);
    expect(sample.end.rig.warnings).toEqual([]);
  }
});

test('performance tuning: real controls export, reset and reload the shared profile without changing the take', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/performance/');
  await waitForPerformance(page);
  const initial = await page.evaluate(() =>
    window.__HERO_PERFORMANCE__.getState(),
  );
  await page
    .getByRole('combobox', { name: 'State', exact: true })
    .selectOption({ label: 'followThrough' });
  const before = await page.evaluate(() =>
    window.__HERO_PERFORMANCE__.getState(),
  );
  const finish = page.getByRole('slider', { name: /Retained finish/ });
  await finish.focus();
  await finish.press('ArrowRight');
  const edited = await page.evaluate(() =>
    window.__HERO_PERFORMANCE__.getState(),
  );
  expect(edited.performance.profile.finishRetention).toBeCloseTo(
    initial.performance.profile.finishRetention + 0.01,
    6,
  );
  expect(edited.elapsed).toBeCloseTo(before.elapsed, 6);
  expect(edited.playing).toBe(false);
  expect(edited.fixture).toEqual(before.fixture);
  expect(edited.playback!.recordedReleaseAt).toBe(
    before.playback!.recordedReleaseAt,
  );
  const downloadEvent = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export candidate', exact: true })
    .click();
  const download = await downloadEvent,
    file = info.outputPath('candidate.json');
  await download.saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(
    edited.performance.profile,
  );
  await page
    .getByRole('button', { name: 'Reset to reviewed settings', exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.__HERO_PERFORMANCE__.getState()))
      .performance.profile,
  ).toEqual(initial.performance.profile);
  await page.getByLabel('Reload candidate JSON').setInputFiles(file);
  await expect(finish).toHaveValue(
    String(edited.performance.profile.finishRetention),
  );
  expect(
    (await page.evaluate(() => window.__HERO_PERFORMANCE__.getState()))
      .performance.profile,
  ).toEqual(edited.performance.profile);
  await page.getByLabel('Reload candidate JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...edited.performance.profile, recoveryDuration: -4 }),
    ),
  });
  await expect(page.getByRole('alert')).toContainText('recoveryDuration');
  expect(
    (await page.evaluate(() => window.__HERO_PERFORMANCE__.getState()))
      .performance.profile,
  ).toEqual(edited.performance.profile);
  await page.evaluate(() => window.__HERO_PERFORMANCE__.load('dan', 'board'));
  const dan = await page.evaluate(() => window.__HERO_PERFORMANCE__.getState());
  await expect(page.getByRole('slider', { name: /Recovery time/ })).toHaveValue(
    String(dan.performance.profile.recoveryDuration),
  );
  await page.reload();
  await expect(page.getByRole('status').first()).toContainText('Doug · idle');
  expect(
    (await page.evaluate(() => window.__HERO_PERFORMANCE__.getState()))
      .performance.profile,
  ).toEqual(initial.performance.profile);
  expect(errors).toEqual([]);
});
