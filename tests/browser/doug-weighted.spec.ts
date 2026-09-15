import { test, expect } from 'playwright/test';
import { openScenario, snapshot, checkpoint, artifact } from './helpers';
test('Doug weighted rig: all clips preserve feet, finite skin and deterministic marker sampling', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/loongbones/doug/?version=2');
  await page.waitForFunction(
    () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
  );
  const results = await page.evaluate(() => {
    const api = window.__HERO_WEIGHTED_RIG__;
    api.reset('neutral');
    const rest = api.getState();
    if (!rest.ready) throw Error('Not ready');
    const feet = rest.pose.meshes[0].vertices
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => (p[1] > -18 && p[0] < 0) || (p[1] > -5 && p[0] > 0));
    const clips = rest.rig.authoredClips as string[],
      metrics = [];
    for (const clip of clips) {
      api.reset(clip);
      let previous = api.getState(),
        maxStep = 0,
        maxSoleDrift = 0;
      for (let frame = 0; frame < 180; frame++) {
        api.step(1 / 60);
        const state = api.getState();
        if (!state.ready || !previous.ready) throw Error('Not ready');
        const points = state.pose.meshes[0].vertices;
        for (let i = 0; i < points.length; i++) {
          const p = points[i],
            old = previous.pose.meshes[0].vertices[i];
          if (!p.every(Number.isFinite)) throw Error('Non-finite skin');
          maxStep = Math.max(maxStep, Math.hypot(p[0] - old[0], p[1] - old[1]));
        }
        for (const { p, i } of feet)
          maxSoleDrift = Math.max(
            maxSoleDrift,
            Math.hypot(points[i][0] - p[0], points[i][1] - p[1]),
          );
        previous = state;
      }
      const state = api.getState();
      if (!state.ready) throw Error('Not ready');
      metrics.push({ clip, maxStep, maxSoleDrift, markers: state.markers });
    }
    api.reset('cornhole_throw_flat_R_doug');
    api.step(55 / 60);
    const first = api.getState();
    api.reset('inspect_hand');
    api.step(0.5);
    api.reset('cornhole_throw_flat_R_doug');
    api.step(55 / 60);
    return { metrics, first, repeated: api.getState() };
  });
  expect(results.repeated).toEqual(results.first);
  expect(results.metrics).toHaveLength(14);
  for (const m of results.metrics) {
    expect(m.maxStep, m.clip).toBeLessThan(30);
    expect(m.maxSoleDrift, m.clip).toBeLessThan(0.3);
    expect(m.markers.length).toBe(m.clip.startsWith('cornhole_throw_') ? 1 : 0);
  }
  await info.attach('rig-motion-metrics', {
    body: JSON.stringify(results.metrics, null, 2),
    contentType: 'application/json',
  });
  for (const [name, clip, time] of [
    ['neutral', 'neutral', 0],
    ['flat-release', 'cornhole_throw_flat_R_doug', 55 / 60],
    ['arc-release', 'cornhole_throw_airmail_R_doug', 62 / 60],
    ['celebration', 'celebrate_open_hand', 0.7],
    ['reaction', 'inspect_hand', 0.7],
  ] as const) {
    await page.evaluate(
      ({ clip, time }) => {
        window.__HERO_WEIGHTED_RIG__.reset(clip);
        window.__HERO_WEIGHTED_RIG__.step(time);
      },
      { clip, time },
    );
    await page
      .locator('#stage canvas')
      .screenshot({ path: info.outputPath(name + '.png') });
  }
  await page.evaluate(() => {
    window.__HERO_WEIGHTED_RIG__.reset('neutral');
    window.__HERO_WEIGHTED_RIG__.view({ overlay: true, silhouette: true });
  });
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('silhouette-skeleton.png') });
  await page.evaluate(() =>
    window.__HERO_WEIGHTED_RIG__.view({ mirrored: true }),
  );
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('mirror.png') });
  expect(errors).toEqual([]);
});

test('Doug main Lab: authored release joins the recorded trajectory and survives reload', async ({
  page,
}, info) => {
  const errors = await openScenario(page, 'cornhole-recorded');
  const initial = await snapshot(page);
  await checkpoint(page, 'doug-anticipation');
  await artifact(page, info, 'doug-anticipation');
  await checkpoint(page, 'doug-release');
  const release = await snapshot(page),
    doug = release.characters[1],
    bag = release.event.projectile.find(
      (p: any) => p.visible && !p.attached && p.actor === 1,
    );
  expect(doug.rig).toBe('loongbones-weighted');
  expect(doug.rigDetails).toMatchObject({
    armature: 'doug_side_v3',
    sample: 'side-v3',
    assetIdentityVerified: true,
    editorExportReceived: false,
    bones: 30,
  });
  expect(doug.rigDetails.resolvedClip).toMatch(/^cornhole_throw_.*_R_doug$/);
  expect(
    Math.hypot(
      bag.x - doug.sockets.throwingHand.x,
      bag.y - doug.sockets.throwingHand.y,
    ),
  ).toBeLessThan(0.001);
  expect(bag.displayWidth).toBeCloseTo(60, 4);
  await artifact(page, info, 'doug-release');
  await checkpoint(page, 'doug-follow');
  await artifact(page, info, 'doug-follow');
  await checkpoint(page, 'doug-recovery');
  await artifact(page, info, 'doug-recovery');
  await page.reload();
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  await checkpoint(page, 'doug-release');
  const replay = await snapshot(page);
  // Native interpolation can differ by one IEEE-754 rounding unit after a
  // reload/JIT warmup. Check opacity to 14 decimals; all other state remains
  // exact so this cannot hide a changed pose, socket, clip or asset identity.
  for (const [i, character] of replay.characters.entries())
    for (const [j, hand] of character.rigDetails.handSurfaces.entries())
      expect(hand.alpha).toBeCloseTo(
        release.characters[i].rigDetails.handSurfaces[j].alpha,
        14,
      );
  const withoutOpacity = (characters: typeof replay.characters) =>
    characters.map((c) => ({
      ...c,
      rigDetails: {
        ...c.rigDetails,
        handSurfaces: c.rigDetails.handSurfaces.map(
          ({
            alpha: _alpha,
            ...hand
          }: {
            alpha: number;
            name: string;
            visible: boolean;
          }) => hand,
        ),
      },
    }));
  expect(withoutOpacity(replay.characters)).toEqual(
    withoutOpacity(release.characters),
  );
  expect(replay.event.recordingHash).toBe(initial.event.recordingHash);
  expect(errors).toEqual([]);
});
