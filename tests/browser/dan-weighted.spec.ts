import { test, expect, type Page } from 'playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function state(page: Page) {
  const s = await page.evaluate(() => window.__HERO_DAN_RIG__.getState());
  if (!s.ready) throw Error('Dan not ready');
  return s;
}
test.beforeEach(async ({ page }) => {
  await page.goto('/loongbones/dan/');
  await page.waitForFunction(() => window.__HERO_DAN_RIG__?.getState().ready);
});
test('Dan weighted rig: approved bind geometry, anatomical hierarchy and real skin weights', async ({
  page,
}, info) => {
  await page.evaluate(() => window.__HERO_DAN_RIG__.reset('neutral'));
  const s = await state(page);
  const raw = JSON.parse(
    await fs.readFile(
      'lab/loongbones/assets/dan-weighted-v1/dan_ske.json',
      'utf8',
    ),
  ).armature[0];
  const mesh = raw.skin[0].slot[0].display[0];
  // The renderer alone cannot detect missing editor-only mesh topology.
  expect([mesh.width, mesh.height]).toEqual([808, 1947]);
  expect(mesh.userEdges).toEqual([]);
  const edgeUses = new Map<string, number>();
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = mesh.triangles[i + j],
        b = mesh.triangles[i + ((j + 1) % 3)];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
    }
  }
  const boundary = [...edgeUses]
    .filter(([, count]) => count === 1)
    .map(([key]) => key)
    .sort();
  const exported = [];
  for (let i = 0; i < mesh.edges.length; i += 2) {
    const a = mesh.edges[i],
      b = mesh.edges[i + 1];
    exported.push(a < b ? `${a}:${b}` : `${b}:${a}`);
  }
  expect(exported.sort()).toEqual(boundary);
  expect(exported.length).toBeGreaterThan(0);
  const directory = 'lab/loongbones/assets/dan-weighted-v1';
  const provenance = JSON.parse(
    (await fs.readFile(`${directory}/provenance.json`, 'utf8')).replace(
      /^\uFEFF/,
      '',
    ),
  );
  for (const [name, hash] of Object.entries(provenance.assetsSha256)) {
    expect(
      createHash('sha256')
        .update(await fs.readFile(`${directory}/${name}`))
        .digest('hex'),
    ).toBe(hash);
  }
  expect(
    createHash('sha256')
      .update(await fs.readFile(provenance.source))
      .digest('hex'),
  ).toBe(provenance.sourceSha256);
  const pack = await page.request.get(
    '/loongbones/assets/dan-weighted-v1/dan-rig-import.zip',
  );
  expect(pack.ok()).toBe(true);
  expect((await pack.body()).readUInt32LE(0)).toBe(0x04034b50);
  expect(s.editorRoundTripVerified).toBe(false);
  expect(s.productionInstalled).toBe(false);
  expect(s.phaser).toBe('3.90.0');
  expect(s.bones).toHaveLength(30);
  expect(s.bones.find((b) => b.name === 'forearm_R')!.parent).toBe(
    'upper_arm_R',
  );
  expect(s.bones.find((b) => b.name === 'upper_arm_R')!.parent).toBe(
    'clavicle_R',
  );
  let blended = 0;
  let invalidIndices = 0,
    invalidWeights = 0,
    maxWeightError = 0;
  for (let i = 0; i < mesh.weights.length;) {
    const count = mesh.weights[i++];
    let sum = 0;
    for (let j = 0; j < count; j++) {
      const index = mesh.weights[i++];
      if (!Number.isInteger(index) || index < 0 || index >= raw.bone.length)
        invalidIndices++;
      const weight = mesh.weights[i++];
      if (!Number.isFinite(weight) || weight <= 0 || weight > 1)
        invalidWeights++;
      sum += weight;
    }
    maxWeightError = Math.max(maxWeightError, Math.abs(sum - 1));
    if (count > 1) blended++;
  }
  expect(invalidIndices).toBe(0);
  expect(invalidWeights).toBe(0);
  expect(maxWeightError).toBeLessThan(0.000001);
  expect(blended).toBeGreaterThan(500);
  let deviation = 0;
  s.meshes[0].vertices.forEach((v, i) =>
    v.forEach((n, j) => {
      deviation = Math.max(deviation, Math.abs(n - mesh.vertices[i * 2 + j]));
    }),
  );
  expect(deviation).toBeLessThan(0.02);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('dan-neutral.png') });
});
test('Dan weighted rig: IK preserves actual foot vertices while pelvis and knees move', async ({
  page,
}) => {
  await page.evaluate(() => window.__HERO_DAN_RIG__.reset('neutral'));
  const rest = await state(page);
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('weight_shift');
    a.step(1.4);
  });
  const shifted = await state(page);
  for (const n of ['heel_L', 'toe_L', 'heel_R', 'toe_R'])
    expect(
      Math.hypot(
        shifted.sockets[n].x - rest.sockets[n].x,
        shifted.sockets[n].y - rest.sockets[n].y,
      ),
    ).toBeLessThan(0.01);
  let soles = 0;
  rest.meshes[0].vertices.forEach((v, i) => {
    if (v[1] > -100) {
      expect(shifted.meshes[0].vertices[i][0]).toBeCloseTo(v[0], 2);
      expect(shifted.meshes[0].vertices[i][1]).toBeCloseTo(v[1], 2);
      soles++;
    }
  });
  expect(soles).toBeGreaterThan(20);
  for (const name of ['pelvis', 'shin_L']) {
    const before = rest.bones.find((b) => b.name === name)!,
      after = shifted.bones.find((b) => b.name === name)!;
    expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeGreaterThan(
      0.1,
    );
  }
});
test('Dan weighted rig: authored release detaches once at the evaluated hand and replays', async ({
  page,
}) => {
  const run = async () => {
    await page.evaluate(() => {
      const a = window.__HERO_DAN_RIG__;
      a.reset('throw_low');
      a.step(42 / 60);
    });
    const attached = await state(page);
    expect(attached.release).toBeNull();
    expect(attached.bag.attached).toBe(true);
    expect(attached.bag.x).toBeCloseTo(attached.sockets.throwing_hand.x, 5);
    expect(attached.bag.y).toBeCloseTo(attached.sockets.throwing_hand.y, 5);
    await page.evaluate(() => window.__HERO_DAN_RIG__.step(2 / 60));
    const released = await state(page);
    expect(released.release).not.toBeNull();
    expect(released.release!.markerTime).toBeCloseTo(43 / 60, 6);
    expect(
      released.release!.time - released.release!.markerTime,
    ).toBeLessThanOrEqual(1 / 120 + 1e-6);
    expect(released.markers.filter((m) => m.name === 'release')).toHaveLength(
      1,
    );
    await page.evaluate(() => window.__HERO_DAN_RIG__.view({ mirrored: true }));
    const flipped = await state(page);
    expect(flipped.bag.x + released.bag.x).toBeCloseTo(released.root.x * 2, 5);
    expect(flipped.bag.y).toBeCloseTo(released.bag.y, 5);
    await page.evaluate(() =>
      window.__HERO_DAN_RIG__.view({ mirrored: false }),
    );
    await page.evaluate(() => window.__HERO_DAN_RIG__.step(2));
    expect(
      (await state(page)).markers.filter((m) => m.name === 'release'),
    ).toHaveLength(1);
    return released.release;
  };
  expect(await run()).toEqual(await run());
});
test('Dan weighted rig: all clips, silhouette, mirror, court scale, pause and storage isolation', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  const clips = (await state(page)).animations;
  for (const clip of clips) {
    const finite = await page.evaluate((name) => {
      const a = window.__HERO_DAN_RIG__;
      a.reset(name);
      for (let i = 0; i < 180; i++) {
        a.step(1 / 60);
        const s = a.getState();
        if (!s.ready) return false;
        for (const m of s.meshes)
          for (const v of m.vertices)
            if (v.some((n) => !Number.isFinite(n) || Math.abs(n) > 5000))
              return false;
      }
      return true;
    }, clip);
    expect(finite).toBe(true);
  }
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('neutral');
    a.view({ silhouette: true, overlay: true });
  });
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('silhouette-joints.png') });
  const normal = await state(page);
  await page.locator('#mirrored').check();
  const mirrored = await state(page);
  normal.bones.forEach((b, i) => {
    expect(b.x + mirrored.bones[i].x).toBeCloseTo(normal.root.x * 2, 3);
    expect(b.y).toBeCloseTo(mirrored.bones[i].y, 3);
  });
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('mirrored.png') });
  await page.locator('#silhouette').uncheck();
  await page.locator('#overlay').uncheck();
  await page.locator('#mirrored').uncheck();
  await page.locator('#court').check();
  expect((await state(page)).root.scaleY).toBeCloseTo(371 / 1900, 8);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('court.png') });
  await page.selectOption('#clip', 'idle_breathe');
  await page.click('#play');
  await expect
    .poll(async () => (await state(page)).seconds)
    .toBeGreaterThan(0.1);
  await page.click('#pause');
  const paused = await state(page);
  await page.waitForTimeout(120);
  expect((await state(page)).seconds).toBe(paused.seconds);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage);
  expect(errors).toEqual([]);
});
