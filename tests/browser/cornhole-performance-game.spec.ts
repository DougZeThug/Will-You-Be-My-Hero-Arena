import { test, expect } from 'playwright/test';
import {
  openScenario,
  snapshot,
  step,
  seekTime,
  checkpoint,
  artifact,
} from './helpers';
import type { CharacterPerformanceController } from '../../lib/arena/engine/performance/CharacterPerformanceController';
import { PERFORMANCE_REVISION } from '../../lab/performance/compile';
type Performance = ReturnType<CharacterPerformanceController['snapshot']>;
test('cornhole performance: waiting attention uses the opponent lane and reconstructs across seeks', async ({
  page,
}) => {
  test.setTimeout(90000);
  await openScenario(page, 'cornhole-performance');
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-performance', {
      seed: 'pass4-opponent:49',
    }),
  );
  const samples = [];
  // Exercise reconstruction across the full 30-second match without asking
  // software WebGL to render 1,800 intermediate frames. The 0.6s cadence is
  // shorter than the authored prepare and flight observation clips.
  for (let i = 1; i <= 50; i++) {
    await seekTime(page, i * 0.6);
    const s = await snapshot(page);
    samples.push({
      time: s.time,
      current: s.event.current,
      hash: s.event.recordingHash,
      characters: s.characters.map((c) => c.rigDetails),
    });
  }
  expect(new Set(samples.map((s) => s.hash)).size).toBe(1);
  expect(
    samples.some((s) =>
      s.characters.some(
        (c) => c.performance.observation?.mode === 'acknowledge',
      ),
    ),
  ).toBe(true);
  expect(
    samples.flatMap((s) => s.characters.flatMap((c) => c.warnings)),
  ).toEqual([]);
  for (let actor = 0; actor < 2; actor++) {
    const waiting = samples.filter(
      (s) => s.time > 2 && s.characters[actor].performance.state === 'idle',
    );
    expect(
      waiting.some(
        (s) => s.characters[actor].performance.observation?.mode === 'prepare',
      ),
    ).toBe(true);
    expect(
      waiting.some(
        (s) => s.characters[actor].performance.observation?.mode === 'flight',
      ),
    ).toBe(true);
    for (const s of samples) {
      const p = s.characters[actor].performance as Performance;
      if (p.observation?.target)
        expect(p.observation.targetActor).toBe(1 - actor);
      expect(p.queue).toEqual([]);
      if (p.observation?.mode === 'acknowledge') {
        const attempt = samples.find(
          (f) => f.current?.id === p.observation?.attemptId,
        )!.current;
        expect(attempt.contact).toBe('hole');
        expect(s.time - p.observation.elapsed).toBeGreaterThan(
          attempt.scoreAt ?? attempt.contactAt,
        );
      }
    }
  }
  await checkpoint(page, 'flight');
  const seek = await snapshot(page);
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-performance', {
      seed: 'pass4-opponent:49',
    }),
  );
  await step(page, Math.floor(seek.time * 60));
  await checkpoint(page, 'flight');
  const continuous = await snapshot(page);
  for (let actor = 0; actor < 2; actor++) {
    const a = seek.characters[actor].rigDetails,
      b = continuous.characters[actor].rigDetails;
    expect(a.performance.observation?.mode).toBe(
      b.performance.observation?.mode,
    );
    for (const key of Object.keys(a.joints))
      expect(
        Math.hypot(
          a.joints[key].x - b.joints[key].x,
          a.joints[key].y - b.joints[key].y,
        ),
        key,
      ).toBeLessThan(0.4);
  }
  await page.evaluate(() => window.__HERO_ARENA__.resume());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__HERO_ARENA__.pause());
  const frozen = await snapshot(page);
  await page.waitForTimeout(200);
  expect((await snapshot(page)).time).toBe(frozen.time);
});
test('cornhole performance: real ArenaScene repeats, seeks and preserves authoritative results', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = await openScenario(page, 'cornhole-performance');
  await expect(page.locator('#arena canvas')).toHaveAttribute(
    'data-character-runtime',
    PERFORMANCE_REVISION,
  );
  const initial = await snapshot(page),
    hash = initial.event.recordingHash;
  await checkpoint(page, 'finish');
  const end = await snapshot(page);
  expect(end.event.scores).toEqual(end.event.finalScores);
  expect(end.event.recordingHash).toBe(hash);
  for (const c of end.characters) {
    expect(c.rig).toBe('loongbones-performance');
    expect(c.rigDetails.runtimeRevision).toBe(PERFORMANCE_REVISION);
    expect(c.rigDetails.warnings).toEqual([]);
    const p = c.rigDetails.performance as Performance;
    expect(p.state).toBe('idle');
  }
  await artifact(page, info, 'complete-match');
  await checkpoint(page, 'pre-release');
  const held = await snapshot(page);
  await checkpoint(page, 'release');
  const launch = await snapshot(page);
  const a = launch.event.current;
  const object = launch.event.projectile.find(
    (p: { id: string }) => p.id === a.id,
  );
  const previous = held.event.projectile.find(
    (p: { id: string }) => p.id === a.id,
  );
  const hand = launch.characters[a.actor].sockets.throwingHand;
  expect(Math.hypot(object.x - hand.x, object.y - hand.y)).toBeLessThan(0.02);
  expect(object.displayWidth).toBeCloseTo(previous.displayWidth, 5);
  expect(object.displayHeight).toBeCloseTo(previous.displayHeight, 5);
  // The held bag follows the evaluated hand during the final 1/120s before
  // release. It may rotate with the wrist, but only as fast as the hand turns
  // (the drive is a fast cartoon snap), never with a visible snap of its own.
  const released = launch.characters[
    a.actor
  ].rigDetails.performance.events.find(
    (e: { name: string }) => e.name === 'OBJECT_RELEASED',
  ).release;
  expect(Math.abs(object.rotation - previous.rotation)).toBeLessThan(
    (Math.abs(released.angularVelocity) / 120) * 1.5 + 0.02,
  );
  expect(
    launch.characters[a.actor].rigDetails.performance.events.filter(
      (e: { name: string }) => e.name === 'OBJECT_RELEASED',
    ),
  ).toHaveLength(1);
  await artifact(page, info, 'hand-release');
  await checkpoint(page, 'finish');
  const beforeBackwardSeek = await snapshot(page);
  expect(beforeBackwardSeek.event.scores).toEqual(end.event.scores);
  const cueCount = beforeBackwardSeek.rendering!.emittedCues.length;
  await checkpoint(page, 'pre-release');
  expect((await snapshot(page)).rendering!.emittedCues).toHaveLength(cueCount);
  await checkpoint(page, 'finish');
  expect((await snapshot(page)).rendering!.emittedCues).toHaveLength(cueCount);
  const resources = [];
  for (let replay = 0; replay < 3; replay++) {
    await checkpoint(page, 'intro');
    await checkpoint(page, 'finish');
    const s = await snapshot(page);
    const counters = s.rendering!.counters;
    resources.push({
      characters: counters.characters,
      cards: counters.cards,
      projectiles: counters.projectiles,
      objects: counters.displayObjects,
      listeners: s.characters.map(
        (c) => c.rigDetails.performance.listenerCount,
      ),
    });
  }
  expect(resources[1]).toEqual(resources[0]);
  expect(resources[2]).toEqual(resources[0]);
  await page.evaluate(() =>
    window.__HERO_ARENA__.loadScenario('cornhole-performance'),
  );
  expect((await snapshot(page)).event.recordingHash).toBe(hash);
  expect(errors).toEqual([]);
});
test('cornhole performance: board bags land short and slide to the target; pushes start on contact; hole bags drop through the drawn hole', async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = await openScenario(page, 'cornhole-performance');
  type Sample = {
    time: number;
    x: number;
    y: number;
    visible: boolean;
    alpha: number;
    touch?: { x: number; y: number };
    others: { id: string; x: number; y: number }[];
  };
  let presented = 0,
    sliding = 0,
    holes = 0,
    pushChecked = false;
  for (const seed of ['arena-lab:cornhole-recorded:v1', 'velvet-paw-29']) {
    await page.evaluate(
      (value) =>
        window.__HERO_ARENA__.loadScenario('cornhole-performance', {
          seed: value,
        }),
      seed,
    );
    const holeAnchors = (
      await snapshot(page)
    ).rendering!.equipmentRegistration.map((r) => r.hole);
    const duration = (await snapshot(page)).event.duration;
    let at = 0;
    while (at < duration) {
      await seekTime(page, at);
      const current = (await snapshot(page)).event.current;
      if (!current) {
        at += 0.5; // intro or between turns
        continue;
      }
      at = current.end + 0.02;
      if (current.contact !== 'board' && current.contact !== 'hole') continue;
      // Board travel is 0.28 s for every non-direct board/hole bag.
      const impact = current.contactAt - 0.28;
      await seekTime(page, Math.max(current.releaseAt, impact - 2 / 60));
      const samples: Sample[] = [];
      for (let k = 0; k < 40; k++) {
        const s = await snapshot(page),
          o = s.event.projectile.find(
            (p: { id: string }) => p.id === current.id,
          );
        if (o)
          samples.push({
            time: s.time,
            x: o.x,
            y: o.y,
            visible: o.visible,
            alpha: o.alpha,
            touch: o.kinematics?.touch,
            others: s.event.projectile
              .filter((p: { id: string }) => p.id !== current.id)
              .map((p: { id: string; x: number; y: number }) => ({
                id: p.id,
                x: p.x,
                y: p.y,
              })),
          });
        if (s.time > current.contactAt + 0.3) break;
        await step(page, 1);
      }
      const touch = samples.find((p) => p.touch)?.touch;
      if (!touch) continue; // direct shot: drops in without a board slide
      presented++;
      const slide = samples.filter(
        (p) => p.time >= impact - 1e-6 && p.time <= current.contactAt + 1e-6,
      );
      // It lands at the presentation touch point and travels forward (a bag
      // whose resting spot is on a drawn obstacle lands on its target).
      expect(Math.abs(slide[0].x - touch.x)).toBeLessThan(25);
      const travel = slide.at(-1)!.x - slide[0].x;
      expect(travel, `${seed} ${current.id} board travel`).toBeGreaterThan(
        -0.01,
      );
      if (travel > 1) sliding++;
      for (let i = 1; i < slide.length; i++)
        expect(slide[i].x - slide[i - 1].x).toBeGreaterThanOrEqual(-0.01);
      // recorded:v1 attempt 4 pushes a resting bag: it rests until the thrown
      // bag reaches it, never before first impact, and the drawn bags never
      // overlap before that (the contact frame may touch).
      if (
        seed === 'arena-lab:cornhole-recorded:v1' &&
        current.id.endsWith(':attempt:4')
      ) {
        const moved = (i: number, id: string) => {
          const a = samples[0].others.find((o) => o.id === id),
            b = samples[i].others.find((o) => o.id === id);
          return !!a && !!b && Math.hypot(b.x - a.x, b.y - a.y) > 1e-3;
        };
        const pushedId = samples[0].others.find((o) =>
          moved(samples.length - 1, o.id),
        )?.id;
        expect(pushedId, 'a4 pushes a resting bag').toBeTruthy();
        const starts = samples.findIndex((_, i) => moved(i, pushedId!));
        expect(samples[starts].time).toBeGreaterThan(impact);
        const half = current.actor ? 0.7 : 1,
          from = samples[0].others.find((o) => o.id === pushedId)!;
        for (let i = 0; i < starts - 1; i++)
          if (samples[i].time >= impact - 1e-6)
            expect(
              Math.abs(samples[i].x - from.x) < 58 * half - 0.5 &&
                Math.abs(samples[i].y - from.y) < 28 * half - 0.5,
              `a4 frame ${i}: thrown bag overlaps the bag before pushing it`,
            ).toBe(false);
        // The thrown bag reaches it (it lands on the bag's footprint and the
        // push starts at touchdown). Known limitation elsewhere: the board
        // solver pushes bags anywhere along the path from the front of the
        // board; a pushed bag the presented slide never reaches keeps its
        // recorded window and moves without visible contact
        // (docs/ANIMATION-HANDOFF.md).
        const reached = samples.some(
          (p) =>
            p.time >= impact - 1e-6 &&
            Math.abs(p.x - from.x) <= 58 * half + 1 &&
            Math.abs(p.y - from.y) <= 28 * half + 1,
        );
        console.log(
          `recorded:v1 a4 push: ${reached ? 'starts on contact' : 'recorded window (known limitation: the thrown bag never reaches the pushed bag)'}`,
        );
        expect(reached, 'a4: the thrown bag reaches the bag it pushes').toBe(
          true,
        );
        pushChecked = true;
      }
      if (current.contact === 'hole') {
        holes++;
        const visible = samples.filter(
          (p) => p.time > current.contactAt && p.visible && p.alpha > 0.001,
        );
        const last = visible.at(-1)!,
          hole = holeAnchors.reduce((best, h) =>
            Math.abs(h.x - last.x) < Math.abs(best.x - last.x) ? h : best,
          );
        expect(Math.abs(last.x - hole.x), `${seed} ${current.id}`).toBeLessThan(
          6,
        );
      }
    }
  }
  expect(presented).toBeGreaterThan(0);
  expect(sliding).toBeGreaterThan(0);
  expect(pushChecked).toBe(true);
  console.log(
    `presented board/hole bags: ${presented} (sliding ${sliding}), hole drops: ${holes}`,
  );
  expect(errors).toEqual([]);
});
