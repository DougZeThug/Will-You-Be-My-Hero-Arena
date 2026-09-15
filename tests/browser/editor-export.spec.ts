import { test, expect, type Page } from 'playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve('lab/loongbones/assets/editor-export-20260912');
const asset = (suffix: string) =>
  path.join(directory, `arena-editor-test_${suffix}`);
async function state(page: Page) {
  const s = await page.evaluate(() =>
    window.__HERO_LOONGBONES_PROOF__.getState(),
  );
  if (!('phaser' in s)) throw Error('Proof not ready');
  return s;
}
test.beforeEach(async ({ page }) => {
  await page.goto('/loongbones/?sample=editor');
  await expect
    .poll(() => page.evaluate(() => {
      const s=window.__HERO_LOONGBONES_PROOF__?.getState();
      return s&&'phaser' in s?s.freshLoongBonesExportVerified:false;
    }))
    .toBe(true);
});

test('Editor export: genuine supplied files load the authored first pose with correct occlusion', async ({
  page,
}, info) => {
  const s = await state(page);
  expect(s.phaser).toBe('3.90.0');
  expect(s.sampleSource.armature).toBe('ubbie');
  expect(s.sample.animations).toEqual(['stand', 'walk', 'turn face', 'atc']);
  expect(s.sample.bones).toHaveLength(16);
  expect(s.sample.meshes).toHaveLength(17);
  expect(s.editorExport).toMatchObject({
    editor: 'LoongBones 1.2.3',
    scope: 'textured-character-bones-ffd',
    weightedSkinningInExport: false,
    releaseMarkersInExport: false,
  });
  expect(s.seconds).toBe(0);
  // These failed before registering initial quad depth and evaluating a zero-time pose.
  const source = JSON.parse(await fs.readFile(asset('ske.json'), 'utf8'));
  expect(s.sample.meshes.map((m) => m.name)).toEqual(
    source.armature[0].slot.map((s: { name: string }) => s.name),
  );
  for (const name of ['eye', 'mouth']) {
    expect(s.sample.meshes.find((m) => m.name === name)!.depth).toBeGreaterThan(
      s.sample.meshes.find((m) => m.name === 'head_2')!.depth,
    );
    expect(s.sample.meshes.find((m) => m.name === name)!.visible).toBe(true);
  }
  for (const name of ['apple_', 'hand_l11', 'hand_l21'])
    expect(s.sample.meshes.find((m) => m.name === name)!.visible).toBe(false);
  await page
    .locator('#stage canvas')
    .screenshot({ path: info.outputPath('editor-first-pose.png') });
});

test('Editor export: actual FFD vertices match exported keyframe offsets, independently of bone motion', async ({
  page,
}) => {
  const source = JSON.parse(await fs.readFile(asset('ske.json'), 'utf8'))
    .armature[0];
  const skin = source.skin[0].slot.find(
    (s: { name: string }) => s.name === 'body',
  ).display[0];
  const offsets = source.animation
    .find((a: { name: string }) => a.name === 'stand')
    .ffd.find((f: { slot: string }) => f.slot === 'body').frame[1].vertices;
  expect(skin.weights).toBeUndefined();
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(5 / 24));
  const s = await state(page),
    m = s.sample.slots.find((s) => s.name === 'body')!.matrix;
  const determinant = m.a * m.d - m.b * m.c;
  const vertices = s.sample.meshes.find((m) => m.name === 'body')!.vertices;
  let deformation = 0;
  for (let i = 0; i < vertices.length; i++) {
    const x = vertices[i][0] - m.tx,
      y = vertices[i][1] - m.ty;
    const lx = (m.d * x - m.c * y) / determinant,
      ly = (-m.b * x + m.a * y) / determinant;
    expect(lx).toBeCloseTo(skin.vertices[i * 2] + offsets[i * 2], 3);
    expect(ly).toBeCloseTo(skin.vertices[i * 2 + 1] + offsets[i * 2 + 1], 3);
    deformation = Math.max(
      deformation,
      Math.hypot(lx - skin.vertices[i * 2], ly - skin.vertices[i * 2 + 1]),
    );
  }
  expect(deformation).toBeGreaterThan(5);
});

