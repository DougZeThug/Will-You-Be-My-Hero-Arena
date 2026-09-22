import assert from 'node:assert/strict';

export async function performanceTests() {
  const { CharacterPerformanceController, alignedSubstep } =
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
    evaluated = [];
    clips = new Map(
      [
        'idle',
        'look',
        'settle',
        'watch',
        'recover',
        'recoverWatch',
        'recoverPositive',
        'recoverNegative',
        'recoverRest',
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
    evaluate(graph, _dt, time) {
      this.time = time;
      const action = graph.get('action')?.clip.id;
      if (action) this.evaluated.push(action);
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

  const { underhandMechanics } =
    await import('../.test-build/engine/performance/BodyMechanics.mjs');
  const danTake = underhandMechanics(performanceProfiles.dan),
    dougTake = underhandMechanics(performanceProfiles.doug);
  check(() => assert.notDeepEqual(danTake.times, dougTake.times));
  check(() =>
    assert.notDeepEqual(danTake.channels.hips, dougTake.channels.hips),
  );
  for (const take of [danTake, dougTake])
    check(() => {
      for (let i = 0; i < take.times.length; i++) {
        const c = take.channels,
          torso = c.hips[i] + c.lowerSpine[i] + c.upperSpine[i] + c.chest[i],
          hand = c.palm[i] - torso - c.shoulder[i] - c.upperArm[i] - c.elbow[i];
        assert.ok(hand >= -35 && hand <= 95, `hand ${hand} at knot ${i}`);
      }
    });
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
  check(() =>
    assert.ok(
      observing
        .snapshot()
        .events.every((e, i) => Math.abs(e.time - large.events[i].time) < 1e-8),
    ),
  );
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
  check(() => assert.ok(timed.c.runtime.evaluated.includes('recoverWatch')));
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
  check(() => assert.ok(c.runtime.evaluated.includes('recoverNegative')));
  check(() =>
    assert.ok(
      !c.snapshot().events.some((e) => e.name === 'CELEBRATION_STARTED'),
    ),
  );
  check(() => assert.ok(large.c.runtime.evaluated.includes('recoverRest')));
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
  // The action clock samples the hand on an absolute 1/120 s grid, so the
  // fitted release velocity cannot depend on how a caller partitions advance().
  // The default fixture's hand path is exactly quadratic, which any cadence
  // fits exactly; a curved path makes partition dependence observable.
  class CurvedRuntime extends Runtime {
    attachment() {
      return {
        x: 10 + 30 * Math.sin(3 * this.time),
        y: 50 - 9 * Math.cos(2 * this.time),
        angle: this.time * 0.1,
      };
    }
  }
  const launch = (steps) => {
    const c = new CharacterPerformanceController(
      new CurvedRuntime(),
      performanceProfiles.doug,
    );
    c.perform('cornholeThrow', { objectId: 'bag' });
    for (const step of steps) c.advance(step);
    return c.snapshot().events.find((e) => e.name === 'OBJECT_RELEASED')
      .release;
  };
  const whole = launch([4]),
    sixty = launch(Array(240).fill(1 / 60)),
    odd = launch(Array(292).fill(0.0137));
  for (const other of [sixty, odd])
    check(() => {
      assert.ok(Math.abs(other.time - whole.time) < 1e-8);
      assert.ok(Math.abs(other.velocity.x - whole.velocity.x) < 1e-6);
      assert.ok(Math.abs(other.velocity.y - whole.velocity.y) < 1e-6);
    });
  check(() =>
    assert.deepEqual(
      [alignedSubstep(0, 1), alignedSubstep(1 / 120, 1), alignedSubstep(0.005, 1)],
      [1 / 120, 1 / 120, 1 / 120 - 0.005],
    ),
  );
  check(() => assert.equal(alignedSubstep(0.5, 0.001), 0.001));
  check(() => assert.ok(alignedSubstep(2.2713333333333288, 0.08) > 1e-6));

  // Live Play owns preparation: the player's charge stages the ritual, and the
  // live throw is time-scaled onto the live release marker. Its declared
  // external preparation admits the anticipation entry from idle; nothing else.
  const states = (events) =>
    events.filter((e) => e.name === 'STATE_CHANGED').map((e) => e.state);
  const live = make(),
    liveEvents = [];
  live.onEvent((e) => {
    liveEvents.push(e);
    if (e.name === 'OBJECT_RELEASED') live.confirmResult(e.actionId, true);
  });
  check(() =>
    assert.notEqual(
      live.perform('liveCornholeThrow', { objectId: 'held', queue: false }),
      null,
    ),
  );
  check(() => assert.equal(live.state, 'anticipate'));
  check(() =>
    assert.deepEqual(
      liveEvents.map((e) => e.name).slice(0, 4),
      ['ACTION_STARTED', 'OBJECT_ATTACHED', 'STATE_CHANGED', 'ANTICIPATION_STARTED'],
    ),
  );
  live.advance(12);
  check(() => assert.equal(live.state, 'idle'));
  check(() =>
    assert.equal(
      liveEvents.filter((e) => e.name === 'OBJECT_RELEASED').length,
      1,
    ),
  );
  check(() =>
    assert.equal(
      liveEvents.filter((e) => e.name === 'ACTION_COMPLETED').length,
      1,
    ),
  );
  check(() =>
    assert.ok(!liveEvents.some((e) => e.name === 'VALIDATION_WARNING')),
  );
  check(() =>
    assert.deepEqual(states(large.events).slice(0, 3), [
      'notice',
      'settle',
      'anticipate',
    ]),
  );
  check(() =>
    assert.deepEqual(states(liveEvents), states(large.events).slice(2)),
  );
  const bare = (name, extra, segments) =>
    new CharacterPerformanceController(
      new Runtime(),
      performanceProfiles.doug,
      new Map([[name, { name, priority: 10, ...extra, segments }]]),
    );
  check(() =>
    assert.throws(
      () =>
        bare('bareThrow', {}, [{ state: 'anticipate', clip: 'underhand' }]).perform(
          'bareThrow',
        ),
      /Invalid performance transition idle → anticipate/,
    ),
  );
  for (const state of ['windup', 'drive', 'release'])
    check(() =>
      assert.throws(
        () =>
          bare('skip', { preparation: 'external' }, [
            { state, clip: 'underhand' },
          ]).perform('skip'),
        new RegExp(`idle → ${state}`),
      ),
    );
  const late = bare('late', { preparation: 'external' }, [
    { state: 'notice', clip: 'look', duration: 0.2 },
    { state: 'anticipate', clip: 'underhand' },
  ]);
  late.perform('late');
  check(() => assert.throws(() => late.advance(1), /notice → anticipate/));

  console.log(
    `Character performance: ${checks} lifecycle, release and regression checks passed.`,
  );
  return checks;
}
