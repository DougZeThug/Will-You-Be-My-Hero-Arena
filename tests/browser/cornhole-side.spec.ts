import { test, expect } from 'playwright/test';
import { openScenario, checkpoint, snapshot, artifact } from './helpers';

for (const character of ['dan', 'doug'])
  test(`${character} side rig: facing, palm sequence, registered wrist and bounded layered geometry`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const result = await page.evaluate((character) => {
      const api = window.__HERO_WEIGHTED_RIG__;
      const sample = (clip: string, seconds: number) => {
        api.reset(clip);
        api.step(seconds);
        const s = api.getState();
        if (!s.ready) throw Error('Not ready');
        return s;
      };
      const neutral = sample('neutral', 0),
        clip = `cornhole_throw_flat_R_${character}`;
      const releaseTime = neutral.rig.releaseMarker;
      const states = [0, 0.25, releaseTime - 0.07, releaseTime + 0.07, 1.8].map(
        (t) => sample(clip, t),
      );
      const release = sample(clip, releaseTime);
      const point = (name: string) =>
        release.pose.bones.find((b) => b.name === name)!;
      let largestCoordinate = 0;
      for (const state of states)
        for (const mesh of state.pose.meshes)
          for (const p of mesh.vertices)
            for (const value of p) {
              if (!Number.isFinite(value)) throw Error('Invalid vertex');
              largestCoordinate = Math.max(largestCoordinate, Math.abs(value));
            }
      return {
        states: states.map((s) => ({
          t: s.seconds,
          hands: s.rig.handSurfaces,
        })),
        rig: neutral.rig,
        shoulder: point('upper_arm_L'),
        wrist: point('hand_L'),
        palm: point('throwing_hand'),
        hip: point('pelvis'),
        largestCoordinate,
        feet: neutral.rig.feet,
        releaseTime,
      };
    }, character);
    expect(result.rig.sample).toBe('side-v3');
    expect(result.rig.assetIdentityVerified).toBe(true);
    expect(result.rig.editorRoundTripVerified).toBe(false);
    expect(result.rig.meshes).toBe(8);
    expect(result.largestCoordinate).toBeLessThan(450);
    for (const side of ['L', 'R'])
      expect(result.feet['toe_' + side].x).toBeGreaterThan(
        result.feet['heel_' + side].x + 35,
      );
    const alpha = (i: number, name: string) =>
      result.states[i].hands.find((h) => h.name === name)!.alpha;
    expect(alpha(0, 'relaxed')).toBeCloseTo(1, 5);
    expect(alpha(1, 'grip')).toBeCloseTo(1, 5);
    expect(alpha(2, 'grip')).toBeCloseTo(1, 5);
    expect(alpha(3, 'open')).toBeCloseTo(1, 5);
    expect(alpha(4, 'relaxed')).toBeCloseTo(1, 5);
    for (const state of result.states)
      expect(
        state.hands.reduce((sum, hand) => sum + hand.alpha, 0),
      ).toBeCloseTo(1, 4);
    expect(result.palm.x).toBeGreaterThan(result.shoulder.x + 70);
    expect(result.palm.y).toBeGreaterThan(result.shoulder.y + 15);
    expect(result.palm.y).toBeLessThan(result.hip.y);
    expect(result.palm.x - result.wrist.x).toBeGreaterThan(9);
    expect(Math.abs(result.palm.y - result.wrist.y)).toBeLessThan(5);
    await info.attach('hand-and-facing-audit', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    for (const [name, options] of [
      ['skeleton', { overlay: true }],
      ['silhouette', { overlay: false, silhouette: true }],
      ['mirror', { mirrored: true }],
    ] as const) {
      await page.evaluate((options) => {
        const api = window.__HERO_WEIGHTED_RIG__;
        api.reset('neutral');
        api.view(options);
      }, options);
      await page
        .locator('#stage canvas')
        .screenshot({ path: info.outputPath(name + '.png') });
    }
    expect(errors).toEqual([]);
  });

test('side-view main Lab keeps both new rigs through throw, release and reset', async ({
  page,
}, info) => {
  const errors = await openScenario(page, 'cornhole-recorded');
  for (const moment of [
    'anticipation',
    'release',
    'flight',
    'doug-anticipation',
    'doug-release',
    'doug-follow',
    'doug-recovery',
  ]) {
    await checkpoint(page, moment);
    const state = await snapshot(page);
    if (moment === 'anticipation') {
      const [dan, doug] = state.characters;
      expect(dan.rigDetails.heightInches).toBe(68);
      expect(doug.rigDetails.heightInches).toBe(68);
      // Same physical stature at different court depths: measure evaluated
      // head sockets against planted ground origins, not declared scale data.
      const heightRatio =
        (doug.root.y - doug.sockets.head.y) / (dan.root.y - dan.sockets.head.y);
      expect(heightRatio).toBeGreaterThan(0.66);
      expect(heightRatio).toBeLessThan(0.74);
      expect(dan.root.y).toBe(610);
      expect(doug.root.y).toBe(477);
    }
    expect(
      state.characters.every((c) => c.rigDetails?.sample === 'side-v3'),
    ).toBe(true);
    expect(
      state.characters.every((c) => c.rigDetails?.handSurfaces.length === 3),
    ).toBe(true);
    await artifact(page, info, moment);
  }
  expect(errors).toEqual([]);
});
