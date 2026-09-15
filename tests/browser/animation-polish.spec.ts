import { test, expect } from 'playwright/test';

for (const character of ['dan', 'doug'])
  test(`${character}: open fingers survive follow-through, relaxation happens below the shoulder`, async ({
    page,
  }, info) => {
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const results = await page.evaluate(() => {
      const api = window.__HERO_WEIGHTED_RIG__;
      const initial = api.getState();
      if (!initial.ready) throw Error('Not ready');
      return (initial.rig.authoredClips as string[])
        .filter((c) => c.startsWith('cornhole_throw_'))
        .map((clip) => {
          api.reset(clip);
          const start = api.getState();
          if (!start.ready) throw Error('Not ready');
          const release = start.rig.releaseMarker;
          let relaxationHeight = Infinity,
            ghostFrames = 0;
          const samples = [];
          for (let frame = 0; frame < 150; frame++) {
            const s = api.getState();
            if (!s.ready) throw Error('Not ready');
            const alpha = (name: string) =>
              s.rig.handSurfaces.find((h) => h.name === name)!.alpha;
            const shoulder = s.pose.bones.find(
              (b) => b.name === 'upper_arm_L',
            )!;
            const hand = s.pose.bones.find((b) => b.name === 'hand_L')!;
            if (
              s.seconds > release + 0.15 &&
              alpha('relaxed') > 0.01 &&
              relaxationHeight === Infinity
            )
              relaxationHeight = hand.y - shoulder.y;
            if (
              s.seconds > release + 0.15 &&
              alpha('relaxed') > 0.01 &&
              alpha('open') > 0.01
            )
              ghostFrames++;
            if (Math.abs(s.seconds - (release + 0.25)) < 1 / 120)
              samples.push({ open: alpha('open'), relaxed: alpha('relaxed') });
            const sum = s.rig.handSurfaces.reduce((n, h) => n + h.alpha, 0);
            if (Math.abs(sum - 1) > 0.001)
              throw Error('Missing or double hand exposure');
            api.step(1 / 60);
          }
          return { clip, relaxationHeight, ghostFrames, samples };
        });
    });
    for (const r of results) {
      expect(r.samples).toHaveLength(1);
      expect(r.samples[0].open, r.clip).toBeGreaterThan(0.99);
      expect(r.samples[0].relaxed).toBeLessThan(0.01);
      expect(r.relaxationHeight, r.clip).toBeGreaterThan(60);
      expect(r.ghostFrames, r.clip).toBeLessThanOrEqual(2);
    }
    await info.attach('finger-recovery', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
  });

test('Dan and Doug have different bounded reaction paths and deterministic reverse seeks', async ({
  page,
}, info) => {
  const motion: {
    character: string;
    handTravel: number;
    maximumStep: number;
  }[] = [];
  for (const character of ['dan', 'doug']) {
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const result = await page.evaluate(() => {
      const api = window.__HERO_WEIGHTED_RIG__;
      api.reset('celebrate_open_hand');
      const rest = api.getState();
      if (!rest.ready) throw Error('Not ready');
      const hand = (s: typeof rest) =>
        s.pose.bones.find((b) => b.name === 'throwing_hand')!;
      let previous = hand(rest),
        handTravel = 0,
        maximumStep = 0;
      for (let frame = 0; frame < 160; frame++) {
        api.step(1 / 120);
        const s = api.getState();
        if (!s.ready) throw Error('Not ready');
        const p = hand(s),
          q = hand(rest);
        handTravel = Math.max(handTravel, Math.hypot(p.x - q.x, p.y - q.y));
        maximumStep = Math.max(
          maximumStep,
          Math.hypot(p.x - previous.x, p.y - previous.y),
        );
        previous = p;
      }
      api.reset('celebrate_open_hand');
      api.step(0.4);
      const forward = api.getState();
      api.step(0.8);
      api.reset('celebrate_open_hand');
      api.step(0.4);
      const reverse = api.getState();
      if (!forward.ready || !reverse.ready) throw Error('Not ready');
      return {
        character: rest.character,
        handTravel,
        maximumStep,
        deterministic:
          JSON.stringify(forward.pose) === JSON.stringify(reverse.pose),
      };
    });
    expect(result.deterministic).toBe(true);
    expect(result.maximumStep).toBeLessThan(5);
    motion.push(result);
    await page
      .locator('#stage canvas')
      .screenshot({ path: info.outputPath(character + '-reaction.png') });
  }
  expect(motion[0].handTravel).toBeLessThan(4);
  expect(motion[1].handTravel).toBeGreaterThan(30);
  await info.attach('distinct-reactions', {
    body: JSON.stringify(motion, null, 2),
    contentType: 'application/json',
  });
});
