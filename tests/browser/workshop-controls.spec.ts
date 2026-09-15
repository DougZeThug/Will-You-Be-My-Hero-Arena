import { test, expect } from 'playwright/test';

test('Workshop: in-page seek and loop reconstruct one isolated canvas', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    '/human-motion/?event=basketball&actor=doug&take=primaryAction&rate=0.25&neutral=1',
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await expect(page.locator('#speed')).toHaveValue('0.25');
  await expect(page.locator('#neutral-background')).toBeChecked();
  await page.evaluate(() => window.__HERO_MOTION__.step(1.1));
  const before = await page.evaluate(() => window.__HERO_MOTION__.getState());
  await page.evaluate(() => window.__HERO_MOTION__.seek(0.5));
  await page.waitForFunction(
    () => Math.abs((window.__HERO_MOTION__?.getState().time ?? 0) - 0.5) < 1e-6,
  );
  await page.evaluate(() => window.__HERO_MOTION__.step(0.6));
  const after = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(after.event).toEqual(before.event);
  expect(after.actors.map((a) => a.anchors)).toEqual(
    before.actors.map((a) => a.anchors),
  );
  await page.locator('#loop-from').fill('0');
  await page.locator('#loop-to').fill('1.2');
  await page.locator('#loop-enabled').check();
  await page.selectOption('#speed', '1');
  await page.locator('#play').click();
  await page.waitForFunction(
    () => window.__HERO_MOTION__.workshop().loopCount >= 2,
    {},
    { timeout: 20000 },
  );
  await page.locator('#pause').click();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Workshop: reduced motion disables optional organic performance', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/human-motion/?event=cornhole');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await expect(page.locator('#organic')).not.toBeChecked();
  const s = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(s.actors.every((a) => !a.rig.performance.enabled)).toBe(true);
});
