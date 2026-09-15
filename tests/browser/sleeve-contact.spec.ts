import { test, expect } from 'playwright/test';
type ExportMesh = { triangles: number[]; uvs: number[] };
type RigExport = {
  armature: { skin: { slot: { name: string; display: ExportMesh[] }[] }[] }[];
};

for (const character of ['dan', 'doug'])
  test(`${character}: rendered skin reaches the sleeve cuff throughout every throw style`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/loongbones/doug/?character=${character}`);
    await page.waitForFunction(
      () => window.__HERO_WEIGHTED_RIG__?.getState().ready,
    );
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
        const sample = await page.evaluate(
          async ({ clip, phase, character }) => {
            const api = window.__HERO_WEIGHTED_RIG__;
            api.reset(clip);
            const initial = api.getState();
            if (!initial.ready) throw Error('Rig not ready');
            const marker = initial.rig.releaseMarker;
            const time =
              phase === 'rest'
                ? 0
                : phase === 'backswing'
                  ? 0.45
                  : phase === 'release'
                    ? marker
                    : phase === 'follow'
                      ? marker + 0.25
                      : 1.8;
            api.step(time);
            const state = api.getState();
            if (!state.ready) throw Error('Rig not ready');
            const exported = (await (
              await fetch(state.rig.skeleton)
            ).json()) as RigExport;
            const display = exported.armature[0].skin[0].slot.find(
              (s) => s.name === 'sleeve_back',
            )!.display[0];
            const body = state.pose.meshes.find(
              (m) => m.name === 'sleeve_back',
            )!;
            // Registered lower cuff, just inside the original printed hem. The
            // back and front sleeve share these UVs and deformation weights.
            const source = character === 'dan' ? [435, 389.5] : [441, 395];
            const locate = (source: number[]) => {
              let point: number[] | undefined;
              for (let i = 0; i < display.triangles.length; i += 3) {
                const ids = display.triangles.slice(i, i + 3),
                  uv = ids.map((j: number) => [
                    display.uvs[j * 2] * 1254,
                    display.uvs[j * 2 + 1] * 1254,
                  ]);
                const [a, b, c] = uv;
                const det =
                  (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
                const u =
                  ((b[1] - c[1]) * (source[0] - c[0]) +
                    (c[0] - b[0]) * (source[1] - c[1])) /
                  det;
                const v =
                  ((c[1] - a[1]) * (source[0] - c[0]) +
                    (a[0] - c[0]) * (source[1] - c[1])) /
                  det;
                if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
                point = [0, 1].map((axis) =>
                  ids.reduce(
                    (sum: number, j: number, k: number) =>
                      sum + body.vertices[j][axis] * [u, v, 1 - u - v][k],
                    0,
                  ),
                );
                break;
              }
              if (!point) throw Error('Cuff outside registered mesh');
              return point;
            };
            const point = locate(source);
            // Probe INSIDE the opening too. A fully painted empty cuff can
            // touch skin at its lower edge while still looking disconnected.
            const interior = (
              character === 'dan'
                ? [
                    [413, 372],
                    [425, 372],
                    [438, 373],
                    [450, 376],
                  ]
                : [
                    [413, 379],
                    [426, 383],
                    [439, 387],
                    [450, 391],
                  ]
            ).map((p) => {
              const q = locate(p);
              return {
                x: state.root.x + q[0] * state.root.scaleX,
                y: state.root.y + q[1] * state.root.scaleY,
              };
            });
            const elbow = state.pose.bones.find((b) => b.name === 'forearm_L')!;
            const length = Math.hypot(elbow.x - point[0], elbow.y - point[1]);
            return {
              time,
              interior,
              point: {
                x: state.root.x + point[0] * state.root.scaleX,
                y: state.root.y + point[1] * state.root.scaleY,
              },
              direction: {
                x: (elbow.x - point[0]) / length,
                y: (elbow.y - point[1]) / length,
              },
            };
          },
          { clip, phase, character },
        );
        const png = await page.locator('#stage canvas').screenshot();
        const { gap, interiorCoverage } = await page.evaluate(
          async ({ png, sample }) => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + png;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            const scale = image.width / 1280;
            const isSkin = (x: number, y: number) => {
              const [r, g, b] = ctx.getImageData(
                Math.round(x * scale),
                Math.round(y * scale),
                1,
                1,
              ).data;
              return r > g * 1.18 && g > b * 1.15 && g > 65;
            };
            const interiorCoverage = sample.interior.map((p) => {
              let skin = 0;
              for (const x of [-1, 0, 1])
                for (const y of [-1, 0, 1])
                  if (isSkin(p.x + x, p.y + y)) skin++;
              return skin / 9;
            });
            for (let offset = 1; offset <= 14; offset++) {
              let skin = 0;
              for (const side of [-1, 0, 1]) {
                const x =
                  (sample.point.x +
                    sample.direction.x * offset -
                    sample.direction.y * side) *
                  scale;
                const y =
                  (sample.point.y +
                    sample.direction.y * offset +
                    sample.direction.x * side) *
                  scale;
                const [r, g, b] = ctx.getImageData(
                  Math.round(x),
                  Math.round(y),
                  1,
                  1,
                ).data;
                if (r > g * 1.18 && g > b * 1.15 && g > 65) skin++;
              }
              if (skin >= 2) return { gap: offset, interiorCoverage };
            }
            return { gap: 15, interiorCoverage };
          },
          { png: png.toString('base64'), sample },
        );
        metrics.push({ clip, phase, time: sample.time, gap, interiorCoverage });
        if (style === 'flat' || gap > 3 || Math.min(...interiorCoverage) < 0.66)
          await info.attach(`${style}-${phase}`, {
            body: png,
            contentType: 'image/png',
          });
        expect(
          gap,
          `${clip} ${phase}: shirt/background strip between cuff and skin`,
        ).toBeLessThanOrEqual(3);
        for (const [i, coverage] of interiorCoverage.entries())
          expect(
            coverage,
            `${clip} ${phase}: sleeve opening probe ${i} must contain upper-arm skin`,
          ).toBeGreaterThanOrEqual(2 / 3);
      }
    }
    await info.attach('rendered-cuff-contact', {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
  });
