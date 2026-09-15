import { test, expect, type Page } from 'playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const directory = 'lab/loongbones/assets/dan-editor-r2';
async function load(page: Page, sample: string) {
  await page.goto(`/loongbones/dan/?sample=${sample}`);
  await page.waitForFunction(() => window.__HERO_DAN_RIG__?.getState().ready);
}
async function state(page: Page) {
  const s = await page.evaluate(() => window.__HERO_DAN_RIG__.getState());
  if (!s.ready) throw Error('Dan not ready');
  return s;
}
test('Dan editor round trip: modified valid bytes cannot retain the verified identity', async ({
  page,
}) => {
  const bytes = await fs.readFile(
    `${directory}/dan-editor-r2_ske.json`,
    'utf8',
  );
  await page.route('**/dan-editor-r2_ske.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: bytes + ' ' }),
  );
  await page.goto('/loongbones/dan/?sample=editor');
  await expect(page.locator('#status')).toContainText('hash mismatch', {timeout:30000});
  expect(
    await page.evaluate(
      () => window.__HERO_DAN_RIG__?.getState().ready ?? false,
    ),
  ).toBe(false);
});
test('Dan editor round trip: received bytes, original drawing and honest provenance', async ({
  page,
}) => {
  const provenance = JSON.parse(
    await fs.readFile(`${directory}/provenance.json`, 'utf8'),
  );
  for (const [name, hash] of Object.entries({
    ...provenance.originalFiles,
    [provenance.derived.file]: provenance.derived.sha256,
  }))
    expect(
      createHash('sha256')
        .update(await fs.readFile(`${directory}/${name}`))
        .digest('hex'),
    ).toBe(hash);
  await load(page, 'editor');
  const s = await state(page);
  expect(s.assetIdentityVerified).toBe(true);
  expect(s.sample).toBe('editor');
  expect(s.compatibilityRestored).toBe(false);
  expect(s.editorRoundTripVerified).toBe(false);
  expect(s.productionInstalled).toBe(false);
  expect(s.phaser).toBe('3.90.0');
  const pixels = await page.evaluate(async () => {
    const image = async (src: string) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      return im;
    };
    const original = await image(
      '/loongbones/assets/dan-weighted-v1/dan_tex.png',
    );
    const returned = await image(
      '/loongbones/assets/dan-editor-r2/dan-editor-r2_tex.png',
    );
    const canvas = document.createElement('canvas');
    canvas.width = 808;
    canvas.height = 1947;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(original, 0, 0);
    const a = ctx.getImageData(0, 0, 808, 1947).data;
    ctx.clearRect(0, 0, 808, 1947);
    ctx.drawImage(returned, 1, 1, 808, 1947, 0, 0, 808, 1947);
    const b = ctx.getImageData(0, 0, 808, 1947).data;
    let changed = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++;
    return changed;
  });
  expect(pixels).toBe(0);
});

