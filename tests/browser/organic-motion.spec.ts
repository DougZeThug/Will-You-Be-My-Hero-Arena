import { test, expect } from 'playwright/test';
import fs from 'node:fs/promises';

for (const actor of ['dan', 'doug'])
  test(`Organic motion: ${actor} propagates load, releases visibly and keeps contacts`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
      `/human-motion/?event=cornhole&actor=${actor}&take=primaryAction`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const evidence = await page.evaluate((id) => {
      const api = window.__HERO_MOTION__,
        samples = [];
      for (let i = 0; i < 360; i++) {
        api.step(1 / 120);
        const s = api.getState(),
          a = s.actors.find((a) => a.id === id)!;
        samples.push({
          time: s.time,
          pose: a.motion.latest,
          performance: a.rig.performance,
          feet: a.rig.feet,
          exposure: a.rig.handExposure,
          releases: a.releaseCount,
          recovery: a.recovery,
          projectiles: s.event.projectiles,
        });
      }
      return { samples, curves: api.curves(id), state: api.getState() };
    }, actor);
    expect(errors).toEqual([]);
    const releaseIndex = evidence.samples.findIndex((s) => s.releases === 1);
    expect(releaseIndex).toBeGreaterThan(30);
    const release = evidence.samples[releaseIndex],
      before = evidence.samples[releaseIndex - 1];
    expect(before.exposure.grip).toBeGreaterThan(0.99);
    expect(release.exposure.open).toBeGreaterThan(0.99);
    expect(release.exposure.grip).toBeLessThan(0.01);
    const projectile = (
      release.projectiles as {
        owner: string;
        release: { x: number; y: number };
      }[]
    ).find((p) => p.owner === actor)!;
    expect(
      Math.hypot(
        projectile.release.x - release.pose!.joints.rightHand.x,
        projectile.release.y - release.pose!.joints.rightHand.y,
      ),
    ).toBeLessThan(0.01);
    expect(
      Math.max(
        ...evidence.samples.flatMap((s) => s.feet.map((f) => f.maxSlide)),
      ),
    ).toBeLessThan(2);
    const active = evidence.samples.filter(
      (s) => s.performance.technique === 'underhand',
    );
    const peaks = ['pelvis', 'chest', 'hand_L'].map((b) =>
      active.reduce((a, s) =>
        s.performance.propagation.find((p) => p.bone === b)!.value >
        a.performance.propagation.find((p) => p.bone === b)!.value
          ? s
          : a,
      ),
    );
    expect(peaks[0].time).toBeLessThan(peaks[1].time);
    expect(peaks[1].time).toBeLessThan(peaks[2].time);
    const weight = active.map((s) => s.performance.balance!.forwardBias);
    expect(Math.max(...weight) - Math.min(...weight)).toBeGreaterThan(0.15);
    expect(evidence.curves.samples.length).toBeGreaterThan(150);
    expect(
      evidence.state.actors.find((a) => a.id === actor)!.rig.performance.inertia
        .transitions,
    ).toBeGreaterThan(0);
    await fs.writeFile(
      info.outputPath(actor + '-organic.json'),
      JSON.stringify(evidence, null, 2),
    );
  });

test('Organic motion: shared review takes exercise start-stop, jump-shot and jab recovery', async ({
  page,
}, info) => {
  for (const [event, take] of [
    ['running', 'run-stop'],
    ['basketball', 'primaryAction'],
    ['fighting', 'primaryAction'],
  ]) {
    await page.goto(`/human-motion/?event=${event}&actor=dan&take=${take}`);
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const result = await page.evaluate(() => {
      const api = window.__HERO_MOTION__,
        speeds = [],
        techniques = new Set<string>();
      let airborne = false,
        maxFeet = 0;
      for (let i = 0; i < 360; i++) {
        api.step(1 / 120);
        const a = api.getState().actors[0];
        speeds.push(a.motor.velocity.x);
        airborne ||= !a.motor.grounded;
        techniques.add(a.rig.performance.technique);
        for (const f of a.rig.feet) maxFeet = Math.max(maxFeet, f.maxSlide);
      }
      return {
        state: api.getState(),
        speeds,
        airborne,
        maxFeet,
        techniques: [...techniques],
      };
    });
    if (event === 'running') {
      expect(Math.max(...result.speeds)).toBeGreaterThan(170);
      expect(result.speeds.at(-1)).toBe(0);
      expect(result.techniques).toContain('stride');
      expect(result.maxFeet).toBeLessThan(2);
    }
    if (event === 'basketball') {
      expect(result.airborne).toBe(true);
      expect(result.techniques).toContain('overhead');
      expect(result.state.actors[0].releaseCount).toBe(1);
    }
    if (event === 'fighting') {
      expect(result.techniques).toContain('strike');
      expect(result.state.actors[0].hitbox).toBe(false);
    }
    expect(
      result.state.actors[0].rig.performance.inertia.transitions,
    ).toBeGreaterThan(0);
    await fs.writeFile(
      info.outputPath(event + '-organic.json'),
      JSON.stringify(result, null, 2),
    );
  }
});

test('Organic motion: no-code close review, curve export and baseline comparison', async ({
  page,
}, info) => {
  await page.goto('/human-motion/?event=cornhole');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.selectOption('#review-character', 'doug');
  await page.selectOption('#review-take', 'specialAction');
  await page.selectOption('#review-focus', 'doug');
  await page.click('#load-take');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  await page.evaluate(() => window.__HERO_MOTION__.step(1.1));
  await page.locator('#curve-panel summary').click();
  await expect(page.locator('#motion-curves path')).toHaveCount(8);
  const downloading = page.waitForEvent('download');
  await page.click('#export-curves');
  const download = await downloading;
  await download.saveAs(info.outputPath('curves.json'));
  const data = JSON.parse(
    await fs.readFile(info.outputPath('curves.json'), 'utf8'),
  );
  expect(data.character).toBe('doug');
  expect(data.samples.length).toBeGreaterThan(50);
  await page
    .locator('canvas')
    .screenshot({ path: info.outputPath('doug-close.png') });
  await page.locator('#organic').uncheck();
  await page.waitForFunction(() =>
    window.__HERO_MOTION__
      ?.getState()
      .actors?.every((a) => !a.rig.performance.enabled),
  );
  expect(new URL(page.url()).searchParams.get('take')).toBe('specialAction');
});
