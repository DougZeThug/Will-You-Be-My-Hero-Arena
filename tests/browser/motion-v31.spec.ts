import { test, expect } from 'playwright/test';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { referenceCatalog } from '../../lab/human-motion/ReferenceCatalog';

for (const id of ['dan', 'doug'])
  test(`V3.1 ${id} reverses direction with planted opposite-view feet`, async ({
    page,
  }, info) => {
    await page.goto(`/human-motion/?event=running&actor=${id}&take=run-stop`);
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const result = await page.evaluate((id) => {
      const api = window.__HERO_MOTION__;
      api.input(id, 'move', { x: 1, y: 0 });
      api.step(0.9);
      const start = api.getState().actors.find((a) => a.id === id)!.motor
        .position.x;
      api.input(id, 'move', { x: -1, y: 0 });
      const planted = new Map<
        string,
        {
          duration: number;
          points: ReturnType<typeof api.soles>;
          ankle: { x: number; y: number };
          angle: number;
        }
      >();
      let slide = 0,
        samples = 0;
      for (let i = 0; i < 150; i++) {
        api.step(1 / 120);
        const a = api.getState().actors.find((a) => a.id === id)!;
        for (const f of a.rig.feet) {
          if (f.influence < 0.999 || f.duration < 0.09) {
            planted.delete(f.foot);
            continue;
          }
          const points = api.soles(id).filter((p) => p.foot === f.foot),
            before = planted.get(f.foot);
          const contact = a.rig.supportContacts[f.foot];
          if (!contact) throw Error('Planted foot has no support transform');
          if (before && f.duration >= before.duration) {
            for (const p of points) {
              const q = before.points.find((q) => q.index === p.index);
              if (q) {
                // Mirrored toe-off uses the same contact frame, not a frozen heel.
                const angle = contact.angle - before.angle,
                  c = Math.cos(angle),
                  s = Math.sin(angle);
                const dx = q.x - before.ankle.x,
                  dy = q.y - before.ankle.y;
                const expected = {
                  x: contact.ankle.x + c * dx - s * dy,
                  y: contact.ankle.y + s * dx + c * dy,
                };
                slide = Math.max(
                  slide,
                  Math.hypot(p.x - expected.x, p.y - expected.y),
                );
                samples++;
              }
            }
            before.duration = f.duration;
          } else
            planted.set(f.foot, {
              duration: f.duration,
              points,
              ankle: contact.ankle,
              angle: contact.angle,
            });
        }
      }
      const actor = api.getState().actors.find((a) => a.id === id)!;
      return { start, actor, slide, samples };
    }, id);
    expect(result.actor.motor.position.x).toBeLessThan(result.start);
    expect(result.actor.rig.direction.facing).toBe(-1);
    expect(result.actor.rig.direction.skin).toBe('authored-rear-three-quarter');
    expect(result.samples).toBeGreaterThan(50);
    expect(result.slide).toBeLessThan(2);
    expect(result.actor.rig.integrity.warnings).toEqual([]);
    await fs.writeFile(
      info.outputPath('opposite-gait.json'),
      JSON.stringify(result),
    );
    await page
      .locator('canvas')
      .screenshot({ path: info.outputPath('opposite-view.png') });
  });

for (const event of ['cornhole', 'running', 'basketball', 'fighting'])
  test(`V3.1 Doug limb volume stays stable in ${event}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
      `/human-motion/?event=${event}&actor=doug&take=${event === 'running' ? 'run-stop' : 'primaryAction'}`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const result = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 360; i++) {
        window.__HERO_MOTION__.step(1 / 120);
        const a = window.__HERO_MOTION__
          .getState()
          .actors.find((a) => a.id === 'doug')!;
        if (i % 4 === 0) samples.push({ time: i / 120, rig: a.rig.integrity });
      }
      return samples;
    });
    expect(errors).toEqual([]);
    for (const s of result) {
      expect(s.rig.warnings).toEqual([]);
      expect(s.rig.limbs).toHaveLength(8);
      for (const l of s.rig.limbs) {
        expect(Math.abs(l.length / l.setupLength - 1)).toBeLessThan(0.012);
        expect(l.scaleX).toBeCloseTo(1, 3);
        expect(l.scaleY).toBeCloseTo(1, 3);
      }
    }
    await fs.writeFile(
      info.outputPath('integrity.json'),
      JSON.stringify(result),
    );
    await page.locator('#review-character').selectOption('doug');
    await page.locator('#mesh-weights').check();
    await page.locator('#mesh-outlines').check();
    await page
      .locator('canvas')
      .screenshot({ path: info.outputPath('rig.png') });
  });

for (const take of ['chestTap', 'bagFlip', 'fistPump'])
  test(`V3.1 isolated ${take} exposes real semantic events`, async ({
    page,
  }, info) => {
    await page.goto(
      `/human-motion/?event=cornhole&actor=doug&take=${take}&focus=doug`,
    );
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const s = await page.evaluate(() => {
      window.__HERO_MOTION__.step(2.5);
      return window.__HERO_MOTION__.getState();
    });
    expect(s.actors.find((a) => a.id === 'doug')!.rig.starts).toBeGreaterThan(
      1,
    );
    const events = s.actors
      .find((a) => a.id === 'doug')!
      .rig.nativeEvents.map((e) => e.name);
    if (take === 'chestTap')
      expect(events).toEqual(
        expect.arrayContaining([
          'chestTapContact',
          'chestTapContact2',
          'chestTapRelease',
        ]),
      );
    if (take === 'bagFlip')
      expect(events).toEqual(expect.arrayContaining(['propToss', 'propCatch']));
    await fs.writeFile(info.outputPath('state.json'), JSON.stringify(s));
  });

for (const [event, reference] of [
  ['running', 'running'],
  ['basketball', 'basketball'],
  ['fighting', 'jab'],
])
  test(`V3.1 ${event} opens its own measured reference`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/human-motion/?event=${event}&seek=.8`);
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    await page.locator('#reference-comparison summary').click();
    await expect(page.locator('#reference-choice')).toHaveValue(reference);
    // The measured frames are committed JSON and load without the review video.
    await page.locator('#demo-reference').click();
    await expect(page.locator('#reference-status')).toContainText(
      'measured frames loaded',
    );
    expect(errors).toEqual([]);
    await page
      .locator('#reference-comparison')
      .screenshot({ path: info.outputPath('reference.png') });
  });

