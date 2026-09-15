import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const report = [];
try {
  const page = await browser.newPage();
  for (const id of ['dan', 'doug']) {
    await page.goto('http://127.0.0.1:3015/loongbones/');
    await page.waitForFunction(
      () => window.__HERO_LOONGBONES_PROOF__?.getState().ready,
    );
    await page
      .locator('#export-files')
      .setInputFiles(
        ['ske.json', 'tex.json', 'tex.png'].map((s) =>
          path.resolve(`lab/human-motion/assets/upgrade-v1/${id}/${id}_${s}`),
        ),
      );
    await page.waitForFunction(
      () =>
        window.__HERO_LOONGBONES_PROOF__?.getState().sampleSource?.kind ===
        'local-import',
    );
    const result = await page.evaluate(() => {
      const api = window.__HERO_LOONGBONES_PROOF__;
      api.clip('v2_shoot', 'sample', 0);
      api.step(0.9);
      const s = api.getState();
      return {
        source: s.sampleSource,
        runtime: s.runtime,
        meshes: s.sample.meshes.length,
        animations: s.sample.animations,
        finite: s.sample.meshes.every((m) =>
          m.vertices.every((v) => v.every(Number.isFinite)),
        ),
        fresh: s.freshLoongBonesExportVerified,
      };
    });
    assert.equal(result.finite, true);
    assert.equal(result.fresh, false);
    report.push({ id, ...result });
    console.log(JSON.stringify(report.at(-1)));
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  'docs/review/animation-upgrade/import-check.json',
  JSON.stringify(
    {
      passed: true,
      scope:
        'Arena packed-import runtime smoke; editor round trip remains unverified',
      characters: report,
    },
    null,
    2,
  ),
);
