import { test, expect } from 'playwright/test';
import { openScenario, snapshot, checkpoint, step, artifact } from './helpers';

test('Dan exposed upper arm has no chest-pinned skin through the elbow transition', async ({
  request,
}) => {
  const response = await request.get(
    '/loongbones/assets/cornhole-motion-v2/dan_ske.json',
  );
  expect(response.ok()).toBe(true);
  const arm = (await response.json()).armature[0];
  const mesh = arm.skin[0].slot[0].display[0];
  const used = new Set<number>(mesh.triangles),
    weights: number[][] = [];
  for (let cursor = 0; cursor < mesh.weights.length;) {
    const count = mesh.weights[cursor++];
    weights.push(mesh.weights.slice(cursor, cursor + 2 * count));
    cursor += 2 * count;
  }
  let checked = 0;
  for (const i of used) {
    const x = mesh.vertices[2 * i] + 404,
      y = mesh.vertices[2 * i + 1] + 1918;
    if (x < 120 || x > 180 || y < 650 || y > 910) continue;
    checked++;
    let total = 0;
    for (let k = 0; k < weights[i].length; k += 2) {
      expect(arm.bone[weights[i][k]].name, `skin ${x},${y}`).toMatch(
        /^(upper_arm|forearm|hand)_L$/,
      );
      total += weights[i][k + 1];
    }
    expect(total).toBeCloseTo(1, 6);
  }
  expect(checked).toBeGreaterThan(100);
});

for (const character of ['dan', 'doug'] as const)
  test(`${character}: five right-handed throws have moving release, weight transfer and planted soles`, async ({
    page,
  }, info) => {
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const results = await page.evaluate(() => {
      const api = window.__HERO_WEIGHTED_RIG__;
      api.reset('neutral');
      const rest = api.getState();
      if (!rest.ready) throw Error('Not ready');
      const clips = (rest.rig.authoredClips as string[]).filter((c) =>
        c.startsWith('cornhole_throw_'),
      );
      const body = rest.pose.meshes.find((mesh) => mesh.name === 'body')!;
      const footIndices = body.vertices
        .map((p, i) => ({ p, i }))
        .filter(({ p }) =>
          rest.character === 'dan'
            ? p[1] > -6 && p[0] < 0
            : (p[1] > -18 && p[0] < 0) || (p[1] > -5 && p[0] > 0),
        );
      if (footIndices.length < 20)
        throw Error('Sole QA must inspect actual body/foot vertices');
      const point = (s: typeof rest, name: string) =>
        s.pose.bones.find((b) => b.name === name)!;
      return clips.map((clip) => {
        api.reset(clip);
        let peakStep = 0,
          soleDrift = 0,
          pelvisTravel = 0,
          previous = api.getState();
        const trajectory = [];
        for (let i = 0; i < 300; i++) {
          api.step(1 / 120);
          const s = api.getState();
          if (!s.ready || !previous.ready) throw Error('Not ready');
          const p = point(s, 'throwing_hand'),
            q = point(previous, 'throwing_hand');
          peakStep = Math.max(peakStep, Math.hypot(p.x - q.x, p.y - q.y));
          const hip = point(s, 'pelvis'),
            oldHip = point(rest, 'pelvis');
          pelvisTravel = Math.max(
            pelvisTravel,
            Math.hypot(hip.x - oldHip.x, hip.y - oldHip.y),
          );
          for (const { p, i } of footIndices) {
            const v = s.pose.meshes.find((mesh) => mesh.name === 'body')!
              .vertices[i];
            soleDrift = Math.max(
              soleDrift,
              Math.hypot(v[0] - p[0], v[1] - p[1]),
            );
          }
          if (
            s.pose.meshes.some((m) =>
              m.vertices.some((p) => p.some((v) => !Number.isFinite(v))),
            )
          )
            throw Error('Non-finite skin');
          trajectory.push({ time: s.seconds, x: p.x, y: p.y });
          previous = s;
        }
        const s = api.getState();
        if (!s.ready) throw Error('Not ready');
        const marker = s.markers[0],
          h = 1 / 240;
        const at = (t: number) => {
          api.reset(clip);
          api.step(t);
          const s = api.getState();
          if (!s.ready) throw Error('Not ready');
          return point(s, 'throwing_hand');
        };
        const a = at(marker.time - h),
          b = at(marker.time),
          c = at(marker.time + h);
        const before = { x: (b.x - a.x) / h, y: (b.y - a.y) / h },
          after = { x: (c.x - b.x) / h, y: (c.y - b.y) / h };
        return {
          clip,
          peakStep,
          soleDrift,
          pelvisTravel,
          marker,
          before,
          after,
          rig: s.rig,
          trajectory,
        };
      });
    });
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.rig.handedness).toBe('right');
      expect(r.rig.releaseParent).toBe('hand_L');
      expect(r.soleDrift, r.clip).toBeLessThan(0.3);
      expect(r.pelvisTravel, r.clip).toBeGreaterThan(2);
      expect(r.pelvisTravel).toBeLessThan(10);
      expect(r.peakStep).toBeLessThan(12);
      expect(r.before.x, r.clip).toBeGreaterThan(80);
      expect(r.before.y, r.clip).toBeLessThan(-40);
      const dot =
        (r.before.x * r.after.x + r.before.y * r.after.y) /
        (Math.hypot(r.before.x, r.before.y) * Math.hypot(r.after.x, r.after.y));
      expect(dot).toBeGreaterThan(0.98);
    }
    await info.attach('full-body-motion', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
  });

