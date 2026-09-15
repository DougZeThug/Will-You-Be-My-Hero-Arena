import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';
import fs from 'node:fs/promises';
const b = await chromium.launch({ ...browserLaunchOptions(), headless: true });
try {
  const p = await b.newPage();
  for (const q of ['&take=run-stop&actor=doug', '']) {
    await p.goto('http://127.0.0.1:3010/human-motion/?event=running' + q);
    await p.waitForFunction(() => window.__HERO_MOTION__?.getState().actors);
    const r = await p.evaluate(() => {
      const api = window.__HERO_MOTION__;
      const bad = [];
      let max = 0;
      for (let i = 0; i < 540; i++) {
        api.step(1 / 120);
        const s = api.getState();
        for (const a of s.actors)
          for (const f of a.rig.feet)
            if (f.maxSlide > max) {
              max = f.maxSlide;
              if (max > 0.5)
                bad.push({
                  time: s.time,
                  id: a.id,
                  foot: f,
                  root: a.motor,
                  phase: a.phase,
                  graph: a.graph,
                  lowering: a.rig.supportLowering,
                  joints: a.motion.latest.joints,
                });
            }
      }
      return { max, bad };
    });
    await fs.writeFile(
      'work/qa/v3-drift' + (q ? 'doug' : 'ai') + '.json',
      JSON.stringify(r, null, 2),
    );
    console.log(q, r.max, r.bad.slice(-1));
  }
} finally {
  await b.close();
}
