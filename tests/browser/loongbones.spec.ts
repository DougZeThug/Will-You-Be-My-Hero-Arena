import { test, expect, type Page } from 'playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
async function state(page: Page) {
  const result = await page.evaluate(() =>
    window.__HERO_LOONGBONES_PROOF__.getState(),
  );
  if (!('phaser' in result)) throw Error('Proof is not ready');
  return result;
}
test.beforeEach(async ({ page }) => {
  await page.goto('/loongbones/');
  await page.waitForFunction(
    () => window.__HERO_LOONGBONES_PROOF__?.getState().ready,
  );
});

test('LoongBones proof: exact Phaser runtime plays an authored character and transitions continuously', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const initial = await state(page);
  expect(initial.phaser).toBe('3.90.0');
  expect(initial.runtime).toBe('5.7.000');
  expect(initial.freshLoongBonesExportVerified).toBe(false);
  expect(initial.sample.meshes).toHaveLength(13);
  expect(initial.sample.bones).toHaveLength(17);
  await page.selectOption('#clip', 'walk');
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.1));
  const blend = await state(page);
  expect(blend.sample.tracks.map((t) => t.name)).toEqual(
    expect.arrayContaining(['idle', 'walk']),
  );
  expect(blend.sample.meshes).not.toEqual(initial.sample.meshes);
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.2));
  expect((await state(page)).sample.tracks.map((t) => t.name)).toEqual([
    'walk',
  ]);
  for (const mesh of (await state(page)).sample.meshes)
    for (const vertex of mesh.vertices)
      for (const n of vertex) expect(Number.isFinite(n)).toBe(true);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('authored-walk.png') });
  const normal = await state(page);
  await page.click('#mirror');
  const mirrored = await state(page);
  for (let i = 0; i < normal.sample.bones.length; i++) {
    expect(mirrored.sample.bones[i].x + normal.sample.bones[i].x).toBeCloseTo(
      620,
      3,
    );
    expect(mirrored.sample.bones[i].y).toBeCloseTo(normal.sample.bones[i].y, 3);
  }
  expect(mirrored.bag.x).toBeCloseTo(mirrored.hand.x, 5);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('mirrored-walk.png') });
  await page.click('#mirror');
  expect(errors).toEqual([]);
});

test('LoongBones proof: weighted mesh, FFD and authored marker drive the handoff', async ({
  page,
}, info) => {
  const initial = await state(page);
  expect(initial.arm.meshes[0].vertices).toHaveLength(16);
  await page.click('#throw');
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.3));
  const anticipation = await state(page);
  expect(anticipation.bag.attached).toBe(true);
  expect(anticipation.bag.x).toBeCloseTo(anticipation.hand.x, 5);
  expect(anticipation.bag.y).toBeCloseTo(anticipation.hand.y, 5);
  expect(anticipation.arm.meshes[0].vertices).not.toEqual(
    initial.arm.meshes[0].vertices,
  );
  const upper = anticipation.arm.bones.find((b) => b.name === 'upper')!.matrix;
  const lower = anticipation.arm.bones.find(
    (b) => b.name === 'forearm',
  )!.matrix;
  const weight = (95 - 50) / 55;
  const expectedX =
    (upper.a * 95 + upper.c * -13 + upper.tx) * (1 - weight) +
    (lower.a * 15 + lower.c * -13 + lower.tx) * weight;
  const expectedY =
    (upper.b * 95 + upper.d * -13 + upper.ty) * (1 - weight) +
    (lower.b * 15 + lower.d * -13 + lower.ty) * weight;
  expect(anticipation.arm.meshes[0].vertices[4][0]).toBeCloseTo(expectedX, 4);
  expect(anticipation.arm.meshes[0].vertices[4][1]).toBeCloseTo(expectedY, 4);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('weighted-anticipation.png') });
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.05));
  const released = await state(page);
  expect(released.events.filter((e) => e.name === 'release')).toHaveLength(1);
  expect(released.release!.markerTime).toBeCloseTo(20 / 60, 5);
  expect(Math.abs(released.release!.time - 20 / 60)).toBeLessThanOrEqual(
    1 / 120 + 1e-8,
  );
  expect(released.bag.attached).toBe(false);
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(1));
  const flight = await state(page);
  expect(flight.events.filter((e) => e.name === 'release')).toHaveLength(1);
  expect(
    Math.hypot(flight.bag.x - flight.hand.x, flight.bag.y - flight.hand.y),
  ).toBeGreaterThan(30);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('marker-release.png') });
  await page.evaluate(() => {
    const api = window.__HERO_LOONGBONES_PROOF__;
    api.reset();
    api.clip('deform', 'arm', 0);
    api.step(1 / 120);
  });
  const before = await state(page);
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.5));
  const after = await state(page);
  expect(after.arm.meshes[0].vertices).not.toEqual(
    before.arm.meshes[0].vertices,
  );
  // FFD must deform skin while leaving the evaluated bone positions unchanged.
  expect(after.arm.bones).toEqual(before.arm.bones);
});