test('cornhole handoff keeps the same bag, position, orientation and velocity; outcomes survive new timing', async ({
  page,
}, info) => {
  const errors = await openScenario(page, 'cornhole-recorded');
  const initial = await snapshot(page);
  for (const actor of [0, 1]) {
    await checkpoint(page, actor ? 'doug-pre-release' : 'pre-release');
    const before = await snapshot(page);
    const held = before.event.projectile.find(
        (p: any) => p.visible && p.attached && p.actor === actor,
      ),
      hand = before.characters[actor].sockets.throwingHand;
    expect(held).toBeTruthy();
    expect(Math.hypot(held.x - hand.x, held.y - hand.y)).toBeLessThan(0.001);
    await checkpoint(page, actor ? 'doug-release' : 'release');
    const release = await snapshot(page),
      bag = release.event.projectile.find((p: any) => p.id === held.id);
    expect(bag.attached).toBe(false);
    expect(release.event.projectile.length).toBe(
      before.event.projectile.length,
    );
    const launch = release.characters[actor].sockets.throwingHand;
    expect(Math.hypot(bag.x - launch.x, bag.y - launch.y)).toBeLessThan(0.001);
    // Compare the bag with the hand at the SAME time. The previous check
    // compared two checkpoints and incorrectly required a rotating wrist to
    // remain almost horizontal between them.
    expect(held.rotation).toBeCloseTo(
      before.characters[actor].rigDetails.handTransform.angle,
      6,
    );
    expect(bag.rotation).toBeCloseTo(
      release.characters[actor].rigDetails.handTransform.angle,
      6,
    );
    expect(bag.kinematics.initialVelocity.x).toBeGreaterThan(80);
    expect(bag.kinematics.initialVelocity.y).toBeLessThan(-40);
    await step(page, 1);
    const next = await snapshot(page),
      flight = next.event.projectile.find((p: any) => p.id === bag.id),
      k = bag.kinematics,
      dt = 1 / 60;
    expect(flight.x).toBeCloseTo(
      bag.x + k.initialVelocity.x * dt + 0.5 * k.acceleration.x * dt * dt,
      5,
    );
    expect(flight.y).toBeCloseTo(
      bag.y + k.initialVelocity.y * dt + 0.5 * k.acceleration.y * dt * dt,
      5,
    );
    await artifact(
      page,
      info,
      actor ? 'doug-release-motion' : 'dan-release-motion',
    );
  }
  await checkpoint(page, 'finish');
  const completed = await snapshot(page);
  expect(completed.event.recordingHash).toBe(initial.event.recordingHash);
  const weightedScores = completed.event.finalScores;
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-paper-reference'),
  );
  await checkpoint(page, 'finish');
  expect((await snapshot(page)).event.finalScores).toEqual(weightedScores);
  expect(errors).toEqual([]);
});
