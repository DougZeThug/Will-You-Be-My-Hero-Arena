import { test, expect } from 'playwright/test';
import type { MotionSession } from '../../lab/human-motion/MotionSession';
type State = ReturnType<MotionSession['snapshot']>;
const load = async (page: any, event: string, take: string, actor = 'doug') => {
  await page.goto(`/human-motion/?event=${event}&take=${take}&actor=${actor}`);
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
};
test('Upgrade: native far-arm volume and opaque hands survive overhead motion', async ({
  page,
}) => {
  await load(page, 'basketball', 'primaryAction');
  const report = await page.evaluate(() => {
    const api = window.__HERO_MOTION__,
      samples = [];
    for (let i = 0; i < 260; i++) {
      api.step(1 / 120);
      const s = api.getState(),
        a = s.actors.find((a) => a.id === 'doug')!;
      samples.push({
        time: s.time,
        releaseCount: a.releaseCount,
        limbs: a.rig.integrity.limbs,
        handExposure: a.rig.handExposure,
        anchor: a.anchors.twoHandGrip,
        joints: a.motion.latest!.joints,
        projectile: (s.event as any).projectiles[0],
      });
    }
    return samples;
  });
  expect(report.at(-1)!.releaseCount).toBe(1);
  for (const s of report) {
    for (const limb of s.limbs.filter((l) =>
      ['leftUpperArm', 'leftForearm'].includes(l.id),
    )) {
      expect(limb.width).toBeGreaterThan(limb.setupWidth! * 0.7);
      expect(limb.width).toBeLessThan(limb.setupWidth! * 1.3);
    }
    const hands = s.handExposure;
    expect(
      ['grip', 'open', 'relaxed', 'fist', 'support', 'chest'].reduce(
        (n, k) => n + (hands[k] ?? 0),
        0,
      ),
    ).toBe(1);
  }
  const releaseState = report.find((s) => s.releaseCount === 1)!;
  const projectile = releaseState.projectile;
  const anchor = releaseState.anchor;
  expect(
    Math.hypot(
      projectile.release.x - anchor.x,
      projectile.release.y - anchor.y,
    ),
  ).toBeLessThan(1.2);
  expect(projectile.release.velocity.x).toBeGreaterThan(150);
  const release = projectile.release.time;
  for (const s of report.filter(
    (s) => s.time > release + 0.1 && s.time < release + 0.35,
  )) {
    const joints = s.joints;
    expect(joints.rightWrist.y).toBeLessThan(joints.head.y);
  }
});
test('Upgrade: fist/chest/catch use distinct opaque drawings and release contacts', async ({
  page,
}) => {
  for (const [take, time, expected] of [
    ['fistPump', 0.7, 'fist'],
    ['chestTap', 0.7, 'chest'],
    ['bagFlip', 0.8, 'support'],
  ] as const) {
    await load(page, 'cornhole', take);
    await page.evaluate((t) => window.__HERO_MOTION__.step(t), time);
    const s = await page.evaluate(() => window.__HERO_MOTION__.getState());
    expect(
      s.actors.find((a) => a.id === 'doug')!.rig.handExposure[expected],
    ).toBe(1);
    await page.evaluate(() => window.__HERO_MOTION__.step(2));
    const after = await page.evaluate(() => window.__HERO_MOTION__.getState());
    expect(
      after.actors.find((a) => a.id === 'doug')!.rig.handExposure.relaxed,
    ).toBe(1);
  }
});
test('Upgrade: fractional stepping, frame schedules and reload seek are deterministic', async ({
  page,
}) => {
  // Multiple fresh pages and thousands of fixed simulation steps; this is not
  // a real-time FPS test. The ordinary 45s browser budget is too short here.
  test.setTimeout(120_000);
  const results = [];
  for (const schedule of [
    [1 / 30],
    [1 / 60],
    [1 / 120],
    [1 / 240],
    [1 / 60, 1 / 15, 1 / 120],
  ]) {
    await load(page, 'cornhole', 'primaryAction');
    results.push(
      await page.evaluate((schedule) => {
        let t = 0,
          i = 0;
        while (t < 3 - 1e-9) {
          const dt = Math.min(3 - t, schedule[i++ % schedule.length]);
          window.__HERO_MOTION__.step(dt);
          t += dt;
        }
        const s = window.__HERO_MOTION__.getState();
        return {
          steps: s.steps,
          actors: s.actors.map((a) => ({
            motor: a.motor,
            release: a.releaseCount,
            hand: a.anchors.rightHand,
          })),
          event: s.event,
        };
      }, schedule),
    );
  }
  for (const result of results) expect(result).toEqual(results[0]);
  await page.goto(
    '/human-motion/?event=cornhole&take=primaryAction&actor=doug&seek=3',
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const s = await page.evaluate(() => window.__HERO_MOTION__.getState());
  expect(s.actors.find((a) => a.id === 'doug')!.releaseCount).toBe(1);
  expect(s.steps).toBe(360);
});
