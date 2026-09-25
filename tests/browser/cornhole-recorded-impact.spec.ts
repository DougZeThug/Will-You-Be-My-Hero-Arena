import { test, expect } from 'playwright/test';
import { openScenario, snapshot, seekTime } from './helpers';

// End-to-end visual proof of the non-performance cornhole hole-contact star-burst
// (the bug fixed in ArenaScene.ts:313). cornhole-recorded is the legacy
// non-performance Watch path; seed velvet-paw-29 yields a hole (attempt #7, the
// showcase seed committed in run-tests.mjs). ImpactEffects.contact only draws the
// impact-star sprite when contact==='hole' && holeAt!==undefined; the fix passes
// active.contactAt. The hole star is a deterministic ~816-pixel signal (0.127% of
// the canvas) with zero run-to-run noise, so the reviewed pixel baseline fails if
// the star disappears again.
test('@visual cornhole-recorded: hole contact draws the impact star-burst on the non-perf rig', async ({
  page,
}) => {
  test.setTimeout(90000);
  test.skip(
    process.env.ARENA_VISUAL_BASELINES !== '1',
    'Run test:browser:visual for reviewed, environment-specific pixel baselines.',
  );
  await openScenario(page, 'cornhole-recorded');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-recorded', {
      seed: 'velvet-paw-29',
    }),
  );
  // cornhole-recorded applies timeCornholeFixture which reschedules attempts, so
  // scan the Lab clock to locate the hole attempt's actual contactAt.
  let hole = null as null | { contactAt: number };
  for (let t = 23; t <= 34 && !hole; t += 0.1) {
    await seekTime(page, t);
    const s = await snapshot(page);
    if (s.event.current?.contact === 'hole') hole = s.event.current;
  }
  expect(
    hole,
    'velvet-paw-29 yields a holed attempt in cornhole-recorded',
  ).toBeTruthy();
  if (!hole) return;
  // Inside the star window: contactAt+0.1 is within burst (0.38), puff (0.45) and
  // star (0.55) lifetimes, so the star-burst renders when holeAt is supplied.
  await seekTime(page, hole.contactAt + 0.1);
  const at = await snapshot(page);
  expect(at.event.current?.contact).toBe('hole');
  await expect(page.locator('#arena canvas')).toHaveScreenshot(
    'cornhole-recorded-hole-star.png',
    { animations: 'disabled', maxDiffPixelRatio: 0.001 },
  );
});