test('Dan editor round trip: raw loss stays visible; restoration preserves authored motion', async ({
  page,
}) => {
  test.setTimeout(60000);
  const sampleMotion = async () =>
    page.evaluate(() => {
      const a = window.__HERO_DAN_RIG__;
      const first = a.getState();
      if (!first.ready) throw Error('Not ready');
      return first.animations.map((clip) => {
        a.reset(clip);
        const poses = [];
        for (let i = 0; i < 33; i++) {
          a.step(0.1);
          const s = a.getState();
          if (!s.ready) throw Error('Not ready');
          poses.push({
            bones: s.bones.map((b) => [b.name, b.x, b.y] as const),
            vertices: s.meshes[0].vertices.filter((_, j) => j % 37 === 0),
          });
        }
        const s = a.getState();
        if (!s.ready) throw Error('Not ready');
        return {
          clip,
          poses,
          completed: s.tracks[0].completed,
          markers: s.markers,
        };
      });
    });
  await load(page, 'authored');
  const reference = await sampleMotion();
  await load(page, 'restored');
  const restored = await sampleMotion();
  let maxBone = 0,
    maxVertex = 0;
  reference.forEach((clip, c) => {
    expect(restored[c].clip).toBe(clip.clip);
    expect(restored[c].completed).toBe(clip.completed);
    clip.poses.forEach((pose, i) => {
      const output = restored[c].poses[i];
      pose.bones.forEach(([name, x, y]) => {
        const b = output.bones.find((b) => b[0] === name)!;
        maxBone = Math.max(maxBone, Math.hypot(b[1] - x, b[2] - y));
      });
      pose.vertices.forEach(
        (v, j) =>
          (maxVertex = Math.max(
            maxVertex,
            Math.hypot(
              v[0] - output.vertices[j][0],
              v[1] - output.vertices[j][1],
            ),
          )),
      );
    });
    expect(
      restored[c].markers.map(({ name, time }) => ({ name, time })),
    ).toEqual(clip.markers.map(({ name, time }) => ({ name, time })));
  });
  expect(maxBone).toBeLessThan(0.002);
  expect(maxVertex).toBeLessThan(0.03);
  expect((await state(page)).compatibilityRestored).toBe(true);
  await load(page, 'editor');
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('weight_shift');
    a.step(1.4);
  });
  const raw = await state(page);
  const ref = reference.find((c) => c.clip === 'weight_shift')!.poses[13];
  const knee = raw.bones.find((b) => b.name === 'shin_L')!,
    refKnee = ref.bones.find((b) => b[0] === 'shin_L')!;
  expect(Math.hypot(knee.x - refKnee[1], knee.y - refKnee[2])).toBeGreaterThan(
    20,
  );
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('idle_breathe');
    a.step(4);
  });
  expect((await state(page)).tracks[0].completed).toBe(true);
});

test('Dan editor round trip: restored foot planting, release, replay, mirror and real pause', async ({
  page,
}, info) => {
  await load(page, 'restored');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  await page.evaluate(() => window.__HERO_DAN_RIG__.reset('neutral'));
  const neutral = await state(page);
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('weight_shift');
    a.step(1.4);
  });
  const shift = await state(page);
  let soleDrift = 0;
  neutral.meshes[0].vertices.forEach((v, i) => {
    if (v[1] > -100)
      soleDrift = Math.max(
        soleDrift,
        Math.hypot(
          v[0] - shift.meshes[0].vertices[i][0],
          v[1] - shift.meshes[0].vertices[i][1],
        ),
      );
  });
  expect(soleDrift).toBeLessThan(0.002);
  const release = async () => {
    await page.evaluate(() => {
      const a = window.__HERO_DAN_RIG__;
      a.reset('throw_low');
      a.step(42 / 60);
    });
    const held = await state(page);
    expect(held.release).toBeNull();
    expect(held.bag.x).toBeCloseTo(held.sockets.throwing_hand.x, 5);
    expect(held.bag.y).toBeCloseTo(held.sockets.throwing_hand.y, 5);
    await page.evaluate(() => window.__HERO_DAN_RIG__.step(2 / 60));
    const s = await state(page);
    expect(s.release!.markerTime).toBeCloseTo(43 / 60, 6);
    expect(s.release!.time - s.release!.markerTime).toBeLessThanOrEqual(
      1 / 120 + 1e-6,
    );
    await page.evaluate(() => window.__HERO_DAN_RIG__.step(3));
    expect(
      (await state(page)).markers.filter((m) => m.name === 'release'),
    ).toHaveLength(1);
    return s;
  };
  const first = await release(),
    second = await release();
  expect(first.release).toEqual(second.release);
  await page.evaluate(() => {
    const a = window.__HERO_DAN_RIG__;
    a.reset('throw_low');
    a.step(44 / 60);
    a.view({ mirrored: true });
  });
  const mirrored = await state(page);
  expect(mirrored.bag.x + first.bag.x).toBeCloseTo(first.root.x * 2, 5);
  await page.screenshot({
    path: info.outputPath('restored-mirrored-release.png'),
  });
  await page.locator('#mirrored').uncheck();
  await page.locator('#court').check();
  await page.selectOption('#clip', 'idle_breathe');
  await page.click('#play');
  await expect.poll(async () => (await state(page)).seconds).toBeGreaterThan(1);
  await page.click('#pause');
  const paused = await state(page);
  await page.waitForTimeout(120);
  expect((await state(page)).seconds).toBe(paused.seconds);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage);
  expect(errors).toEqual([]);
});
