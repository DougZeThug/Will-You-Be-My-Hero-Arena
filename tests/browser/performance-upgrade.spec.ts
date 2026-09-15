import { test, expect } from 'playwright/test';

for (const actor of ['doug', 'dan'])
  for (const outcome of ['hit', 'block', 'miss'])
    test(`Performance contact: ${actor} ${outcome} uses authoritative result`, async ({
      page,
    }) => {
      await page.goto(
        `/human-motion/?event=fighting&actor=${actor}&take=combat-${outcome}`,
      );
      await page.waitForFunction(
        () => window.__HERO_MOTION__?.getState().actors,
      );
      await expect(page.locator('#review-landmark')).toBeHidden();
      const state = await page.evaluate(() => {
        window.__HERO_MOTION__.step(4);
        return window.__HERO_MOTION__.getState();
      });
      const event = state.event as {
        contacts: {
          attacker: string;
          outcome: string;
          id: string;
          direction: { x: number; y: number };
          intensity: number;
        }[];
        hits: { damage: number }[];
      };
      expect(
        event.contacts
          .filter((c) => c.attacker === actor)
          .map((c) => c.outcome),
      ).toEqual([outcome]);
      expect(new Set(event.contacts.map((c) => c.id)).size).toBe(
        event.contacts.length,
      );
      for (const contact of event.contacts) {
        expect(Math.abs(contact.direction.x)).toBe(1);
        expect(contact.direction.y).toBe(0);
        expect(contact.intensity).toBe(
          outcome === 'miss' ? 0 : outcome === 'block' ? 2 / 18 : 8 / 18,
        );
      }
      const receiver = state.actors.find((a) => a.id !== actor)!;
      expect(receiver.health).toBe(
        outcome === 'miss' ? 100 : outcome === 'block' ? 98 : 92,
      );
    });

test('Performance gait: rolling support preserves evaluated contact without stretching limbs', async ({
  page,
}) => {
  await page.goto('/human-motion/?event=running&actor=doug&take=run-stop');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const measured = await page.evaluate(() => {
    let max = 0,
      lengthError = 0,
      rolls = 0;
    for (let f = 0; f < 270; f++) {
      window.__HERO_MOTION__.step(1 / 120);
      const a = window.__HERO_MOTION__
        .getState()
        .actors.find((a) => a.id === 'doug')!;
      for (const [side, c] of Object.entries(a.rig.supportContacts)) {
        if (c.region === 'sole') continue;
        const lock = a.rig.feet.find((l) => l.foot === side);
        if (!lock || lock.duration < 0.09 || lock.influence < 0.999) continue;
        const p = a.motion.latest!.joints[side + 'Ankle'];
        max = Math.max(max, Math.hypot(p.x - c.ankle.x, p.y - c.ankle.y));
        rolls++;
      }
      lengthError = Math.max(
        lengthError,
        ...Object.values(a.motion.limbLengthError),
      );
    }
    return { max, lengthError, rolls };
  });
  expect(measured.rolls).toBeGreaterThan(10);
  expect(measured.max).toBeLessThan(2);
  expect(measured.lengthError).toBeLessThan(0.1);
});
