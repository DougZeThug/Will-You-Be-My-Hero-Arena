import { test, expect } from 'playwright/test';
import { artifact, openScenario, snapshot } from './helpers';

for (const character of ['dan', 'doug']) {
  test(`${character}: rig inspection shows actual joints and restores original rendering`, async ({
    page,
  }, info) => {
    const errors = await openScenario(page, `character-${character}`);
    await page.evaluate(
      (id) =>
        window.__HERO_ARENA__.loadScenario(`character-${id}`, {
          animation: 'idle_breathe',
        }),
      character,
    );
    const before = await snapshot(page),
      canvas = page.locator('#arena canvas');
    const pixels = await canvas.screenshot();
    await page.evaluate(() =>
      window.__HERO_ARENA__.setRigQA({ overlay: true }),
    );
    const inspected = await snapshot(page),
      actual = inspected.rigQA!.current!;
    expect(actual.status).toBe('current-production-solver');
    expect(actual.balance).toBeNull();
    expect(actual.missingControls).toContain('wrist_R');
    expect(actual.targets.palm_R).toEqual({
      x: inspected.characters[0].animation.pose.handRX,
      y: inspected.characters[0].animation.pose.handRY,
    });
    const root = inspected.characters[0].root,
      palm = actual.joints.palm_R,
      hand = inspected.characters[0].sockets.throwingHand;
    // Phaser world matrices use Float32 storage; subpixel agreement is sufficient.
    expect(hand.x).toBeCloseTo(root.x + palm.x * root.scaleX, 3);
    expect(hand.y).toBeCloseTo(root.y + palm.y * root.scaleY, 3);
    await artifact(page, info, `${character}-current-joints`);
    await page.evaluate(() =>
      window.__HERO_ARENA__.setRigQA({ overlay: false, silhouette: true }),
    );
    await artifact(page, info, `${character}-current-silhouette`);
    await page.evaluate(() =>
      window.__HERO_ARENA__.setRigQA({ mirror: true, scale: 'court' }),
    );
    expect((await snapshot(page)).characters[0].root.scaleX).toBe(-1);
    await artifact(page, info, `${character}-current-mirrored-court`);
    await page.evaluate(() =>
      window.__HERO_ARENA__.setRigQA({
        overlay: false,
        silhouette: false,
        mirror: false,
        view: 'current',
        scale: 'detail',
      }),
    );
    expect((await snapshot(page)).characters[0].animation).toEqual(
      before.characters[0].animation,
    );
    expect((await canvas.screenshot()).equals(pixels)).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('Dan setup and idle proposals remain separate from production art', async ({
  page,
}, info) => {
  await openScenario(page, 'character-dan');
  await page.locator('#rig-qa-controls summary').click();
  await page.locator('#rig-view').selectOption('setup-plan');
  await expect
    .poll(async () => (await snapshot(page)).rigQA!.options.view)
    .toBe('setup-plan');
  const setup = (await snapshot(page)).rigQA!.plan!;
  expect(setup.status).toBe('landmark-proposal');
  expect(setup.fittedArtwork).toBe(false);
  expect(setup.ikTargets).toBeNull();
  expect(setup.validationErrors).toEqual([]);
  expect(setup.parents.clavicle_L).toBe('chest');
  expect(setup.parents.hip_L).toBe('pelvis');
  await artifact(page, info, 'dan-setup-proposal');
  await page.locator('#rig-view').selectOption('idle-plan');
  await expect
    .poll(async () => (await snapshot(page)).rigQA!.options.view)
    .toBe('idle-plan');
  const idle = (await snapshot(page)).rigQA!.plan!;
  expect(idle.balance.shareL).toBeGreaterThanOrEqual(0.6);
  expect(idle.balance.shareL).toBeLessThanOrEqual(0.7);
  expect(idle.pose).not.toEqual(setup.pose);
  expect((await snapshot(page)).characters[0].root.visible).toBe(false);
  await artifact(page, info, 'dan-idle-proposal');
  const untouched = await page.evaluate(() => {
    const state = window.__HERO_ARENA__.getState();
    state.rigQA!.plan!.pose.pelvis.x = 900;
    return window.__HERO_ARENA__.getState().rigQA!.plan!.pose.pelvis.x;
  });
  expect(untouched).toBe(idle.pose.pelvis.x);
});
test('rig QA rejects unsupported views without mutating the scenario', async ({
  page,
}) => {
  await openScenario(page, 'character-doug');
  const results = await page.evaluate(async () => {
    const rejects = [];
    for (const options of [
      { view: 'idle-plan' },
      { mirror: 'yes' },
      { unrecognized: true },
    ]) {
      try {
        await window.__HERO_ARENA__.setRigQA(options as never);
        rejects.push(false);
      } catch {
        rejects.push(true);
      }
    }
    return rejects;
  });
  expect(results).toEqual([true, true, true]);
  expect((await snapshot(page)).rigQA!.options.view).toBe('current');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-recorded'),
  );
  expect((await snapshot(page)).rigQA).toBeNull();
  expect(
    await page.evaluate(async () => {
      try {
        await window.__HERO_ARENA__.setRigQA({ overlay: true });
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
});

test('gait inspection loops without inserting the action settling pause', async ({
  page,
}) => {
  await openScenario(page, 'character-dan');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('character-dan', { animation: 'run' }),
  );
  const timeline = (await snapshot(page)).event.timeline;
  expect(timeline.cycleDuration).toBe(timeline.duration);
  await page.evaluate(() => window.__HERO_ARENA__.resume());
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(90);
    samples.push((await snapshot(page)).characters[0].animation.progress);
  }
  await page.evaluate(() => window.__HERO_ARENA__.pause());
  expect(samples.every((p) => p < 1)).toBe(true);
  expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
});
