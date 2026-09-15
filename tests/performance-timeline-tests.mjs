import assert from 'node:assert/strict';
export async function testPerformanceTimeline({ check }) {
  const { PerformanceTimeline } =
    await import('../.test-build/engine/motion/PerformanceTimeline.mjs');
  const { GestureMemory, performancePersonalities } =
    await import('../.test-build/engine/characters/PerformancePersonality.mjs');
  const { PropPerformance } =
    await import('../.test-build/engine/equipment/PropPerformance.mjs');
  let complete = false,
    transition = false,
    starts = 0;
  const played = [];
  const host = {
    has: () => true,
    complete: () => complete,
    canTransition: () => transition,
    play: (s) => {
      played.push(s);
      complete = false;
      return true;
    },
  };
  const timeline = new PerformanceTimeline(
    performancePersonalities.doug,
    host,
    3,
  );
  timeline.mode = 'showcase';
  const launch = () => {
    starts++;
    complete = false;
    return true;
  };
  check(() => assert.equal(timeline.begin(launch, 'bag', 0), true));
  check(() => assert.deepEqual(played, ['gesture.bagFlip']));
  check(() => assert.equal(timeline.begin(launch, 'bag', 0.1), false));
  timeline.update(0.2);
  check(() => assert.equal(starts, 0));
  complete = true;
  timeline.update(1);
  timeline.update(1.1);
  check(() => assert.equal(starts, 1));
  timeline.release(2);
  transition = true;
  timeline.update(5);
  check(() =>
    assert.equal(
      timeline.phase,
      'WATCHING',
      'Showcase must never invent a successful result',
    ),
  );
  timeline.resolve('successMedium', 5);
  timeline.update(5.1);
  check(() => assert.equal(timeline.phase, 'RESULT'));
  transition = false;
  timeline.update(5.2);
  check(() =>
    assert.equal(
      timeline.phase,
      'RESULT',
      'Do not cancel an unsafe athletic recovery',
    ),
  );
  transition = true;
  timeline.update(5.3);
  check(() => assert.equal(timeline.gesture, 'chestTap'));
  complete = true;
  timeline.update(7);
  timeline.update(7.2);
  check(() => assert.equal(timeline.phase, 'IDLE'));
  played.length = 0;
  timeline.begin(launch, 'basketball', 8);
  check(() => assert.ok(!played.includes('gesture.bagFlip')));
  timeline.release(9);
  timeline.resolve('successMedium', 10);
  timeline.update(10.2);
  check(() =>
    assert.equal(
      played.at(-1),
      'gesture.chestTap',
      'Same success gesture across equipment types',
    ),
  );
  complete = true;
  timeline.update(12);
  timeline.update(12.2);
  timeline.begin(launch, 'bag', 13);
  complete = true;
  timeline.update(14);
  timeline.release(15);
  timeline.resolve('failure', 16);
  timeline.update(16.2);
  check(() =>
    assert.notEqual(
      timeline.gesture,
      'chestTap',
      'Forced showcase cannot celebrate a miss',
    ),
  );
  const a = new GestureMemory(18),
    b = new GestureMemory(18),
    choices = [];
  for (let i = 0; i < 100; i++) {
    const pool = { chestTap: 1, fistPump: 1, subtleNod: 1 };
    const x = a.choose(pool, () => true);
    choices.push(x);
    check(() =>
      assert.equal(
        x,
        b.choose(pool, () => true),
      ),
    );
  }
  check(() =>
    assert.ok(
      choices.filter((v, i) => v === choices[i - 1]).length < 25,
      'Recent choices suppress obvious repetition',
    ),
  );
  check(() => assert.ok(a.recent.length <= 4));
  check(() =>
    assert.equal(
      a.choose({ bagFlip: 1 }, () => false),
      'none',
    ),
  );
  check(() =>
    assert.notDeepEqual(
      performancePersonalities.doug,
      performancePersonalities.dan,
    ),
  );
  // Imported prop module must remain pure (no Phaser/DOM dependency).
  check(() => assert.equal(typeof PropPerformance, 'function'));
}