// Source-time synchronization needs the actual review video. Only cornhole's is
// committed; the others are local development files under ignored work/qa, and
// Playwright's bundled Chromium cannot decode their H.264 stream at all. The
// attribute is written from the real video clock, so it is never fabricated:
// without a decodable local video this leg reports a skip, not a pass.
for (const [event, reference, seek] of [
  ['cornhole', 'cornhole', '1.11'],
  ['running', 'running', '.8'],
  ['basketball', 'basketball', '.8'],
  ['fighting', 'jab', '.8'],
] as const)
  test(`V3.1 ${event} synchronizes its local review video`, async ({
    page,
  }) => {
    const entry = referenceCatalog.find((r) => r.id === reference)!;
    const video = fileURLToPath(entry.video);
    test.skip(
      !existsSync(video),
      `Local review video absent (${path.relative(process.cwd(), video)}); prepare it under work/qa/v31-reference/review before running this comparison.`,
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/human-motion/?event=${event}&seek=${seek}`);
    await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    test.skip(
      !(await page.evaluate(() =>
        document
          .createElement('video')
          .canPlayType('video/mp4; codecs="avc1.42E01E"'),
      )),
      'This browser build lacks H.264 decoding; run with the system Chrome (ARENA_BROWSER_EXECUTABLE) for the video comparison.',
    );
    await page.locator('#reference-comparison summary').click();
    await expect(page.locator('#reference-choice')).toHaveValue(reference);
    await expect
      .poll(() =>
        page.locator('#reference-comparison').getAttribute('data-source-time'),
      )
      .not.toBeNull();
    await expect(page.locator('#comparison-status')).not.toContainText(
      'unavailable',
    );
    expect(errors).toEqual([]);
  });

test('V3.1 opposite clothing preserves source alpha, face and limb pixels', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    let engine: unknown;
    Object.defineProperty(window, 'Phaser', {
      configurable: true,
      get: () => engine,
      set(value) {
        engine = value;
        const boot = value.Game.prototype.boot;
        value.Game.prototype.boot = function (...args: unknown[]) {
          (window as unknown as Record<string, unknown>).__auditGame = this;
          return boot.apply(this, args);
        };
      },
    });
  });
  await page.goto('/human-motion/?event=fighting');
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const results = await page.evaluate(() => {
    const game = (
      window as unknown as { __auditGame: { scene: { scenes: any[] } } }
    ).__auditGame;
    const scene = game.scene.scenes[0];
    return scene.session.actors.map((a: any) => {
      const original = scene.textures
        .get(a.animator.definition.key + '-texture')
        .getSourceImage();
      const rear = scene.textures
        .get(a.animator.directional.leftKey)
        .getSourceImage();
      const pixels = (image: CanvasImageSource) => {
        const c = document.createElement('canvas');
        c.width = 1254;
        c.height = 1254;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, 1254, 1254).data;
      };
      const before = pixels(original),
        after = pixels(rear);
      let alpha = 0,
        protectedChanges = 0,
        magenta = 0;
      for (let y = 0; y < 1254; y++)
        for (let x = 0; x < 1254; x++) {
          const i = (y * 1254 + x) * 4;
          alpha = Math.max(alpha, Math.abs(after[i + 3] - before[i + 3]));
          // Outside the garment rectangle: all face, detached hands/arms and feet.
          if (x < 370 || x > 600 || y < 170 || y > 630)
            if (
              before[i + 3] > 250 &&
              [0, 1, 2].some((k) => Math.abs(before[i + k] - after[i + k]) > 1)
            )
              protectedChanges++;
          if (
            after[i + 3] > 250 &&
            after[i] > 180 &&
            after[i + 2] > 170 &&
            after[i + 1] < 90 &&
            !(before[i] > 180 && before[i + 2] > 170 && before[i + 1] < 90)
          )
            magenta++;
        }
      return { id: a.id, alpha, protectedChanges, magenta };
    });
  });
  for (const r of results) {
    expect(r.alpha).toBeLessThanOrEqual(1);
    expect(r.protectedChanges).toBe(0);
    expect(r.magenta).toBe(0);
  }
  await fs.writeFile(
    info.outputPath('protected-pixels.json'),
    JSON.stringify(results),
  );
});