test('Editor export: every original clip advances with finite geometry and restores deterministically', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const source = JSON.parse(await fs.readFile(asset('ske.json'), 'utf8'));
  for (const clip of source.armature[0].animation) {
    const sweep = await page.evaluate(
      ({ name, duration, fps }) => {
        const api = window.__HERO_LOONGBONES_PROOF__;
        api.reset();
        api.clip(name, 'sample', 0);
        const initial = api.getState();
        if (!('sample' in initial)) throw Error('Not ready');
        let maximum = 0,
          changed = false;
        for (let i = 0; i < Math.ceil((duration / fps) * 60) + 2; i++) {
          api.step(1 / 60);
          const s = api.getState();
          if (!('sample' in s)) throw Error('Not ready');
          changed ||=
            JSON.stringify(s.sample.meshes) !==
            JSON.stringify(initial.sample.meshes);
          for (const mesh of s.sample.meshes)
            for (const vertex of mesh.vertices)
              for (const n of vertex) {
                if (!Number.isFinite(n)) throw Error('Nonfinite vertex');
                maximum = Math.max(maximum, Math.abs(n));
              }
        }
        return { changed, maximum };
      },
      { name: clip.name, duration: clip.duration, fps: source.frameRate },
    );
    expect(sweep.changed).toBe(true);
    expect(sweep.maximum).toBeLessThan(5000);
    await page.evaluate((name) => {
      const a = window.__HERO_LOONGBONES_PROOF__;
      a.reset();
      a.clip(name, 'sample', 0);
      a.step(0.3);
    }, clip.name);
    const before = await state(page);
    await page.locator('#stage canvas').screenshot({
      path: info.outputPath(`${clip.name.replaceAll(' ', '-')}.png`),
    });
    await page.evaluate((name) => {
      const a = window.__HERO_LOONGBONES_PROOF__;
      a.reset();
      a.clip(name, 'sample', 0);
      a.step(0.3);
    }, clip.name);
    expect((await state(page)).sample).toEqual(before.sample);
  }
  expect(errors).toEqual([]);
});

test('Editor export: mirror, blend, pause and changed-file provenance remain truthful', async ({
  page,
}) => {
  await page.selectOption('#clip', 'walk');
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.1));
  expect((await state(page)).sample.tracks.map((t) => t.name)).toEqual(
    expect.arrayContaining(['stand', 'walk']),
  );
  await page.evaluate(() => window.__HERO_LOONGBONES_PROOF__.step(0.2));
  const original = await state(page);
  expect(original.sample.tracks.map((t) => t.name)).toEqual(['walk']);
  await page.click('#mirror');
  const mirrored = await state(page);
  original.sample.bones.forEach((b, i) => {
    expect(b.x + mirrored.sample.bones[i].x).toBeCloseTo(
      2 * original.sample.transform.x,
      // Phaser world matrices use Float32; keep tolerance far below one pixel.
      3,
    );
    expect(b.y).toBeCloseTo(mirrored.sample.bones[i].y, 5);
  });
  await page.click('#mirror');
  expect((await state(page)).sample).toEqual(original.sample);
  await page.click('#play');
  await expect
    .poll(async () => (await state(page)).seconds)
    .toBeGreaterThan(0.6);
  await page.click('#pause');
  const paused = (await state(page)).seconds;
  await page.waitForTimeout(100);
  expect((await state(page)).seconds).toBe(paused);
  const changed = JSON.parse(await fs.readFile(asset('ske.json'), 'utf8'));
  changed.name = 'unreviewed-copy';
  await page.locator('#export-files').setInputFiles([
    {
      name: 'changed_ske.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(changed)),
    },
    {
      name: 'atlas.json',
      mimeType: 'application/json',
      buffer: await fs.readFile(asset('tex.json')),
    },
    {
      name: 'atlas.png',
      mimeType: 'image/png',
      buffer: await fs.readFile(asset('tex.png')),
    },
  ]);
  await expect
    .poll(async () => (await state(page)).sampleSource.files[0])
    .toBe('changed_ske.json');
  expect((await state(page)).freshLoongBonesExportVerified).toBe(false);
  await page.click('#editor-export');
  await expect
    .poll(async () => (await state(page)).freshLoongBonesExportVerified)
    .toBe(true);
});
