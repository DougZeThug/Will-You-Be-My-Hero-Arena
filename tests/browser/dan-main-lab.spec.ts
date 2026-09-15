import { test, expect } from 'playwright/test';
import { openScenario, snapshot, checkpoint, step, artifact } from './helpers';

test('main cornhole Lab renders the authored side-view Dan and releases from its palm bone', async ({
  page,
}, info) => {
  const assets: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/cornhole-side-v3/')) assets.push(r.url());
  });
  const errors = await openScenario(page, 'cornhole-recorded');
  const initial = await snapshot(page),
    hash = initial.event.recordingHash;
  expect(initial.characters[0].rig).toBe('loongbones-weighted');
  expect(initial.characters[1].rig).toBe('loongbones-weighted');
  expect(initial.characters[0].rigDetails).toMatchObject({
    armature: 'dan_side_v3',
    sample: 'side-v3',
    assetIdentityVerified: true,
    editorRoundTripVerified: false,
    productionInstalled: false,
    bones: 30,
    handedness: 'right',
    meshes: 8,
  });
  expect(assets.some((url) => url.endsWith('dan_ske.json'))).toBe(true);
  expect(assets.some((url) => url.endsWith('dan_tex.png'))).toBe(true);
  await checkpoint(page, 'anticipation');
  await artifact(page, info, 'dan-main-anticipation');
  const idle = await snapshot(page);
  await checkpoint(page, 'release');
  const release = await snapshot(page),
    dan = release.characters[0],
    bag = release.event.projectile.find((p: any) => p.visible && !p.attached);
  expect(dan.rigDetails.resolvedClip).toBe('cornhole_throw_blocker_R_dan');
  expect(dan.rigDetails.clipTime).toBeCloseTo(52 / 60, 7);
  expect(dan.rigDetails.releaseMarker).toBeCloseTo(52 / 60, 7);
  expect(dan.rigDetails.releaseBone).toBe('throwing_hand');
  expect(dan.animation.pose).toBeNull(); // no generic paper pose substituted
  expect(
    Math.hypot(
      bag.x - dan.sockets.throwingHand.x,
      bag.y - dan.sockets.throwingHand.y,
    ),
  ).toBeLessThan(0.001);
  expect(bag.displayWidth).toBeCloseTo(60, 4);
  expect(dan.sockets.throwingHand).not.toEqual(
    idle.characters[0].sockets.throwingHand,
  );
  for (const foot of ['heel_L', 'toe_L', 'heel_R', 'toe_R']) {
    const a = dan.rigDetails.feet[foot],
      b = idle.characters[0].rigDetails.feet[foot];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.25);
  }
  await artifact(page, info, 'dan-main-release');
  await step(page, 1);
  const after = await snapshot(page),
    flight = after.event.projectile.find((p: any) => p.id === bag.id);
  expect(Math.hypot(flight.x - bag.x, flight.y - bag.y)).toBeLessThan(22);
  await step(page, 17);
  await artifact(page, info, 'dan-main-follow');
  await checkpoint(page, 'recovery');
  await artifact(page, info, 'dan-main-recovery');
  await checkpoint(page, 'release');
  expect((await snapshot(page)).characters).toEqual(release.characters);
  expect((await snapshot(page)).event.recordingHash).toBe(hash);
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-paper-reference'),
  );
  expect((await snapshot(page)).characters[0].rig).toBe('connected-paper');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-recorded'),
  );
  await checkpoint(page, 'release');
  expect((await snapshot(page)).characters).toEqual(release.characters);
  expect(errors).toEqual([]);
});

test('main Lab refuses corrupt Dan assets instead of silently showing the legacy character', async ({
  page,
}) => {
  await page.route('**/cornhole-side-v3/dan_ske.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/?scenario=cornhole-recorded');
  await expect(page.locator('#error')).toContainText(
    'Dan fixture hash mismatch',
  );
  const state = await snapshot(page);
  expect(state.ready).toBe(false);
  expect(state.status).toBe('error');
  expect(state.characters).toEqual([]);
});
