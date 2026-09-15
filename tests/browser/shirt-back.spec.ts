import { test, expect } from 'playwright/test';

type ClothExport = {
  armature: {
    bone: { name: string }[];
    skin: {
      slot: { name: string; display: { uvs: number[]; weights: number[] }[] }[];
    }[];
  }[];
};

for (const character of ['dan', 'doug'])
  test(`${character}: torso fabric stays on the rib cage while the sleeve swings`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
    const ownership = await page.evaluate(async () => {
      const state = window.__HERO_WEIGHTED_RIG__.getState();
      if (!state.ready) throw Error('Rig not ready');
      const data = (await (
        await fetch(state.rig.skeleton)
      ).json()) as ClothExport;
      const rig = data.armature[0];
      const invalid: string[] = [];
      let checked = 0;
      for (const slot of rig.skin[0].slot) {
        if (!['body', 'shirt_back'].includes(slot.name)) continue;
        const mesh = slot.display[0];
        let cursor = 0;
        for (let vertex = 0; vertex < mesh.uvs.length / 2; vertex++) {
          const count = mesh.weights[cursor++];
          const x = mesh.uvs[vertex * 2] * 1254;
          const y = mesh.uvs[vertex * 2 + 1] * 1254;
          const back =
            slot.name === 'shirt_back' || (x < 545 && y > 402 && y < 600);
          if (back) checked++;
          for (let i = 0; i < count; i++) {
            const bone = rig.bone[mesh.weights[cursor++]].name;
            const weight = mesh.weights[cursor++];
            if (
              back &&
              weight > 0 &&
              !['chest', 'spine_mid', 'pelvis'].includes(bone)
            )
              invalid.push(`${slot.name}:${vertex}:${bone}`);
          }
        }
      }
      return { invalid, checked };
    });
    expect(ownership.checked).toBeGreaterThan(100);
    expect(ownership.invalid).toEqual([]);
    const metrics = [];
    for (const style of ['flat', 'slide', 'blocker', 'roll', 'airmail']) {
      const clip = `cornhole_throw_${style}_R_${character}`;
      for (const phase of [
        'rest',
        'backswing',
        'release',
        'follow',
        'recovery',
      ]) {
        const probes = await page.evaluate(
          ({ clip, phase }) => {
            const api = window.__HERO_WEIGHTED_RIG__;
            api.reset(clip);
            api.view({ silhouette: true });
            const initial = api.getState();
            if (!initial.ready) throw Error('Rig not ready');
            const marker = initial.rig.releaseMarker;
            api.step(
              phase === 'rest'
                ? 0
                : phase === 'backswing'
                  ? 0.45
                  : phase === 'release'
                    ? marker
                    : phase === 'follow'
                      ? marker + 0.25
                      : 1.8,
            );
            const state = api.getState();
            if (!state.ready) throw Error('Rig not ready');
            const chest = state.pose.bones.find((b) => b.name === 'chest')!;
            const neck = state.pose.bones.find((b) => b.name === 'neck')!;
            // Independent rib-cage reference: source chest (520,390), neck
            // (493,244). Never derive the expected back from the arm or the
            // deformed cloth itself, which would let a collapsing shirt pass.
            const sx = -27,
              sy = -146,
              denominator = sx * sx + sy * sy;
            const dx = neck.x - chest.x,
              dy = neck.y - chest.y;
            const a = (dx * sx + dy * sy) / denominator;
            const b = (dy * sx - dx * sy) / denominator;
            return [
              [414, 340],
              [415, 365],
              [419, 397],
              [429, 425],
              [442, 452],
              [442, 478],
            ].map(([x, y]) => ({
              x:
                state.root.x +
                (chest.x + a * (x - 520) - b * (y - 390)) * state.root.scaleX,
              y:
                state.root.y +
                (chest.y + b * (x - 520) + a * (y - 390)) * state.root.scaleY,
            }));
          },
          { clip, phase },
        );
        const png = await page.locator('#stage canvas').screenshot();
        const coverage = await page.evaluate(
          async ({ png, probes }) => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + png;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            const scale = image.width / 1280;
            return probes.map((p) => {
              let ink = 0;
              for (const dx of [-1, 0, 1])
                for (const dy of [-1, 0, 1]) {
                  const [r, g, b] = ctx.getImageData(
                    Math.round((p.x + dx) * scale),
                    Math.round((p.y + dy) * scale),
                    1,
                    1,
                  ).data;
                  if (Math.max(r, g, b) < 45) ink++;
                }
              return ink / 9;
            });
          },
          { png: png.toString('base64'), probes },
        );
        metrics.push({ style, phase, coverage });
        if (phase === 'follow' || coverage.some((c) => c < 8 / 9))
          await info.attach(`${style}-${phase}-back`, {
            body: png,
            contentType: 'image/png',
          });
        for (const [i, filled] of coverage.entries())
          expect(
            filled,
            `${style}/${phase}: missing rib-cage fabric at probe ${i}`,
          ).toBeGreaterThanOrEqual(8 / 9);
      }
    }
    await info.attach('torso-volume', {
      body: JSON.stringify({ ownership, metrics }, null, 2),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
