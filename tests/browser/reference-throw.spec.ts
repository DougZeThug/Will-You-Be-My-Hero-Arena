import { test, expect } from 'playwright/test';
import fs from 'node:fs/promises';
import type { ProofProjectile } from '../../lab/human-motion/events/PrecisionProof';
for (const actor of ['dan', 'doug'])
  for (const [take, style] of [
    ['primaryAction', 'flat'],
    ['secondaryAction', 'slide'],
    ['modifierRight', 'blocker'],
    ['specialAction', 'airmail'],
    ['tertiaryAction', 'roll'],
  ])
    test(`Reference cornhole: ${actor} ${style} preserves contact, launch and recovery`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(
        `/human-motion/?event=cornhole&actor=${actor}&take=${take}`,
      );
      await page.waitForFunction(
        () => window.__HERO_MOTION__?.getState().actors,
      );
      const result = await page.evaluate((id) => {
        const api = window.__HERO_MOTION__,
          samples = [],
          soles = api.soles(id);
        let maxSoleDrift = 0;
        for (let i = 0; i < 552; i++) {
          api.step(1 / 120);
          const s = api.getState(),
            a = s.actors.find((a) => a.id === id)!;
          if (a.graph.some((g) => g.id.startsWith('throw.')))
            api.soles(id).forEach((p, i) => {
              maxSoleDrift = Math.max(
                maxSoleDrift,
                Math.hypot(p.x - soles[i].x, p.y - soles[i].y),
              );
            });
          const p = (s.event.projectiles as ProofProjectile[]).find(
            (p) => p.owner === id,
          );
          samples.push({
            time: s.time,
            root: a.motor.position,
            pose: a.motion.latest,
            feet: a.rig.feet,
            exposure: a.rig.handExposure,
            release: a.releaseCount,
            projectile: p,
            phase: a.phase,
            graph: a.graph,
          });
        }
        return {
          samples,
          state: api.getState(),
          curves: api.curves(id),
          maxSoleDrift,
          soleSamples: soles.length,
        };
      }, actor);
      expect(errors).toEqual([]);
      expect(result.soleSamples).toBeGreaterThan(10);
      expect(result.maxSoleDrift).toBeLessThan(2);
      const releaseIndex = result.samples.findIndex((s) => s.release === 1),
        released = result.samples[releaseIndex],
        p = released.projectile!;
      expect(releaseIndex).toBeGreaterThan(20);
      expect(p.contact!.style).toBe(style);
      expect(p.gravity.x).toBe(0);
      expect(p.gravity.y).toBeGreaterThan(0);
      expect(released.exposure.open).toBeGreaterThan(0.99);
      expect(result.samples[releaseIndex - 1].exposure.grip).toBeGreaterThan(
        0.99,
      );
      expect(p.release.samples).toBeGreaterThanOrEqual(4);
      expect(
        Math.hypot(
          p.release.x - released.pose!.joints.rightHand.x,
          p.release.y - released.pose!.joints.rightHand.y,
        ),
      ).toBeLessThan(0.01);
      // Velocity of the next evaluated hand segment should continue in the launch direction.
      const after = result.samples[releaseIndex + 1].pose!.joints.rightHand,
        hand = released.pose!.joints.rightHand;
      const hx = (after.x - hand.x) * 120,
        hy = (after.y - hand.y) * 120;
      const cosine =
        (hx * p.release.velocity.x + hy * p.release.velocity.y) /
        (Math.hypot(hx, hy) *
          Math.hypot(p.release.velocity.x, p.release.velocity.y));
      expect(cosine).toBeGreaterThan(0.992); // <7.3 degrees over the next simulation step
      const roots = result.samples.map((s) => s.root.x);
      expect(Math.max(...roots) - Math.min(...roots)).toBeGreaterThan(5);
      expect(Math.abs(roots.at(-1)! - roots[0])).toBeLessThan(0.5);
      expect(
        Math.max(
          ...result.samples.flatMap((s) => s.feet.map((f) => f.maxSlide)),
        ),
      ).toBeLessThan(2);
      expect(result.samples.some((s) => s.phase === 'recovery')).toBe(true);
      const flight = result.samples
        .map((s) => s.projectile)
        .filter((p): p is ProofProjectile => p?.contact?.phase === 'flight');
      expect(flight.length).toBeGreaterThan(20);
      // A roll can leave the board and enter a second free-flight segment.
      // Impact/friction legitimately changed its velocity between those flights.
      for (let i = 1; i < result.samples.length; i++) {
        const previous = result.samples[i - 1].projectile,
          current = result.samples[i].projectile;
        // Board contact and edge departure may both occur within one step.
        if (
          previous?.contact?.phase === 'flight' &&
          current?.contact?.phase === 'flight' &&
          previous.contact.impacts === current.contact.impacts
        )
          expect(
            Math.abs(current.velocity.x - previous.velocity.x),
          ).toBeLessThan(0.001);
      }
      expect(result.samples.at(-1)!.projectile!.landed).toBe(true);
      await page.evaluate(() =>
        window.__HERO_MOTION__.view({ skeleton: false, trails: false }),
      );
      await page
        .locator('canvas')
        .screenshot({ path: info.outputPath('settled.png') });
      await fs.writeFile(
        info.outputPath('motion.json'),
        JSON.stringify(result),
      );
    });

test('Reference cornhole: named breakdowns load the actual authored timeline', async ({
  page,
}) => {
  await page.goto('/human-motion/?event=cornhole&actor=dan&take=primaryAction');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await expect(page.locator('#review-landmark option')).toHaveCount(19);
  await page.selectOption('#review-landmark', { label: 'maximum Backswing' });
  await page.waitForFunction(
    () => window.__HERO_MOTION__?.getState().time > 0.7,
  );
  const s = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(s.actors[0].releaseCount).toBe(0);
  await page.locator('#silhouette').check();
  await page.selectOption('#speed', '0.25');
  await page.locator('#step').click();
  expect(
    (await page.evaluate(() => window.__HERO_MOTION__.getState())).time,
  ).toBeGreaterThan(s.time);
});
