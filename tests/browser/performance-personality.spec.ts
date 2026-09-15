import { test, expect } from 'playwright/test';
import fs from 'node:fs/promises';
import type { ProofProjectile } from '../../lab/human-motion/events/PrecisionProof';
for (const sport of ['cornhole', 'basketball'])
  test(`Performance: Doug ${sport} resolves physics before shared chest tap`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
      `/human-motion/?event=${sport}&actor=doug&take=personality&focus=doug`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const result = await page.evaluate(() => {
      const api = window.__HERO_MOTION__,
        samples = [];
      const contacts: { name: string; time: number }[] = [];
      for (let i = 0; i < 672; i++) {
        api.step(1 / 120);
        const s = api.getState(),
          a = s.actors[1];
        samples.push({
          time: s.time,
          score: a.score,
          release: a.releaseCount,
          performance: a.personality,
          prop: a.prop,
          graph: a.graph,
          joints: a.motion.latest?.joints,
        });
        for (const m of s.markers)
          if (
            m.name.startsWith('chestTapContact') &&
            !contacts.some((c) => c.time === m.time)
          )
            contacts.push(m);
      }
      return { samples, contacts, state: api.getState() };
    });
    const a = result.state.actors[1],
      p = (result.state.event.projectiles as ProofProjectile[])[0];
    expect(errors).toEqual([]);
    expect(a.releaseCount).toBe(1);
    expect(result.state.event.projectiles).toHaveLength(1);
    expect(p.landed).toBe(true);
    expect(a.score).toBe(sport === 'cornhole' ? 3 : 2);
    const history = a.personality.history,
      phases = history.map((h) => h.phase);
    expect(phases).toEqual(
      sport === 'cornhole'
        ? [
            'PRE_ACTION',
            'ACTION',
            'WATCHING',
            'RESULT',
            'REACTION',
            'RECOVERY',
            'IDLE',
          ]
        : ['ACTION', 'WATCHING', 'RESULT', 'REACTION', 'RECOVERY', 'IDLE'],
    );
    expect(history.find((h) => h.phase === 'REACTION')!.gesture).toBe(
      'chestTap',
    );
    expect(
      history.find((h) => h.phase === 'REACTION')!.time -
        history.find((h) => h.phase === 'RESULT')!.time,
    ).toBeGreaterThanOrEqual(0.13);
    expect(
      result.samples
        .filter((s) => s.performance.phase === 'WATCHING')
        .every((s) => s.score === 0),
    ).toBe(true);
    expect(
      result.samples.some((s) =>
        s.graph.some((g) => g.native === 'v2_gesture.chestTap'),
      ),
    ).toBe(true);
    expect(result.contacts).toHaveLength(2);
    for (const contact of result.contacts) {
      const hold = result.samples.filter(
        (s) => s.time >= contact.time && s.time <= contact.time + 0.05,
      );
      const first = hold[0].joints!;
      for (const sample of hold) {
        const j = sample.joints!;
        expect(
          Math.hypot(
            j.rightHand.x - j.chest.x - (first.rightHand.x - first.chest.x),
            j.rightHand.y - j.chest.y - (first.rightHand.y - first.chest.y),
          ),
        ).toBeLessThan(3);
      }
    }
    if (sport === 'cornhole') {
      expect(a.prop.tosses).toBe(1);
      expect(a.prop.catches).toBe(1);
      expect(a.prop.catchError).toBeLessThan(2);
      expect(result.samples.some((s) => s.prop.flight && s.release === 0)).toBe(
        true,
      );
      expect(
        result.samples
          .filter((s) => s.performance.phase === 'PRE_ACTION')
          .every((s) => s.release === 0 && s.score === 0),
      ).toBe(true);
      expect(p.contact!.result).toBe('hole');
      expect(p.gravity.x).toBe(0);
    }
    // Contact is against the chest region, not an outstretched raised palm.
    for (const contact of result.contacts) {
      const s = result.samples.find((s) => s.time >= contact.time)!,
        j = s.joints!;
      expect(
        Math.hypot(j.rightHand.x - j.chest.x, j.rightHand.y - j.chest.y),
      ).toBeLessThan(18);
    }
    await fs.writeFile(
      info.outputPath('performance.json'),
      JSON.stringify(result),
    );
    await page
      .locator('#stage canvas')
      .screenshot({ path: info.outputPath('settled.png') });
  });

test('Measured comparison follows the shared scrub and frame-step clock', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    '/human-motion/?event=cornhole&actor=doug&take=primaryAction&focus=doug&seek=1.11',
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.locator('#reference-comparison summary').click();
  await expect
    .poll(async () =>
      page.locator('#reference-comparison').getAttribute('data-source-time'),
    )
    .not.toBeNull();
  await expect
    .poll(async () =>
      page
        .locator('#reference-comparison')
        .evaluate((el) =>
          Math.abs(
            Number((el as HTMLElement).dataset.sourceTime) -
              Number((el as HTMLElement).dataset.targetTime),
          ),
        ),
    )
    .toBeLessThan(0.035);
  await expect(page.locator('#reference-human canvas')).toHaveCount(1);
  await expect
    .poll(async () =>
      page.locator('#reference-character canvas').evaluate((el) => {
        const pixels = (el as HTMLCanvasElement)
          .getContext('2d')!
          .getImageData(0, 50, 640, 380).data;
        let lit = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 120) lit++;
        return lit / (640 * 380);
      }),
    )
    .toBeGreaterThan(0.3);
  const before = await page
    .locator('#reference-comparison')
    .getAttribute('data-target-time');
  await page.locator('#step').click();
  await expect
    .poll(async () =>
      page.locator('#reference-comparison').getAttribute('data-target-time'),
    )
    .not.toBe(before);
  await page.selectOption('#speed', '0.25');
  await page
    .locator('#reference-comparison')
    .screenshot({ path: info.outputPath('synchronized.png') });
  await page.locator('#reference-comparison summary').click();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
