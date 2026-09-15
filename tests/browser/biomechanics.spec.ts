import { test, expect } from 'playwright/test';

for (const character of ['dan', 'doug'])
  test(`${character}: whole-body transfer, delayed settling and release velocity`, async ({
    page,
  }, info) => {
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const result = await page.evaluate((character) => {
      const api = window.__HERO_WEIGHTED_RIG__;
      api.reset(`cornhole_throw_flat_R_${character}`);
      const initial = api.getState();
      if (!initial.ready) throw Error('Not ready');
      const bone = (s: typeof initial, n: string) =>
        s.pose.bones.find((b) => b.name === n)!;
      const angle = (s: typeof initial, a: string, b: string) =>
        (Math.atan2(bone(s, b).y - bone(s, a).y, bone(s, b).x - bone(s, a).x) *
          180) /
        Math.PI;
      const knee = (s: typeof initial, side: string) =>
        angle(s, 'thigh_' + side, 'shin_' + side) -
        angle(s, 'shin_' + side, 'foot_' + side);
      type Point = { x: number; y: number };
      const frames: {
        time: number;
        hip: Point;
        shoulder: Point;
        hand: Point;
        headAngle: number;
        chestAngle: number;
        nearKnee: number;
        farKnee: number;
        offX: number;
        massProxyX: number;
        support: number[];
        upperAngle: number;
        elbowAngle: number;
        wristAngle: number;
        opaqueHands: number;
      }[] = [];
      for (
        let frame = 0;
        frame <= Math.floor(initial.duration * 120);
        frame++
      ) {
        api.seek(frame / 120);
        const s = api.getState();
        if (!s.ready) throw Error('Not ready');
        const hip = bone(s, 'pelvis'),
          chest = bone(s, 'chest'),
          head = bone(s, 'skull_center'),
          off = bone(s, 'off_hand');
        frames.push({
          time: s.seconds,
          hip,
          shoulder: bone(s, 'upper_arm_L'),
          hand: bone(s, 'throwing_hand'),
          headAngle:
            angle(s, 'head', 'skull_center') -
            angle(initial, 'head', 'skull_center'),
          chestAngle:
            angle(s, 'chest', 'neck') - angle(initial, 'chest', 'neck'),
          nearKnee: knee(s, 'L'),
          farKnee: knee(s, 'R'),
          offX: off.x - chest.x,
          massProxyX: 0.6 * hip.x + 0.3 * chest.x + 0.1 * head.x,
          support: [bone(s, 'heel_L').x, bone(s, 'toe_R').x],
          upperAngle: angle(s, 'upper_arm_L', 'forearm_L'),
          elbowAngle:
            angle(s, 'upper_arm_L', 'forearm_L') -
            angle(s, 'forearm_L', 'hand_L'),
          wristAngle:
            angle(s, 'hand_L', 'throwing_hand') -
            angle(s, 'forearm_L', 'hand_L'),
          opaqueHands: s.rig.handSurfaces.filter(
            (h) => Math.abs(h.alpha - 1) < 0.00001,
          ).length,
        });
      }
      const release = initial.rig.releaseMarker;
      const speed = frames.slice(1, -1).map((f, i) => ({
        time: f.time,
        speed:
          Math.hypot(
            frames[i + 2].hand.x - frames[i].hand.x,
            frames[i + 2].hand.y - frames[i].hand.y,
          ) * 60,
      }));
      const forward = speed.filter(
        (f) => f.time > release - 0.25 && f.time < release + 0.2,
      );
      const peak = forward.reduce((a, b) => (a.speed > b.speed ? a : b));
      const launched = forward.reduce((a, b) =>
        Math.abs(a.time - release) < Math.abs(b.time - release) ? a : b,
      );
      const fwd = frames.find((f) => f.time >= release + 0.06)!;
      const recovery = frames
        .filter((f) => f.time > release + 0.4)
        .reduce((a, b) =>
          Math.abs(a.upperAngle - fwd.upperAngle) <
          Math.abs(b.upperAngle - fwd.upperAngle)
            ? a
            : b,
        );
      return {
        release,
        landmarks: initial.landmarks,
        frames,
        peak,
        launched,
        recoveryElbowDifference: Math.abs(recovery.elbowAngle - fwd.elbowAngle),
        handProportions: ['grip', 'open', 'relaxed'].map((name) => {
          const wrist = bone(initial, 'hand_L'),
            elbow = bone(initial, 'forearm_L');
          const mesh = initial.pose.meshes.find((m) => m.name === name)!;
          return (
            Math.max(
              ...mesh.vertices.map((p) =>
                Math.hypot(p[0] - wrist.x, p[1] - wrist.y),
              ),
            ) / Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y)
          );
        }),
      };
    }, character);
    await info.attach('biomechanics', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    const range = (field: 'nearKnee' | 'farKnee' | 'offX') =>
      Math.max(...result.frames.map((f) => f[field])) -
      Math.min(...result.frames.map((f) => f[field]));
    expect(result.landmarks).toHaveLength(17);
    expect(Math.min(...result.frames.map((f) => f.hip.x))).toBeLessThan(-2);
    expect(Math.max(...result.frames.map((f) => f.hip.x))).toBeGreaterThan(7);
    expect(Math.max(...result.frames.map((f) => f.chestAngle))).toBeGreaterThan(
      4,
    );
    expect(
      Math.max(...result.frames.map((f) => Math.abs(f.headAngle))),
    ).toBeLessThan(1.5);
    expect(range('nearKnee')).toBeGreaterThan(2);
    expect(range('farKnee')).toBeGreaterThan(2);
    expect(range('offX')).toBeGreaterThan(3);
    for (const f of result.frames) {
      expect(f.opaqueHands).toBe(1);
      expect(f.wristAngle).toBeGreaterThan(-40);
      expect(f.wristAngle).toBeLessThan(18);
      // A visual balance proxy only, not force-plate data or measured human COM.
      expect(f.massProxyX).toBeGreaterThan(f.support[0]);
      expect(f.massProxyX).toBeLessThan(f.support[1]);
    }
    const shoulderPeak = result.frames.reduce((a, b) =>
      a.shoulder.x > b.shoulder.x ? a : b,
    );
    expect(shoulderPeak.time).toBeGreaterThan(result.release);
    expect(Math.abs(result.peak.time - result.release)).toBeLessThan(0.075);
    expect(result.launched.speed / result.peak.speed).toBeGreaterThan(0.88);
    expect(result.recoveryElbowDifference).toBeGreaterThan(8);
    for (const [i, proportion] of result.handProportions.entries()) {
      // Curled relaxed fingers have a shorter projected reach than the open
      // release drawing. Do not enlarge that drawing to fake straight fingers.
      expect(proportion).toBeGreaterThan(i === 2 ? 0.55 : 0.6);
      expect(proportion).toBeLessThan(0.95);
    }
  });

