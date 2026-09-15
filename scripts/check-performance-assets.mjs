import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const out = 'work/qa/performance-upgrade/verification';
const base = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [],
  imports = [],
  contacts = [],
  silhouettes = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  for (const actor of ['doug', 'dan']) {
    await page.goto(`${base}/loongbones/`);
    await page.waitForFunction(
      () => window.__HERO_LOONGBONES_PROOF__?.getState().ready,
    );
    await page
      .locator('#export-files')
      .setInputFiles(
        ['ske.json', 'tex.json', 'tex.png'].map((s) =>
          path.resolve(
            `lab/human-motion/assets/performance-v2/${actor}/${actor}_${s}`,
          ),
        ),
      );
    await page.waitForFunction(
      () =>
        window.__HERO_LOONGBONES_PROOF__?.getState().sampleSource?.kind ===
        'local-import',
    );
    const imported = await page.evaluate(() => {
      const api = window.__HERO_LOONGBONES_PROOF__;
      api.clip('v2_shoot', 'sample', 0);
      api.step(0.9);
      const s = api.getState();
      return {
        source: s.sampleSource,
        runtime: s.runtime,
        animations: s.sample.animations,
        meshes: s.sample.meshes.length,
        finite: s.sample.meshes.every((m) =>
          m.vertices.every((v) => v.every(Number.isFinite)),
        ),
        editorVerified: s.freshLoongBonesExportVerified,
      };
    });
    assert(imported.finite);
    assert.equal(imported.editorVerified, false);
    imports.push({ actor, ...imported });

    for (const event of ['cornhole', 'running', 'basketball', 'fighting']) {
      const take =
        event === 'running'
          ? 'run-stop'
          : event === 'fighting'
            ? 'combat-hit'
            : 'primaryAction';
      await page.goto(
        `${base}/human-motion/?event=${event}&actor=${actor}&take=${take}&neutral=1`,
      );
      await page.waitForFunction(
        () => window.__HERO_MOTION__?.getState().actors,
      );
      const measured = await page.evaluate(
        ({ actor, event }) => {
          const api = window.__HERO_MOTION__,
            initial = api.soles(actor),
            planted = new Map();
          let fixedDrift = 0,
            supportDrift = 0,
            samples = 0,
            lengthError = 0,
            maxSupportAnkleError = 0;
          const frames = [];
          for (let f = 0; f < 360; f++) {
            api.step(1 / 120);
            const s = api.getState(),
              a = s.actors.find((a) => a.id === actor),
              vertices = api.soles(actor);
            if (!vertices.length) throw Error('No rendered sole vertices');
            lengthError = Math.max(
              lengthError,
              ...Object.values(a.motion.limbLengthError),
            );
            if (event === 'cornhole')
              vertices.forEach(
                (v, j) =>
                  (fixedDrift = Math.max(
                    fixedDrift,
                    Math.hypot(v.x - initial[j].x, v.y - initial[j].y),
                  )),
              );
            for (const [side, c] of Object.entries(a.rig.supportContacts)) {
              const lock = a.rig.feet.find((l) => l.foot === side);
              if (!lock || lock.duration < 0.09 || lock.influence < 0.999)
                continue;
              const ankle = a.motion.latest.joints[side + 'Ankle'];
              maxSupportAnkleError = Math.max(
                maxSupportAnkleError,
                Math.hypot(ankle.x - c.ankle.x, ankle.y - c.ankle.y),
              );
              // Track actual material near the selected support region. This is separate
              // from ankle IK error and includes imperfect anatomical-to-sole registration.
              const pivot = {
                x: c.anchor.x + c.pivot.x,
                y: c.anchor.y + c.pivot.y,
              };
              const key =
                side +
                ':' +
                lock.point.x.toFixed(2) +
                ':' +
                lock.point.y.toFixed(2) +
                ':' +
                c.region;
              let record = planted.get(key);
              if (!record) {
                const chosen = vertices
                  .filter((v) => v.foot === side)
                  .sort(
                    (a, b) =>
                      Math.hypot(a.x - pivot.x, a.y - pivot.y) -
                      Math.hypot(b.x - pivot.x, b.y - pivot.y),
                  )
                  .slice(0, 3);
                if (!chosen.length) throw Error('No material for ' + side);
                record = { points: chosen };
                planted.set(key, record);
              }
              for (const first of record.points) {
                const now = vertices.find((v) => v.index === first.index);
                supportDrift = Math.max(
                  supportDrift,
                  Math.hypot(now.x - first.x, now.y - first.y),
                );
                samples++;
              }
            }
            if (f % 30 === 0)
              frames.push({
                time: s.time,
                contacts: a.rig.supportContacts,
                feet: a.rig.feet,
              });
          }
          return {
            event,
            actor,
            soleVertices: initial.length,
            fixedDrift,
            supportDrift,
            samples,
            lengthError,
            maxSupportAnkleError,
            frames,
          };
        },
        { actor, event },
      );
      contacts.push(measured);
      assert(measured.soleVertices > 0);
      assert(measured.lengthError < 0.1);
      assert(
        measured.supportDrift < 2,
        `${actor} ${event}: support material exceeds 2 world pixels`,
      );
      if (event === 'cornhole') assert(measured.fixedDrift < 2);
      console.log(JSON.stringify({ ...measured, frames: undefined }));
      // Three meaningful phases, rendered by the real native mesh bridge.
      const times =
        event === 'running'
          ? [0.72, 1.12, 1.65]
          : event === 'fighting'
            ? [1.2, 1.8, 2.4]
            : [0.78, 1.16, 1.7];
      for (const time of times) {
        await page.goto(
          `${base}/human-motion/?event=${event}&actor=${actor}&take=${take}&neutral=1&seek=${time}`,
        );
        await page.waitForFunction(
          () => window.__HERO_MOTION__?.getState().actors,
        );
        await page.evaluate(
          (actor) =>
            window.__HERO_MOTION__.view({
              focus: actor,
              silhouette: true,
              skeleton: false,
              trails: false,
            }),
          actor,
        );
        const file = `${actor}-${event}-${time}.png`;
        await page.locator('canvas').screenshot({ path: `${out}/${file}` });
        silhouettes.push({ actor, event, time, file });
      }
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await fs.writeFile(
    `${out}/report.json`,
    JSON.stringify(
      {
        imports,
        contacts,
        silhouettes,
        errors,
        units:
          'world pixels; actual mesh material samples around each registered support pivot, separate from evaluated ankle error',
        editorRoundTripVerified: false,
        productionInstalled: false,
      },
      null,
      2,
    ),
  );
}
