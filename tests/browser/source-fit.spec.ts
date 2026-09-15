import { test, expect } from 'playwright/test';
import { artifact, openScenario, snapshot } from './helpers';

test('Dan revised source loads through the Lab UI, survives reload and stays distinct from animated production art', async ({
  page,
}, info) => {
  const errors = await openScenario(page, 'character-dan');
  const canvas = page.locator('#arena canvas');
  const original = await canvas.screenshot();
  const originalState = await snapshot(page);
  await page
    .getByRole('link', { name: 'Dan · revised full-body source →' })
    .click();
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  await expect
    .poll(async () => (await snapshot(page)).rigQA?.options.view)
    .toBe('source-fit');
  const state = await snapshot(page),
    fitted = state.rigQA!.sourceFit!;
  expect(fitted.fittedArtwork).toBe(true);
  expect(fitted.productionInstalled).toBe(false);
  expect(fitted.animated).toBe(false);
  expect(fitted.editorExport).toBeNull();
  expect(fitted.revision).toBe(2);
  expect(fitted.source).toBe('lab/assets/dan-source/full-body-v2.png');
  expect(fitted.fitting.mode).toBe('uniform-source-registration');
  expect(fitted.fitting.deformed).toBe(false);
  expect(fitted.fitting.scaleX).toBe(fitted.fitting.scaleY);
  expect(state.event.phase).toBe('source-review');
  expect(state.event.timeline).toBeNull();
  expect(state.characters[0].rig).toBe('static-source-fit');
  expect(state.characters[0].root.visible).toBe(true);
  expect(state.characters[0].animation.clip).toBe('source-neutral');
  expect(fitted.balance.shareL).toBeGreaterThan(0.6);
  expect(fitted.balance.shareL).toBeLessThan(0.7);
  expect(fitted.pose.hip_L.x).toBeLessThan(fitted.pose.hip_R.x);
  expect(fitted.parents.wrist_L).toBe('elbow_L');
  expect(fitted.parents.shoulder_L).toBe('clavicle_L');
  await expect(page.locator('#animation-field')).toBeHidden();
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#checkpoints')).toBeHidden();
  expect((await canvas.screenshot()).equals(original)).toBe(false);
  await artifact(page, info, 'dan-source-revised');
  await page.reload();
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  await expect
    .poll(async () => (await snapshot(page)).rigQA?.options.view)
    .toBe('source-fit');
  await expect(page.locator('#rig-view')).toHaveValue('source-fit');
  await page.locator('#load').click();
  await expect(page.locator('#status')).toHaveText(
    'Ready · revised Dan source',
  );
  expect((await snapshot(page)).characters[0].rig).toBe('static-source-fit');
  expect(
    await page.evaluate(async () => {
      try {
        await window.__HERO_ARENA__.resume();
        return 'played';
      } catch (e) {
        return String(e);
      }
    }),
  ).toContain('static');
  for (const [name, options] of [
    ['joints', { overlay: true }],
    ['silhouette', { overlay: false, silhouette: true }],
    ['mirror', { mirror: true, silhouette: false }],
    ['court', { mirror: false, scale: 'court' }],
  ] as const) {
    await page.evaluate(
      (options) => window.__HERO_ARENA__.setRigQA(options),
      options,
    );
    await artifact(page, info, 'dan-source-' + name);
  }
  expect((await snapshot(page)).characters[0].root).toMatchObject({
    x: 225,
    y: 610,
    scaleX: 1,
    scaleY: 1,
  });
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('character-dan'),
  );
  const restored = await snapshot(page);
  expect(restored.characters[0]).toEqual(originalState.characters[0]);
  expect(restored.rigQA!.sourceFit).toBeNull();
  expect((await canvas.screenshot()).equals(original)).toBe(true);
  expect(errors).toEqual([]);
});
