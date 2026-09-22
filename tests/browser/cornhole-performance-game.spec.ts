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
  // release. It may rotate with the wrist, but must not visibly snap.
  expect(Math.abs(object.rotation - previous.rotation)).toBeLessThan(0.05);
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
