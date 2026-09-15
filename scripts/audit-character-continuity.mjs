import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const out =
  process.argv.find((a) => a.startsWith('--output='))?.slice(9) ??
  'work/qa/animation-continuity';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...browserLaunchOptions(),
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3010/?scenario=cornhole-recorded');
  await page.waitForFunction(() => window.__HERO_ARENA__?.ready);
  const result = await page.evaluate(async () => {
    const api = window.__HERO_ARENA__;
    await api.seekCheckpoint('anticipation');
    let previous = api.getState();
    const transitions = [],
      samples = [];
    while (previous.time < previous.event.duration) {
      await api.step(1);
      const s = api.getState();
      for (let actor = 0; actor < s.characters.length; actor++) {
        const p = previous.characters[actor],
          q = s.characters[actor];
        const delta = Object.fromEntries(
          ['throwingHand', 'head', 'waist'].map((name) => [
            name,
            Math.hypot(
              q.sockets[name].x - p.sockets[name].x,
              q.sockets[name].y - p.sockets[name].y,
            ),
          ]),
        );
        const row = {
          time: s.time,
          actor,
          phase: s.event.phase,
          from: p.rigDetails.requestedClip,
          to: q.rigDetails.requestedClip,
          blend: q.rigDetails.blend,
          delta,
        };
        samples.push(row);
        if (row.from !== row.to) transitions.push(row);
      }
      if (s.time === previous.time && s.time < s.event.duration)
        throw Error('Manual clock stopped before the sequence finished');
      previous = s;
    }
    return {
      scenario: previous.scenario,
      hash: previous.event.recordingHash,
      finalScores: previous.event.finalScores,
      errors: previous.errors,
      transitions,
      largestSteps: samples
        .sort((a, b) => b.delta.throwingHand - a.delta.throwingHand)
        .slice(0, 12),
    };
  });
  await fs.writeFile(`${out}/continuity.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        errors: result.errors,
        transitions: result.transitions.length,
        largestTransitionHandStep: Math.max(
          ...result.transitions.map((t) => t.delta.throwingHand),
        ),
        largestTransitionHeadStep: Math.max(
          ...result.transitions.map((t) => t.delta.head),
        ),
        largestSteps: result.largestSteps.slice(0, 3),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