test('review controls seek semantic poses and slow the same authored clock', async ({
  page,
}) => {
  await page.goto(
    '/loongbones/doug/?character=dan&clip=cornhole_throw_flat_R_dan',
  );
  await page.waitForFunction(
    () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
  );
  await page.locator('#phase').selectOption({ label: 'bagRelease · 0.817s' });
  const released = await page.evaluate(() =>
    window.__HERO_WEIGHTED_RIG__.getState(),
  );
  expect(released.ready).toBe(true);
  if (!released.ready) throw Error('Not ready');
  expect(released.seconds).toBeCloseTo(released.rig.releaseMarker, 8);
  expect(released.playing).toBe(false);
  for (const rate of [0.25, 0.5, 1]) {
    await page.locator('#reset').click();
    await page.locator('#speed').selectOption(String(rate));
    await page.locator('#play').click();
    await page.waitForTimeout(450);
    await page.locator('#pause').click();
    const s = await page.evaluate(() =>
      window.__HERO_WEIGHTED_RIG__.getState(),
    );
    if (!s.ready) throw Error('Not ready');
    expect(s.playbackRate).toBe(rate);
    expect(s.seconds / rate).toBeGreaterThan(0.2);
    expect(s.seconds / rate).toBeLessThan(1.2);
  }
  await page.locator('#silhouette').check();
  await page.locator('#mirrored').check();
  await page.locator('#court').check();
  const s = await page.evaluate(() => window.__HERO_WEIGHTED_RIG__.getState());
  if (!s.ready) throw Error('Not ready');
  expect(s.view).toMatchObject({
    silhouette: true,
    mirrored: true,
    court: true,
  });
});
