import { test, expect } from 'playwright/test';
import { openScenario, checkpoint } from './helpers';

test('Presentation: recorded HUD follows revealed scores and registered holes', async ({
  page,
}) => {
  await openScenario(page, 'cornhole-recorded');
  for (const point of ['release', 'result', 'finish', 'release']) {
    await checkpoint(page, point);
    const s = await page.evaluate(
      () => window.__HERO_ARENA__.getState() as any,
    );
    expect(s.rendering.presentation.players.map((p: any) => p.score)).toEqual(
      s.event.scores,
    );
    expect(
      s.rendering.presentation.players.map((p: any) => p.remaining),
    ).toEqual(
      s.rendering.presentation.players.map(
        (p: any) =>
          p.total -
          s.rendering.event.resolved.filter(
            (a: any) => a.actor === s.rendering.presentation.players.indexOf(p),
          ).length,
      ),
    );
    expect(s.rendering.equipmentRegistration).toHaveLength(2);
    for (const p of s.rendering.equipmentRegistration) {
      expect(
        Math.hypot(p.hole.x - p.expected.x, p.hole.y - p.expected.y),
      ).toBeLessThan(0.001);
    }
  }
});

test('Presentation: power feedback appears only while charging and leaves physics authoritative', async ({
  page,
}) => {
  await page.goto('/human-motion/?event=cornhole');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.evaluate(() => window.__HERO_MOTION__.input('dan', 'charge', 1));
  await page.evaluate(() => window.__HERO_MOTION__.step(0.4));
  const holding = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(holding.presentation!.action!.label).toBe('THROW POWER');
  expect(holding.presentation!.action!.value).toBeGreaterThan(0.3);
  await page.evaluate(() => {
    window.__HERO_MOTION__.input('dan', 'charge', 0);
    window.__HERO_MOTION__.step(0.08);
  });
  const release = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(release.presentation!.action).toBeUndefined();
  expect(release.actors[0].power).toBeCloseTo(
    holding.presentation!.action!.value,
    1,
  );
  expect(release.presentation!.players.map((p) => p.score)).toEqual(
    release.actors.map((a) => a.score),
  );
});

test('Presentation: the HUD clears the basketball flight path', async ({
  page,
}) => {
  await openScenario(page, 'basketball-recorded');
  await checkpoint(page, 'flight');
  const s = await page.evaluate(() => window.__HERO_ARENA__.getState() as any);
  expect(s.rendering.presentation.protectedPoints.length).toBeGreaterThan(0);
  expect(s.rendering.presentation.visibility.header).toBe(false);
  await checkpoint(page, 'result');
  const result = await page.evaluate(
    () => window.__HERO_ARENA__.getState() as any,
  );
  expect(result.rendering.presentation.visibility.header).toBe(true);
});

test('Presentation: neutral inspection hides authored surroundings and preserves the take', async ({
  page,
}) => {
  await page.goto(
    '/human-motion/?event=basketball&actor=dan&take=primaryAction&seek=1',
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const before = await page.evaluate(() => window.__HERO_MOTION__.getState());
  await page
    .getByRole('checkbox', { name: 'Neutral background', exact: true })
    .check();
  const after = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(after.actors).toEqual(before.actors);
  expect(after.event).toEqual(before.event);
  expect(
    await page.evaluate(() => window.__HERO_MOTION__.workshop().neutral),
  ).toBe(true);
  await page
    .getByRole('checkbox', { name: 'Neutral background', exact: true })
    .uncheck();
  expect(
    (await page.evaluate(() => window.__HERO_MOTION__.getState())).actors,
  ).toEqual(before.actors);
});