test('LoongBones proof: real file import is local and rejects unsupported exports without replacing the character', async ({
  page,
}) => {
  const asset = (suffix: string) =>
    path.resolve(`lab/loongbones/assets/mecha_1406_${suffix}`);
  const sources = ['ske.json', 'tex.json', 'tex.png'].map(asset);
  const network: string[] = [];
  page.on('request', (r) => network.push(r.url()));
  await page.locator('#export-files').setInputFiles(sources);
  await expect
    .poll(async () => (await state(page)).sampleSource.kind)
    .toBe('local-import');
  const accepted = await state(page);
  expect(accepted.sampleSource.armature).toBe('mecha_1406');
  expect(accepted.freshLoongBonesExportVerified).toBe(false);
  expect(
    network.filter(
      (url) =>
        !url.startsWith('http://127.0.0.1:3010/') && !url.startsWith('blob:'),
    ),
  ).toEqual([]);
  const unsupported = JSON.parse(await fs.readFile(asset('ske.json'), 'utf8'));
  unsupported.version = '6.0';
  await page.locator('#export-files').setInputFiles([
    {
      name: 'unsupported.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(unsupported)),
    },
    {
      name: 'sample_tex.json',
      mimeType: 'application/json',
      buffer: await fs.readFile(asset('tex.json')),
    },
    {
      name: 'sample_tex.png',
      mimeType: 'image/png',
      buffer: await fs.readFile(asset('tex.png')),
    },
  ]);
  await expect(page.locator('#status')).toContainText('5.5/5.6');
  expect((await state(page)).sampleSource).toEqual(accepted.sampleSource);
  await page.selectOption('#clip', 'walk');
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.3));
  expect((await state(page)).sample.tracks.map((t) => t.name)).toEqual([
    'walk',
  ]);
});

test('LoongBones proof: pause, deterministic replay and bounded realtime diagnostics', async ({
  page,
}) => {
  const replay = () =>
    page.evaluate(() => {
      const api = window.__HERO_LOONGBONES_PROOF__;
      api.reset();
      api.clip('throw', 'arm', 0);
      api.step(0.35);
      return api.getState();
    });
  const a = await replay(),
    b = await replay();
  expect(a).toEqual(b);
  await page.click('#play');
  await expect
    .poll(async () => (await state(page)).seconds)
    .toBeGreaterThan(0.8);
  await page.click('#pause');
  const paused = await state(page);
  expect(paused.performance.samples).toBeGreaterThan(5);
  await page.waitForTimeout(150);
  expect((await state(page)).seconds).toBe(paused.seconds);
  expect(
    await page.evaluate(() => {
      try {
        window.__HERO_LOONGBONES_PROOF__.step(Number.NaN);
        return '';
      } catch (e) {
        return String(e);
      }
    }),
  ).toContain('Step must');
  expect((await state(page)).seconds).toBe(paused.seconds);
});
