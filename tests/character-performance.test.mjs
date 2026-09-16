import assert from 'node:assert/strict';

export async function performanceTests() {
  const { CharacterPerformanceController } =
    await import('../.test-build/engine/performance/CharacterPerformanceController.mjs');
  const { performanceProfiles, validatePerformanceProfile } =
    await import('../.test-build/engine/performance/PerformanceProfiles.mjs');
  let checks = 0;
  const check = (fn) => {
    fn();
    checks++;
  };
  class Runtime {
    time = 0;
    destroyed = false;
    clips = new Map(
      [
        'idle',
        'look',
        'settle',
        'watch',
        'recover',
        'positive',
        'negative',
        'nod',
        'chestTap',
        'underhand',
        'observePrepare',
        'observeFlight',
        'observeAcknowledge',
      ].map((id) => [
        id,
        {
          id,
          native: id,
          duration: id === 'underhand' ? 2 : 1,
          layer: id === 'idle' || id.startsWith('observe') ? 'base' : 'action',
          priority: 1,
          fade: 0.18,
          loop: ['idle', 'look', 'settle', 'watch', 'recover'].includes(id),
          phases: [],
          markers:
            id === 'underhand' ? [{ name: 'equipmentRelease', at: 0.96 }] : [],
        },
      ]),
    );
    evaluate(_graph, _dt, time) {
      this.time = time;
    }
    attachment() {
      return {
        x: 10 + this.time * this.time * 30,
        y: 50 - this.time * 9,
        angle: this.time * 0.1,
      };
    }
    reset() {
      this.time = 0;
    }
    destroy() {
      this.destroyed = true;
    }
  }
  const make = (profile = performanceProfiles.doug) =>
    new CharacterPerformanceController(new Runtime(), profile);
  const run = (step, result = true) => {
    const c = make(),
      events = [];
    c.onEvent((e) => {
      events.push(e);
      if (e.name === 'OBJECT_RELEASED' && result)
        c.confirmResult(e.actionId, true);
    });
    c.perform('cornholeThrow', {
      objectId: 'bag',
      target: { x: 1000, y: 500 },
    });
    for (let t = 0; t < 12 - 1e-8; t += step) c.advance(Math.min(step, 12 - t));
    return { c, events };
  };
  const large = run(12),
    small = run(1 / 60);
  const observing = make();
  observing.observe({
    mode: 'acknowledge',
    elapsed: 0.4,
    attemptId: 'opponent-hole',
    target: { x: 900, y: 400 },
  });
  const own = observing.perform('cornholeThrow', {
    objectId: 'own',
    queue: false,
  });
  check(() => assert.notEqual(own, null));
  observing.onEvent((event) => {
    if (event.name === 'OBJECT_RELEASED')
      observing.confirmResult(event.actionId, true);
  });
  observing.advance(0.9);
  observing.observe({
    mode: 'flight',
    elapsed: 0.2,
    attemptId: 'opponent-next',
    target: { x: 1000, y: 350 },
  });
  observing.advance(11.1);
  check(() => assert.deepEqual(observing.snapshot().queue, []));
  check(() =>
    assert.deepEqual(
      observing.snapshot().events.map((e) => e.name),
      large.events.map((e) => e.name),
    ),
  );
  check(() => assert.ok(observing.snapshot().events.every((e,i) => Math.abs(e.time-large.events[i].time)<1e-8)));
  observing.reset();
  check(() => assert.equal(observing.snapshot().observation, null));
  check(() => assert.equal(large.c.state, 'idle'));
  check(() =>
    assert.equal(
      large.events.filter((e) => e.name === 'OBJECT_RELEASED').length,
      1,
    ),
  );
  check(() =>
    assert.equal(
      large.events.filter((e) => e.name === 'ACTION_COMPLETED').length,
      1,
    ),
  );
  check(() =>
    assert.equal(
      large.events.filter((e) => e.name === 'CELEBRATION_STARTED').length,
      1,
    ),
  );
  const release = large.events.find(
    (e) => e.name === 'OBJECT_RELEASED',
  ).release;
  check(() =>
    assert.ok(Math.abs(release.x - (10 + release.time ** 2 * 30)) < 1e-6),
  );
  check(() =>
    assert.ok(Math.abs(release.velocity.x - release.time * 60) < 0.001),
  );
  check(() => assert.ok(Math.abs(release.velocity.y + 9) < 0.001));
  check(() =>
    assert.deepEqual(
      large.events.map((e) => e.name),
      small.events.map((e) => e.name),
    ),
  );
  check(() =>
    assert.ok(
      large.events.every(
        (e, i) => Math.abs(e.time - small.events[i].time) < 1e-6,
      ),
    ),
  );
  check(() => assert.equal(large.c.attachments.attached, null));
  const timed = run(12, false);
  check(() => assert.equal(timed.c.state, 'idle'));
  check(() =>
    assert.equal(
      timed.events.filter((e) => e.name === 'CELEBRATION_STARTED').length,
      0,
    ),
  );
  check(() =>
    assert.ok(timed.events.some((e) => e.detail?.includes('Result timeout'))),
  );
  const c = make(),
    callbacks = [];
  const first = c.perform('cornholeThrow', {
    objectId: 'one',
    onComplete: (r) => callbacks.push(r),
  });
  c.advance(0.9);
  check(() => assert.equal(c.cancel(first), false));
  const second = c.perform('look', { queue: true });
  check(() => assert.equal(c.snapshot().requestedAction, 'look'));
  check(() => assert.equal(c.cancel(second), true));
  check(() => assert.equal(c.perform('unknown'), null));
  check(() => assert.equal(c.perform('cornholeThrow'), null));
  c.advance(1);
  check(() => assert.equal(c.confirmResult(first + 20, true), false));
  check(() => assert.equal(c.confirmResult(first, false), true));
  check(() => assert.equal(c.confirmResult(first, true), false));
  c.advance(8);
  check(() => assert.deepEqual(callbacks, ['completed']));
  check(() =>
    assert.ok(
      !c.snapshot().events.some((e) => e.name === 'CELEBRATION_STARTED'),
    ),
  );
  const d = make();
  let cancelled = 0;
  d.perform('look', {
    onComplete: (r) => {
      if (r === 'cancelled') cancelled++;
    },
  });
  d.perform('settle', { priority: 5 });
  check(() => assert.equal(cancelled, 1));
  check(() => assert.equal(d.snapshot().action, 'settle'));
  d.reset();
  check(() => assert.equal(d.state, 'idle'));
  check(() => assert.equal(d.snapshot().queue.length, 0));
  check(() => assert.throws(() => d.advance(NaN)));
  check(() => assert.throws(() => d.advance(-1)));
  check(() =>
    assert.throws(() =>
      validatePerformanceProfile({
        ...performanceProfiles.doug,
        stanceWidth: 10,
      }),
    ),
  );
  const bad = new Runtime();
  bad.clips.delete('underhand');
  const broken = new CharacterPerformanceController(
    bad,
    performanceProfiles.doug,
  );
  broken.perform('cornholeThrow', { objectId: 'bag' });
  broken.advance(2);
  check(() => assert.equal(broken.state, 'idle'));
  check(() => assert.equal(broken.attachments.attached, null));
  const e = make();
  e.onEvent((event) => {
    if (event.name === 'OBJECT_RELEASED') e.perform('look');
  });
  e.perform('cornholeThrow', { objectId: 'bag' });
  e.advance(2);
  check(() => assert.equal(e.snapshot().requestedAction, 'look'));
  e.destroy();
  check(() => assert.equal(e.perform('look'), null));
  check(() => assert.equal(e.runtime.destroyed, true));
  const reentrant = make();
  reentrant.perform('look', { onComplete: () => reentrant.perform('look') });
  reentrant.perform('settle', { priority: 5 });
  check(() => assert.equal(reentrant.snapshot().action, 'settle'));
  check(() => assert.equal(reentrant.snapshot().requestedAction, 'look'));
  reentrant.advance(2);
  check(() => assert.equal(reentrant.state, 'idle'));
  const invalid = new Runtime();
  invalid.clips.set('broken', {
    ...invalid.clips.get('look'),
    id: 'broken',
    duration: 0,
  });
  check(() =>
    assert.throws(
      () =>
        new CharacterPerformanceController(invalid, performanceProfiles.doug),
      /duration/,
    ),
  );
  const repeat = new Runtime();
  repeat.clips
    .get('underhand')
    .markers.push({ name: 'equipmentRelease', at: 1.2 });
  check(() =>
    assert.throws(
      () =>
        new CharacterPerformanceController(repeat, performanceProfiles.doug),
      /twice/,
    ),
  );
  // The controller releases any semantic object action, not just the first sport's clip id.
  const other = new Runtime();
  other.clips.set('overhand', {
    ...other.clips.get('underhand'),
    id: 'overhand',
  });
  const extension = new CharacterPerformanceController(
    other,
    performanceProfiles.dan,
    new Map([
      [
        'futureShot',
        {
          name: 'futureShot',
          priority: 10,
          requiresObject: true,
          segments: [
            { state: 'settle', clip: 'settle', duration: 0.2 },
            {
              state: 'anticipate',
              clip: 'overhand',
              phases: [
                { at: 0.1, state: 'windup' },
                { at: 0.2, state: 'drive' },
                { at: 0.6, state: 'followThrough' },
              ],
            },
            { state: 'recover', clip: 'recover', duration: 0.2 },
          ],
        },
      ],
    ]),
  );
  extension.perform('futureShot', { objectId: 'ball' });
  extension.advance(3);
  check(() =>
    assert.equal(
      extension.snapshot().events.filter((e) => e.name === 'OBJECT_RELEASED')
        .length,
      1,
    ),
  );
  console.log(
    `Character performance: ${checks} lifecycle, release and regression checks passed.`,
  );
  return checks;
}
