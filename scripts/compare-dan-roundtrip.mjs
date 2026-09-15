import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const directory = 'work/qa/dan-roundtrip';
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const checks = [
  ['neutral', 0],
  ['idle_breathe', 4],
  ['weight_shift', 1.4],
  ['arm_check', 0.8],
  ['throw_low', 0.52],
  ['throw_low', 43 / 60],
  ['throw_low', 1.05],
  ['throw_low', 2.6],
  ['quiet_nod', 0.35],
];
const states = {},
  report = {};
try {
  for (const sample of ['authored', 'editor', 'restored']) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
      `${process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010'}/loongbones/dan/?sample=${sample}`,
    );
    await page.waitForFunction(() => window.__HERO_DAN_RIG__?.getState().ready);
    states[sample] = [];
    for (const [clip, time] of checks) {
      const state = await page.evaluate(
        ([clip, time]) => {
          const a = window.__HERO_DAN_RIG__;
          a.reset(clip);
          a.step(time);
          return a.getState();
        },
        [clip, time],
      );
      states[sample].push(state);
      if (
        clip === 'neutral' ||
        clip === 'weight_shift' ||
        (clip === 'throw_low' && time === 43 / 60)
      )
        await page
          .locator('#stage canvas')
          .screenshot({ path: `${directory}/${sample}-${clip}.png` });
    }
    if (sample === 'restored') {
      for (const [name, view] of [
        ['silhouette', { silhouette: true, overlay: true }],
        ['mirror', { mirrored: true }],
        [
          'court',
          { silhouette: false, overlay: false, mirrored: false, court: true },
        ],
      ]) {
        await page.evaluate((view) => {
          const a = window.__HERO_DAN_RIG__;
          a.reset('neutral');
          a.view(view);
        }, view);
        await page
          .locator('#stage canvas')
          .screenshot({ path: `${directory}/${name}.png` });
      }
    }
    report[sample] = {
      errors,
      states: states[sample].map(({ meshes, bones, ...s }) => s),
    };
    await page.close();
  }
  report.differences = {};
  for (const sample of ['editor', 'restored'])
    report.differences[sample] = states[sample].map((s, i) => {
      const ref = states.authored[i];
      let vertexError = 0,
        boneError = 0;
      for (const bone of s.bones) {
        const old = ref.bones.find((b) => b.name === bone.name);
        boneError = Math.max(
          boneError,
          Math.hypot(bone.x - old.x, bone.y - old.y),
        );
      }
      s.meshes[0].vertices.forEach((v, j) => {
        const old = ref.meshes[0].vertices[j];
        vertexError = Math.max(
          vertexError,
          Math.hypot(v[0] - old[0], v[1] - old[1]),
        );
      });
      return {
        clip: checks[i][0],
        seconds: checks[i][1],
        maxBoneScreenPx: boneError,
        maxVertexSourcePx: vertexError,
        release: s.release,
      };
    });
  await fs.writeFile(
    `${directory}/comparison.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        differences: report.differences,
        errors: Object.fromEntries(
          ['authored', 'editor', 'restored'].map((k) => [k, report[k].errors]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
