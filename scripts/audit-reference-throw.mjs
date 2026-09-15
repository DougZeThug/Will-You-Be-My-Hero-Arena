import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
const argument = (name, fallback) =>
  process.argv
    .find((v) => v.startsWith('--' + name + '='))
    ?.slice(name.length + 3) ?? fallback;
const out = argument('out', 'work/qa/reference-throw/before');
const actor = argument('actor', 'dan');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:3010/human-motion/?event=cornhole&actor=${actor}&take=${argument('take', 'primaryAction')}`,
  );
  await page.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
  const samples = await page.evaluate((id) => {
    const result = [],
      api = window.__HERO_MOTION__;
    for (let i = 0; i < 600; i++) {
      api.step(1 / 120);
      const s = api.getState(),
        a = s.actors.find((a) => a.id === id);
      result.push({ time: s.time, actor: a, projectiles: s.event.projectiles });
    }
    return result;
  }, actor);
  const active = samples.filter((s) =>
    s.actor.graph.some((g) => g.id.startsWith('throw.')),
  );
  const span = (values) => ({
    min: Math.min(...values),
    max: Math.max(...values),
    range: Math.max(...values) - Math.min(...values),
  });
  const positions = {};
  for (const key of Object.keys(active[0].actor.motion.latest.joints)) {
    positions[key] = {
      x: span(active.map((s) => s.actor.motion.latest.joints[key].x)),
      y: span(active.map((s) => s.actor.motion.latest.joints[key].y)),
    };
  }
  const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const turn = (x) => (Math.atan2(Math.sin(x), Math.cos(x)) * 180) / Math.PI;
  const bends = {};
  for (const [name, a, b, c] of [
    ['elbow', 'rightShoulder', 'rightElbow', 'rightWrist'],
    ['leftElbow', 'leftShoulder', 'leftElbow', 'leftWrist'],
    ['rightKnee', 'rightHip', 'rightKnee', 'rightAnkle'],
    ['leftKnee', 'leftHip', 'leftKnee', 'leftAnkle'],
  ])
    bends[name] = span(
      active.map((s) => {
        const j = s.actor.motion.latest.joints;
        return turn(angle(j[b], j[c]) - angle(j[a], j[b]));
      }),
    );
  const release = samples.find((s) => s.actor.releaseCount === 1);
  const body = {
    pelvisPitch: span(
      active.map((s) => {
        const j = s.actor.motion.latest.joints;
        return turn(angle(j.leftHip, j.rightHip));
      }),
    ),
    chestPitch: span(
      active.map((s) => {
        const j = s.actor.motion.latest.joints;
        return turn(angle(j.pelvis, j.chest) + Math.PI / 2);
      }),
    ),
    headPitch: span(
      active.map((s) => {
        const j = s.actor.motion.latest.joints;
        return turn(angle(j.neck, j.head) + Math.PI / 2);
      }),
    ),
  };
  const p = release?.projectiles.find((p) => p.owner === actor);
  const report = {
    actor,
    errors,
    positions,
    bends,
    body,
    release: p && {
      at: release.time,
      position: p.release,
      gravity: p.gravity,
      target: p.target,
      air: p.air,
    },
    maxFootDrift: Math.max(
      0,
      ...active.flatMap((s) => s.actor.rig.feet.map((f) => f.maxSlide)),
    ),
    final: samples.at(-1).actor,
  };
  await fs.writeFile(
    out + '/' + actor + '-samples.json',
    JSON.stringify(samples),
  );
  await fs.writeFile(
    out + '/' + actor + '-audit.json',
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        actor,
        root: positions.root,
        pelvis: positions.pelvis,
        shoulder: positions.rightShoulder,
        bends,
        body,
        release: report.release,
        maxFootDrift: report.maxFootDrift,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
