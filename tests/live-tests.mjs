import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function testLive({ check }) {
  const { ArenaSession } =
    await import('../.test-build/engine/core/ArenaSession.mjs');
  const { VirtualDevice } =
    await import('../.test-build/engine/input/InputDevice.mjs');
  const { InputManager } =
    await import('../.test-build/engine/input/InputManager.mjs');
  const { IntentTracker } =
    await import('../.test-build/engine/input/IntentTracker.mjs');
  const { mapGamepad } =
    await import('../.test-build/engine/input/GamepadDevice.mjs');
  const { bindingsFor } =
    await import('../.test-build/engine/input/InputBindings.mjs');
  const { ActionTimeline } =
    await import('../.test-build/engine/animation/AnimationEvents.mjs');
  const { ComboRecognizer } =
    await import('../.test-build/engine/controllers/EventActionMap.mjs');
  const { FightingActionMap } =
    await import('../.test-build/engine/events/fighting/FightingActionMap.mjs');
  const { timingGrade, rhythmTiming } =
    await import('../.test-build/engine/input/TimingWindow.mjs');
  const config = (
    event = 'cornhole',
    ai = true,
    count = 2,
    seed = 'live-proof',
  ) => ({
    event,
    seed,
    players: Array.from({ length: count }, (_, i) => ({
      id: 'p' + i,
      cardId: i % 2 ? 'card-dan' : 'card-doug',
      device: ai ? 'ai' : 'touch',
      bindings: bindingsFor(i),
    })),
    options: { movement: 'lanes' },
  });
  const advance = (s, seconds) => {
    for (let i = 0; i < Math.ceil(seconds * 60); i++) s.advance(1 / 60);
  };
  const pulse = (s, id, intent) => {
    s.inject(id, intent, 1);
    s.inject(id, intent, 0);
    s.advance(1 / 60);
  };
  const frame = (values) => ({ values, family: 'touch', connected: true });
  const manager = new InputManager();
  manager.assign('p0', new VirtualDevice('shared'));
  check(() =>
    assert.throws(() => manager.assign('p1', new VirtualDevice('shared'))),
  );
  manager.destroy();
  const tap = new VirtualDevice('tap');
  tap.set('primaryAction', 1);
  tap.set('primaryAction', 0);
  check(() => assert.equal(tap.poll(0).values.primaryAction, 1));
  check(() => assert.equal(tap.poll(0.01).values.primaryAction, 0));
  const tracker = new IntentTracker();
  check(() =>
    assert.ok(
      tracker
        .sample(frame({ charge: 1 }), 0)
        .some((s) => s.phase === 'pressed'),
    ),
  );
  check(() =>
    assert.ok(
      tracker
        .sample(frame({ charge: 0.8 }), 0.5)
        .some((s) => s.phase === 'held' && s.held === 0.5),
    ),
  );
  check(() =>
    assert.ok(
      tracker
        .sample(frame({ charge: 0 }), 0.7)
        .some((s) => s.phase === 'released' && s.held === 0.7),
    ),
  );
  tracker.reset();
  tracker.sample(frame({ primaryAction: 1 }), 0);
  tracker.sample(frame({ primaryAction: 0 }), 0.05);
  check(() =>
    assert.ok(
      tracker
        .sample(frame({ primaryAction: 1 }), 0.12)
        .some((s) => s.phase === 'doubleTapped'),
    ),
  );
  const pad = {
    id: 'Sony DualSense',
    connected: true,
    mapping: 'standard',
    axes: [0.08, 0.03, 0.7, -0.6],
    buttons: Array.from({ length: 18 }, (_, i) => ({
      value: i === 7 ? 0.72 : i === 3 ? 1 : 0,
      pressed: i === 3,
    })),
  };
  const mapped = mapGamepad(pad, bindingsFor(0));
  check(() => assert.equal(mapped.family, 'playstation'));
  check(() => assert.deepEqual(mapped.values.move, { x: 0, y: 0 }));
  check(() => assert.equal(mapped.values.charge, 0.72));
  check(() => assert.equal(mapped.values.specialAction, 1));
  check(() => assert.ok(mapped.values.aim.x > 0.5));
  check(() => assert.equal(mapGamepad(null, bindingsFor(0)).connected, false));
  const tl = new ActionTimeline(),
    markers = [];
  tl.start('attack', 0.6, [
    { name: 'hitboxOn', at: 0.15 },
    { name: 'hitboxOff', at: 0.25 },
    { name: 'cancelWindow', at: 0.4 },
  ]);
  for (let i = 0; i < 60; i++) tl.update(1 / 60, (m) => markers.push(m.name));
  check(() =>
    assert.deepEqual(markers, [
      'hitboxOn',
      'hitboxOff',
      'cancelWindow',
      'animationComplete',
    ]),
  );
  check(() => assert.equal(tl.canCancel, true));
  const combos = new ComboRecognizer();
  let found;
  for (const [i, intent] of [
    'primaryAction',
    'primaryAction',
    'secondaryAction',
  ].entries())
    found =
      combos.push(
        { intent, phase: 'pressed', at: i * 0.35, value: 1, held: 0 },
        FightingActionMap.combos,
      ) || found;
  check(() => assert.equal(found, 'finisher'));
  check(() => assert.equal(timingGrade(0.5, 0.7, 0.05).grade, 'early'));
  check(() => assert.equal(timingGrade(0.72, 0.7, 0.05).grade, 'perfect'));
  check(() => assert.equal(rhythmTiming(1.01, 0.5, 0.03).grade, 'perfect'));

  const hysteresis = new IntentTracker();
  hysteresis.sample(frame({ charge: 0.3 }), 0);
  for (let i = 1; i < 5; i++)
    check(() =>
      assert.equal(
        hysteresis
          .sample(frame({ charge: 0.12 }), i * 0.1)
          .filter((s) => s.phase === 'pressed' || s.phase === 'released')
          .length,
        0,
        'Trigger hysteresis retains active state',
      ),
    );
  check(() =>
    assert.ok(
      hysteresis
        .sample(frame({ charge: 0.09 }), 0.6)
        .some((s) => s.phase === 'released'),
    ),
  );
  const vectorTap = new VirtualDevice('vector');
  vectorTap.set('move', { x: 1, y: 0 });
  vectorTap.set('move', { x: 0, y: 0 });
  check(() => assert.deepEqual(vectorTap.poll(0).values.move, { x: 1, y: 0 }));
  check(() =>
    assert.deepEqual(vectorTap.poll(0.01).values.move, { x: 0, y: 0 }),
  );
  const restart = new ActionTimeline();
  restart.start('jab', 0.5, [{ name: 'hitboxOn', at: 0.1 }]);
  restart.update(0.2, (m) => {
    if (m.name === 'hitboxOn')
      restart.start('jab', 0.5, [{ name: 'hitboxOn', at: 0.1 }]);
  });
  check(() =>
    assert.equal(
      restart.time,
      0,
      'Same-clip restart cannot consume the next action markers',
    ),
  );
  const duplicate = config('running');
  duplicate.players.forEach((p) => (p.device = 'keyboard'));
  check(() =>
    assert.throws(() => new ArenaSession(duplicate), /distinct device/),
  );
  const gamepadConfig = config('cornhole', false);
  gamepadConfig.players[0].device = 'gamepad:0';
  const resumed = new ArenaSession(gamepadConfig);
  let trigger = 1;
  resumed.assign('p0', {
    id: 'synthetic-pad',
    family: 'xbox',
    poll: () => ({
      values: { charge: trigger, move: { x: 0, y: 0 } },
      family: 'xbox',
      connected: true,
    }),
    clear() {},
    destroy() {},
  });
  advance(resumed, 1.6);
  resumed.pause();
  resumed.pause(false);
  advance(resumed, 0.2);
  check(() =>
    assert.equal(
      resumed.characters[0].substate,
      'aiming',
      'Held trigger cannot re-charge on resume',
    ),
  );
  trigger = 0;
  advance(resumed, 0.1);
  trigger = 1;
  advance(resumed, 0.1);
  check(() =>
    assert.equal(
      resumed.characters[0].substate,
      'charging',
      'Fresh trigger works after neutral',
    ),
  );
  resumed.destroy();
  const freeConfig = config('running', false);
  freeConfig.options.movement = 'free';
  const free = new ArenaSession(freeConfig);
  advance(free, 2);
  check(() =>
    assert.equal(
      free.characters[0].body.x,
      170,
      'Free movement stays still without acceleration',
    ),
  );
  free.inject('p0', 'move', { x: 1, y: 0 });
  advance(free, 1);
  check(() => assert.ok(free.characters[0].body.x > 250));
  free.destroy();

  const { PlayerController } =
    await import('../.test-build/engine/controllers/PlayerController.mjs');
  let entityMode = 'positioning';
  const attempted = [];
  const vehicle = {
    move() {},
    aim() {},
    performAction(action) {
      attempted.push(action);
      return true;
    },
    canPerform() {
      return true;
    },
    getState() {
      return 'idle';
    },
    controlState() {
      return entityMode;
    },
    canCancel() {
      return true;
    },
    getFacing() {
      return 1;
    },
  };
  const contextual = {
    id: 'future-entity',
    bufferSeconds: 0.15,
    actions: [
      {
        intent: 'primaryAction',
        phase: 'pressed',
        command: 'accelerate',
        label: 'Go',
        states: ['positioning'],
      },
      {
        intent: 'primaryAction',
        phase: 'pressed',
        command: 'salute',
        label: 'Celebrate',
        states: ['finished'],
      },
    ],
  };
  const reusable = new PlayerController(
    'vehicle',
    vehicle,
    contextual,
    () => {},
  );
  reusable.update(frame({ primaryAction: 1 }), 0);
  reusable.update(frame({ primaryAction: 0 }), 0.1);
  entityMode = 'finished';
  reusable.update(frame({ primaryAction: 1 }), 0.5);
  check(() =>
    assert.deepEqual(
      attempted,
      ['accelerate', 'salute'],
      'Custom entities and contextual maps share PlayerController',
    ),
  );
  const { validateProfile } =
    await import('../.test-build/engine/characters/CharacterProfile.mjs');
  const { doug } =
    await import('../.test-build/engine/characters/profiles/doug.mjs');
  check(() =>
    assert.deepEqual(
      validateProfile({
        ...doug,
        pools: { ...doug.pools, interaction: ['combat.cross'] },
      }),
      [],
      'Combat vocabulary is registered before a game is mounted',
    ),
  );
  check(() => assert.deepEqual(validateProfile(doug), []));
  // Authored overrides may script every PuppetPose joint, wrists and palms included.
  const override = (pose) => ({
    ...doug,
    overrides: {
      'combat.cross': {
        duration: 1,
        keys: [
          { at: 0, pose },
          { at: 1, pose: {} },
        ],
      },
    },
  });
  check(() =>
    assert.deepEqual(
      validateProfile(
        override({ wristR: 30, palmR: 0.8, wristL: -10, palmL: 1 }),
      ),
      [],
      'Wrist and palm keys are valid override joints',
    ),
  );
  check(() =>
    assert.ok(
      validateProfile(override({ palmR: 2 })).length > 0,
      'Out-of-range palm exposure is still rejected',
    ),
  );
  const nameless = structuredClone(doug);
  delete nameless.name;
  for (const profile of [
    nameless,
    ...[null, 42, '', '   ', 'x'.repeat(81)].map((name) => ({ ...doug, name })),
  ])
    check(() =>
      assert.ok(
        validateProfile(profile).some((e) => e.includes('name')),
        'Profiles need a display name: ' + JSON.stringify(profile.name),
      ),
    );

  const outcomes = [];
  for (const event of ['cornhole', 'running', 'fighting']) {
    const a = new ArenaSession(config(event)),
      b = new ArenaSession(config(event));
    let frames = 0;
    while (!a.snapshot().finished && frames < 3900) {
      a.advance(1 / 60);
      b.advance(1 / 60);
      frames++;
      if (frames % 60 === 0) {
        for (const c of a.characters)
          check(() =>
            assert.ok(
              [
                c.body.x,
                c.body.y,
                c.body.z,
                c.health,
                c.stamina,
                ...Object.values(c.animation.pose),
              ].every(Number.isFinite),
            ),
          );
      }
    }
    check(() => assert.equal(a.snapshot().finished, true, event + ' finishes'));
    check(() =>
      assert.deepEqual(
        a.snapshot(),
        b.snapshot(),
        event + ' deterministic from identical semantic inputs',
      ),
    );
    check(() =>
      assert.ok(
        a.controllers.every((c) => c.commands > 10),
        'AI enters the player-controller path',
      ),
    );
    if (event === 'cornhole')
      check(() =>
        assert.ok(
          a.characters.some((c) => c.score > 0),
          'AI charges and scores through release events',
        ),
      );
    if (event === 'running')
      check(() =>
        assert.ok(
          a.characters.every((c) => c.score >= 90),
          'Runners make forward progress',
        ),
      );
    if (event === 'fighting')
      check(() =>
        assert.ok(
          a.characters.some((c) => c.health < 50),
          'Combat detects actual hits',
        ),
      );
    outcomes.push({
      event,
      seconds: a.time,
      scores: a.characters.map((c) => c.score),
      health: a.characters.map((c) => c.health),
      commands: a.controllers.map((c) => c.commands),
      buffered: a.controllers.map((c) => c.buffered),
    });
    a.destroy();
    b.destroy();
  }
  const four = new ArenaSession(config('running', true, 4));
  advance(four, 3);
  check(() => assert.equal(four.characters.length, 4));
  check(() => assert.ok(four.characters.every((c) => c.body.x > 200)));
  four.destroy();
  const movement = new ArenaSession(config('running', false));
  advance(movement, 1.7);
  const startX = movement.characters[0].body.x;
  movement.inject('p0', 'charge', 1);
  advance(movement, 2);
  check(() => assert.ok(movement.characters[0].body.x > startX + 300));
  check(() => assert.ok(movement.characters[0].stamina < 100));
  pulse(movement, 'p0', 'primaryAction');
  advance(movement, 0.2);
  check(() => assert.ok(movement.characters[0].body.z > 20));
  const time = movement.time;
  movement.pause();
  advance(movement, 1);
  check(() => assert.equal(movement.time, time));
  movement.destroy();
  function humanShot(held) {
    const s = new ArenaSession(config('cornhole', false));
    advance(s, 1.6);
    check(() => assert.equal(s.snapshot().phase, 'aiming'));
    check(() =>
      assert.ok(
        s.snapshot().objects.some((o) => o.id === 'held' && o.owner === 'p0'),
        'Held bag is presented while aiming',
      ),
    );
    s.inject('p0', 'charge', 1);
    s.advance(1 / 60);
    advance(s, held);
    s.inject('p0', 'charge', 0);
    advance(s, 2.4);
    return s;
  }
  const accurate = humanShot(1.05),
    early = humanShot(0.18);
  check(() =>
    assert.ok(
      accurate.characters[0].score > early.characters[0].score,
      'Human release timing changes the actual score',
    ),
  );
  accurate.destroy();
  early.destroy();
  const combat = new ArenaSession(config('fighting', false));
  advance(combat, 1.6);
  combat.characters[0].body.x = 500;
  combat.characters[1].body.x = 610;
  combat.inject('p1', 'modifierLeft', 1);
  combat.advance(1 / 60);
  pulse(combat, 'p0', 'primaryAction');
  advance(combat, 0.1);
  check(() =>
    assert.equal(
      combat.characters[1].health,
      100,
      'Attack startup has no active hitbox',
    ),
  );
  advance(combat, 0.12);
  check(() =>
    assert.equal(
      combat.characters[1].health,
      98,
      'Forward guard blocks damage',
    ),
  );
  pulse(combat, 'p0', 'secondaryAction');
  check(() =>
    assert.ok(
      combat.controllers[0].pending.includes('heavy'),
      'Recovery input is buffered',
    ),
  );
  advance(combat, 0.17);
  check(() =>
    assert.equal(
      combat.controllers[0].lastCommand,
      'heavy',
      'Buffered heavy begins in cancel window',
    ),
  );
  combat.destroy();
  const expiry = new ArenaSession(config('fighting', false));
  advance(expiry, 1.6);
  expiry.characters[0].stamina = 0;
  pulse(expiry, 'p0', 'specialAction');
  advance(expiry, 0.5);
  expiry.characters[0].stamina = 100;
  advance(expiry, 0.1);
  check(() =>
    assert.equal(
      expiry.characters[0].animation.timeline.active,
      false,
      'Expired input does not execute later',
    ),
  );
  expiry.destroy();
  // Hit-stop: a landed blow holds the clock for a few steps. Nothing moves,
  // but input made during the hold is sampled, not dropped.
  const stop = new ArenaSession(config('fighting', false));
  advance(stop, 1.6);
  stop.characters[0].body.x = 500;
  stop.characters[1].body.x = 610;
  pulse(stop, 'p0', 'primaryAction');
  for (let i = 0; i < 40 && stop.characters[1].health === 100; i++)
    stop.advance(1 / 60);
  const struck = stop.time,
    frozen = JSON.stringify(stop.characters.map((c) => c.body)),
    held = stop.hitStopSteps;
  check(() => assert.ok(stop.characters[1].health < 100, 'Unguarded hit lands'));
  check(() => assert.equal(stop.characters[1].beats.hit, struck));
  check(() => assert.ok(held >= 3 && held <= 5, 'Hit-stop holds 3-5 steps'));
  const inputs = () =>
    stop.controllers[0].commands + stop.controllers[0].buffered;
  const before = inputs();
  pulse(stop, 'p0', 'primaryAction');
  check(() => assert.equal(stop.time, struck, 'The clock holds'));
  check(() =>
    assert.equal(
      JSON.stringify(stop.characters.map((c) => c.body)),
      frozen,
      'Nothing moves during hit-stop',
    ),
  );
  check(() =>
    assert.ok(inputs() > before, 'Input during hit-stop is not dropped'),
  );
  for (let i = 0; i < held; i++) stop.advance(1 / 60);
  check(() => assert.ok(stop.time > struck, 'The clock resumes'));
  check(() => assert.equal(stop.hitStopSteps, 0));
  stop.destroy();
  // Fixes from docs/product-description/bug-triage.md, each named by its entry.
  const { keyConflict, invalidBinding, validateBindings } =
    await import('../.test-build/engine/input/InputBindings.mjs');
  const keyboard1 = { layout: 0, keys: bindingsFor(0).keys },
    keyboard2 = { layout: 1, keys: bindingsFor(1).keys };
  // B-34: a key already in use is refused, naming what uses it.
  check(() =>
    assert.deepEqual(keyConflict('Space', 'celebrate', [keyboard1], 0), {
      player: 0,
      use: 'charge',
    }),
  );
  check(() =>
    assert.equal(keyConflict('KeyC', 'celebrate', [keyboard1], 0), undefined),
  );
  check(() =>
    assert.deepEqual(keyConflict('KeyW', 'charge', [keyboard1], 0), {
      player: 0,
      use: 'move',
    }),
  );
  check(() =>
    assert.deepEqual(
      keyConflict('Numpad1', 'celebrate', [keyboard1, keyboard2], 0),
      { player: 1, use: 'primaryAction' },
    ),
  );
  check(() =>
    assert.equal(
      keyConflict('KeyZ', 'celebrate', [keyboard1, keyboard2], 0),
      undefined,
    ),
  );
  check(() =>
    assert.equal(
      invalidBinding({
        ...bindingsFor(0),
        buttons: { ...bindingsFor(0).buttons, charge: 40 },
      }),
      'charge',
    ),
  );
  check(() => assert.equal(invalidBinding(bindingsFor(1)), undefined));
  // B-18: a malformed saved entry is rejected, never thrown on.
  check(() => assert.equal(validateBindings({ keys: 'x' }), false));
  check(() => assert.equal(validateBindings(null), false));
  check(() => assert.equal(validateBindings(bindingsFor(0)), true));
  const { resolvePrecisionLanding, bagPoints, precisionTarget } =
    await import('../.test-build/engine/events/precision/PrecisionPhysics.mjs');
  const { laneScale } =
    await import('../.test-build/engine/events/running/RunningPhysics.mjs');
  const { ATTACKS } =
    await import('../.test-build/engine/characters/components/CombatComponent.mjs');
  // B-26: a roll curls around the bags it meets once, however many there are.
  const hole = precisionTarget();
  let spot;
  for (let dy = -30; dy <= 30 && !spot; dy += 2)
    for (let dx = -60; dx <= 60 && !spot; dx += 2) {
      const p = { x: hole.x + dx, y: hole.y + dy };
      if (
        Math.hypot(dx, dy) > 45 &&
        [p, { ...p, y: p.y + 16 }, { ...p, x: p.x + 8 }, { ...p, x: p.x - 8 }]
          .map(bagPoints)
          .every((n) => n === 1)
      )
        spot = p;
    }
  check(() => assert.ok(spot, 'a board spot for the roll test'));
  const around = [8, -8, 0].map((dx, i) => ({
    id: 'b' + i,
    owner: 'p1',
    x: spot.x + dx,
    y: spot.y + (i === 2 ? -6 : 0),
    angle: 0,
    points: 1,
  }));
  const rolled = resolvePrecisionLanding(
    { id: 'r', owner: 'p0', origin: spot, target: { ...spot }, age: 1, duration: 1, arc: 0, spin: 0 },
    around,
    'roll',
  );
  check(() => assert.equal(rolled.y, spot.y + 16, 'Roll offset applies once'));
  // B-26: players 3 and 4 start inside the throwing line.
  const fourThrowers = new ArenaSession(config('cornhole', false, 4));
  check(() =>
    assert.ok(
      fourThrowers.characters.every((c) => c.body.x >= 165 && c.body.x <= 350),
      'Every thrower starts inside the throwing line',
    ),
  );
  fourThrowers.destroy();
  // B-25, B-27: the caption names the shot, and returns to aiming after a
  // pause cancels a charge.
  const shots = new ArenaSession(config('cornhole', false));
  advance(shots, 1.6);
  check(() => assert.match(shots.snapshot().message, /Shot: Hole runner/));
  pulse(shots, 'p0', 'secondaryAction');
  check(() => assert.match(shots.snapshot().message, /Shot: Slide/));
  shots.inject('p0', 'charge', 1);
  advance(shots, 0.3);
  check(() => assert.match(shots.snapshot().message, /green window/));
  shots.pause(true);
  shots.pause(false);
  shots.inject('p0', 'charge', 0);
  advance(shots, 0.05);
  check(() =>
    assert.match(shots.snapshot().message, /aim, hold charge.*Shot: Slide/),
  );
  shots.destroy();
  // B-25: every turn starts on a shot the player can select again.
  const danFirst = new ArenaSession({
    ...config('cornhole', false),
    players: config('cornhole', false).players.map((p, i) => ({
      ...p,
      cardId: i ? 'card-doug' : 'card-dan',
    })),
  });
  advance(danFirst, 1.6);
  check(() => assert.match(danFirst.snapshot().message, /Shot: Roll/));
  danFirst.destroy();
  // A "Perfect release" can reach the hole: across the green window, at 1/60 s
  // hold steps and several seeds, perfect grades score three and never miss.
  const step = (s) => s.advance(1 / 60);
  // Every wait is bounded so a regression fails naming the missing transition
  // instead of hanging the suite.
  const maxFrames = 6000;
  const bounded = (frames, transition) =>
    assert.ok(frames < maxFrames, `${transition} never happened`);
  const throwBag = (s, player, held, shot, precision, land) => {
    const e = s.event;
    let frames = 0;
    while (!(e.state === 'aiming' && e.active().id === player)) {
      bounded(frames++, `${player} aiming`);
      step(s);
    }
    pulse(s, player, shot);
    if (precision) pulse(s, player, 'modifierRight');
    const before = e.bags.length;
    s.inject(player, 'charge', 1);
    step(s);
    advance(s, held);
    s.inject(player, 'charge', 0);
    let perfect, flight;
    frames = 0;
    while (e.bags.length === before) {
      bounded(frames++, `${player}'s bag landing`);
      step(s);
      if (perfect === undefined && e.state === 'throwing') perfect = e.perfect;
      if (!flight && e.flight) {
        land?.(e.flight);
        flight = { ...e.flight.target };
      }
    }
    return {
      contact: s.characters.find((c) => c.id === player).lastThrow?.contact,
      perfect,
      points: e.bags.at(-1).points,
      error: e.releasePower - e.ideal(),
      window: e.releaseWindow,
      flight,
    };
  };
  // A Hole runner is a slide shot: its window comes from the card's Slide skill.
  for (const [cardId, skill] of [
    ['card-doug', 0.9],
    ['card-dan', 0.72],
  ]) {
    const s = new ArenaSession({
      ...config('cornhole', false),
      players: config('cornhole', false).players.map((p, i) => ({
        ...p,
        cardId: i ? 'card-doug' : cardId,
      })),
    });
    const e = s.event;
    let frames = 0;
    while (e.state !== 'aiming') {
      bounded(frames++, `${cardId} first aiming`);
      step(s);
    }
    pulse(s, 'p0', 'primaryAction');
    const holeRunner = e.window();
    pulse(s, 'p0', 'secondaryAction');
    check(() => assert.equal(holeRunner, e.window(), cardId));
    check(() => assert.ok(Math.abs(holeRunner - (0.02 + skill / 30)) < 1e-12));
    s.destroy();
  }
  // Beyond two windows a miss lands exactly where it always has: 490 px per
  // unit of error along the board and 60 px toward its front, scatter aside.
  for (const held of [0.05, 0.18, 0.4, 1.4, 2]) {
    const s = new ArenaSession(config('cornhole', false, 2, 'old-miss')),
      shot = throwBag(s, 'p0', held, 'primaryAction', false),
      scatter = ((1 - 0.68) * 22) / 2;
    check(() => assert.ok(Math.abs(shot.error) > 2 * shot.window));
    check(() =>
      assert.ok(
        Math.abs(shot.flight.x - (hole.x + shot.error * 490)) <= scatter &&
          Math.abs(shot.flight.y - (hole.y + Math.abs(shot.error) * 60)) <=
            scatter,
        'A miss beyond two windows keeps the old landing: ' + held,
      ),
    );
    s.destroy();
  }
  for (const sweep of [
    {
      name: 'Doug Hole runner, bag 1',
      first: 'card-doug',
      shot: 'primaryAction',
      precision: false,
      bag: 1,
    },
    {
      name: 'Dan Roll + precision + clutch, bag 4',
      first: 'card-dan',
      shot: 'tertiaryAction',
      precision: true,
      bag: 4,
    },
  ]) {
    const perfect = [];
    for (let k = 0; k < 28; k++)
      for (let seed = 0; seed < 4; seed++) {
        const s = new ArenaSession({
          ...config('cornhole', false, 2, `perfect-sweep:${seed}`),
          players: config('cornhole', false).players.map((p, i) => ({
            ...p,
            cardId: i
              ? sweep.first === 'card-dan'
                ? 'card-doug'
                : 'card-dan'
              : sweep.first,
          })),
        });
        // Earlier bags are deliberate short taps that stay clear of the hole.
        for (let b = 1; b < sweep.bag; b++) {
          throwBag(s, 'p0', 0.05, sweep.shot, false);
          throwBag(s, 'p1', 0.05, 'primaryAction', false);
        }
        const shot = throwBag(
          s,
          'p0',
          0.85 + k / 60,
          sweep.shot,
          sweep.precision,
        );
        if (shot.perfect) perfect.push(shot.points);
        s.destroy();
      }
    check(() =>
      assert.ok(perfect.length >= 20, sweep.name + ' reaches the window'),
    );
    check(() =>
      assert.ok(
        perfect.every((n) => n === 3),
        sweep.name + ': perfect releases land in the hole',
      ),
    );
    check(() =>
      assert.ok(
        !perfect.includes(0),
        sweep.name + ': a perfect release never misses the board',
      ),
    );
  }
  // The live performance rig is told the real result of the thrower's own
  // throw: ArenaCharacter.lastThrow is written when the bag lands, from the
  // landed bag's final points (hole 3, board 1, otherwise a miss).
  const contactOf = (points) =>
    points === 3 ? 'hole' : points === 1 ? 'board' : 'miss';
  // Aim a throw at an exact spot; the landing rules still decide the result.
  const landAt = (p) => (f) => {
    f.target = { ...p };
  };
  let board;
  for (let dy = -30; dy <= 30 && !board; dy += 2)
    for (let dx = -60; dx <= 60 && !board; dx += 2) {
      const p = { x: hole.x + dx, y: hole.y + dy };
      if (Math.hypot(dx, dy) > 45 && bagPoints(p) === 1) board = p;
    }
  const faraway = { x: hole.x + 400, y: hole.y };
  check(() => assert.equal(bagPoints(hole), 3));
  check(() => assert.equal(bagPoints(board), 1));
  check(() => assert.equal(bagPoints(faraway), 0));
  const last = new ArenaSession(config('cornhole', false, 2, 'last-throw'));
  check(() =>
    assert.ok(
      last.characters.every((c) => c.lastThrow === undefined),
      'No throw yet, no recorded contact',
    ),
  );
  const [first, second] = last.characters;
  const aimed = (player, spot) =>
    throwBag(last, player, 0.3, 'primaryAction', false, landAt(spot));
  const inHole = aimed('p0', hole);
  check(() => assert.equal(inHole.points, 3));
  check(() => assert.equal(inHole.contact, contactOf(inHole.points)));
  check(() => assert.equal(inHole.contact, 'hole'));
  check(() => assert.equal(first.lastThrow.contact, 'hole'));
  check(() =>
    assert.equal(
      second.lastThrow,
      undefined,
      'A non-thrower has no recorded contact before their own throw',
    ),
  );
  const onBoard = aimed('p1', board);
  check(() => assert.equal(onBoard.points, 1));
  check(() => assert.equal(onBoard.contact, contactOf(onBoard.points)));
  check(() => assert.equal(onBoard.contact, 'board'));
  check(() => assert.equal(second.lastThrow.contact, 'board'));
  check(() =>
    assert.equal(
      first.lastThrow.contact,
      'hole',
      "Another player's throw leaves the contact alone",
    ),
  );
  const offBoard = aimed('p0', faraway);
  check(() => assert.equal(offBoard.points, 0));
  check(() => assert.equal(offBoard.contact, contactOf(offBoard.points)));
  check(() => assert.equal(offBoard.contact, 'miss'));
  check(() =>
    assert.equal(first.lastThrow.contact, 'miss', 'The next throw overwrites'),
  );
  check(() => assert.equal(second.lastThrow.contact, 'board'));
  last.destroy();
  // A roll that curls around a bag can end on 0 points while the thrower's
  // score still rises (the pushed old bag drops into the hole): still a miss.
  let curl;
  for (let dy = -40; dy <= 40 && !curl; dy += 1)
    for (let dx = -80; dx <= 80 && !curl; dx += 1) {
      const old = { x: hole.x + dx, y: hole.y + dy },
        d = Math.hypot(dx, dy),
        pushed = {
          x: old.x - (dx / d) * 12,
          y: old.y - (dy / d) * 12,
        },
        landed = { x: old.x + 4, y: old.y };
      if (
        d > 13 &&
        bagPoints(old) === 1 &&
        bagPoints(pushed) === 3 &&
        bagPoints(landed) === 1 &&
        bagPoints({ ...landed, y: landed.y + 16 }) === 0
      )
        curl = { old, landed };
    }
  if (curl) {
    const s = new ArenaSession(config('cornhole', false, 2, 'curl'));
    s.event.bags.push({
      id: 'old',
      owner: 'p0',
      ...curl.old,
      angle: 0,
      points: 1,
    });
    s.characters[0].score = 1;
    const shot = throwBag(
      s,
      'p0',
      0.3,
      'tertiaryAction',
      false,
      landAt(curl.landed),
    );
    check(() => assert.equal(s.event.shot, 'roll'));
    check(() =>
      assert.equal(shot.points, 0, 'The curled bag is off the board'),
    );
    check(() =>
      assert.equal(s.characters[0].score, 3, 'The pushed bag still scores'),
    );
    check(() => assert.equal(shot.contact, contactOf(shot.points)));
    check(() => assert.equal(shot.contact, 'miss'));
    s.destroy();
  }
  check(() => assert.ok(curl, 'a spot where a roll curls off the board'));
  // The AI's timing error is drawn once per throw from the session's seed: the
  // same seed plays the same match, and it is not always perfect.
  const aiMatch = (seed) => {
    const s = new ArenaSession(config('cornhole', true, 2, seed)),
      e = s.event,
      grades = [];
    let last = '';
    // A full AI match takes about 1,900 frames.
    for (let frames = 0; !s.snapshot().finished; frames++) {
      bounded(frames, `AI match ${seed} finishing`);
      step(s);
      if (e.state === 'throwing' && last !== 'throwing') grades.push(e.perfect);
      last = e.state;
    }
    const result = {
      grades,
      points: e.bags.map((b) => b.points),
      scores: s.characters.map((c) => c.score),
    };
    s.destroy();
    return result;
  };
  const aiMatches = ['ai-medium:0', 'ai-medium:1', 'ai-medium:2'].map(aiMatch);
  check(() =>
    assert.deepEqual(
      aiMatch('ai-medium:0'),
      aiMatches[0],
      'Same seed, same AI match',
    ),
  );
  check(() =>
    assert.ok(
      aiMatches.flatMap((m) => m.grades).includes(false),
      'The AI is not always perfect',
    ),
  );
  check(() =>
    assert.ok(
      aiMatches.flatMap((m) => m.grades).includes(true),
      'The AI still hits the window',
    ),
  );
  check(() =>
    assert.notDeepEqual(
      aiMatches[0].grades,
      aiMatches[1].grades,
      'Different seeds, different releases',
    ),
  );
  // B-15: a celebration never blocks the next move.
  const cheer = new ArenaSession(config('running', false));
  advance(cheer, 1.7);
  pulse(cheer, 'p0', 'celebrate');
  check(() => assert.match(cheer.snapshot().message, /celebrates/));
  pulse(cheer, 'p0', 'primaryAction');
  advance(cheer, 0.1);
  check(() =>
    assert.ok(cheer.characters[0].body.z > 0, 'Celebrate, then jump, jumps'),
  );
  cheer.destroy();
  const taunt = new ArenaSession(config('fighting', false));
  advance(taunt, 1.7);
  pulse(taunt, 'p0', 'celebrate');
  check(() => assert.match(taunt.snapshot().message, /taunts/));
  pulse(taunt, 'p0', 'primaryAction');
  check(() =>
    assert.equal(
      taunt.characters[0].substate,
      'attacking',
      'Taunt, then jab, attacks',
    ),
  );
  taunt.destroy();
  // B-17: lane depth follows the lane; B-29: a dodge never wraps.
  const lanes = new ArenaSession(config('running', false));
  advance(lanes, 1.7);
  for (let n = 0; n < 2; n++) {
    lanes.inject('p0', 'move', { x: 0, y: 1 });
    advance(lanes, 0.1);
    lanes.inject('p0', 'move', { x: 0, y: 0 });
    advance(lanes, 0.3);
  }
  advance(lanes, 0.6);
  const front = lanes.characters[0];
  check(() =>
    assert.ok(
      Math.abs(front.body.scale - laneScale(644)) < 0.002,
      'Two lane changes reach the front lane scale',
    ),
  );
  check(() =>
    assert.ok(
      Math.abs(front.body.scale - lanes.characters[1].body.scale) > 0.03,
    ),
  );
  // Free steering: adjacent lanes' obstacle hit bands tile with no seam.
  {
    const { obstacleCollision } =
      await import('../.test-build/engine/events/running/RunningPhysics.mjs');
    const at = (y, z = 0) => ({ body: { x: 500, y, z } });
    const motion = (slide = 0, ids = []) => ({ hits: new Set(ids), slide });
    for (const kind of ['hurdle', 'bar']) {
      const lane = (n) => ({
        id: kind + n,
        x: 500,
        y: 520 + n * 62,
        width: 36,
        height: 42,
        kind,
      });
      const [l0, l1, l2] = [lane(0), lane(1), lane(2)];
      const hit = (y, o) => obstacleCollision(at(y), o, motion());
      // [runner y, lane that must be hit, the other lane it sits between]
      for (const [y, want, other] of [
        [549.5, 0, 1],
        [550.5, 0, 1],
        [551.5, 1, 0],
        [612.5, 1, 2],
        [613.5, 2, 1],
      ])
        check(() => {
          const lanes = [l0, l1, l2];
          assert.deepEqual(
            [hit(y, lanes[want]), hit(y, lanes[other])],
            [true, false],
            kind + ' at y ' + y + ' hits exactly one lane',
          );
        });
      check(() => assert.equal(hit(551.5, l0), false));
      for (const y of [489, 675])
        check(() =>
          assert.deepEqual(
            [hit(y, l0), hit(y, l1), hit(y, l2)].includes(true),
            false,
          ),
        );
    }
    const hurdle = {
      id: 'h',
      x: 500,
      y: 520,
      width: 36,
      height: 42,
      kind: 'hurdle',
    };
    const bar = { ...hurdle, id: 'b', kind: 'bar' };
    check(() =>
      assert.equal(obstacleCollision(at(520, 0), hurdle, motion()), true),
    );
    check(() =>
      assert.equal(obstacleCollision(at(520, 42), hurdle, motion()), false),
    );
    check(() =>
      assert.equal(obstacleCollision(at(520, 60), bar, motion(0)), true),
    );
    check(() =>
      assert.equal(obstacleCollision(at(520, 0), bar, motion(0.4)), false),
    );
    check(() =>
      assert.equal(
        obstacleCollision(at(520, 0), hurdle, motion(0, ['h'])),
        false,
      ),
    );
  }
  pulse(lanes, 'p0', 'tertiaryAction');
  advance(lanes, 0.8);
  check(() =>
    assert.ok(
      Math.abs(front.body.y - 582) < 3,
      'Dodging from the front lane moves back one lane',
    ),
  );
  lanes.destroy();
  // B-29: braking stops sprint drain; a sprint leaves enough for a jump;
  // progress is never negative.
  const brake = new ArenaSession(config('running', false, 4));
  check(() =>
    assert.ok(brake.characters.every((c) => c.score >= 0), 'No negative progress'),
  );
  advance(brake, 1.7);
  brake.characters[0].stamina = 60;
  brake.inject('p0', 'charge', 1);
  brake.inject('p0', 'modifierLeft', 1);
  advance(brake, 1);
  check(() =>
    assert.ok(brake.characters[0].stamina >= 60, 'Braking stops sprint drain'),
  );
  brake.inject('p0', 'modifierLeft', 0);
  brake.characters[0].stamina = 12;
  advance(brake, 0.5);
  check(() => assert.ok(brake.characters[0].body.x < 450, 'before the hurdles'));
  check(() =>
    assert.ok(brake.characters[0].stamina >= 8, 'A sprint leaves a jump'),
  );
  check(() => assert.ok(brake.characters.every((c) => c.score >= 0)));
  brake.destroy();
  // B-29: in free steering nothing creeps forward without a push.
  const freeRun = new ArenaSession({
    ...config('running', false),
    options: { movement: 'free' },
  });
  advance(freeRun, 1.7);
  freeRun.inject('p0', 'modifierLeft', 1);
  advance(freeRun, 2);
  check(() =>
    assert.ok(
      Math.abs(freeRun.characters[0].body.vx) < 1,
      'A brake with no push holds still',
    ),
  );
  freeRun.destroy();
  // B-29: a dead heat is shared.
  const heat = new ArenaSession(config('running', false));
  heat.event.state = 'finished';
  for (const m of heat.event.motions.values()) m.finished = 12.5;
  check(() => assert.equal(heat.event.resolveOutcome().winners.length, 2));
  heat.destroy();
  // B-28: the grapple no longer pays for a counter stance; the time limit
  // counts from the end of the entrance; the direction special is stronger.
  const grab = new ArenaSession(config('fighting', false));
  advance(grab, 1.7);
  grab.characters[0].body.x = 500;
  grab.characters[1].body.x = 580;
  grab.inject('p0', 'modifierRight', 1);
  grab.inject('p0', 'primaryAction', 1);
  grab.inject('p0', 'primaryAction', 0);
  grab.inject('p0', 'modifierRight', 0);
  grab.advance(1 / 60);
  check(() => assert.equal(grab.controllers[0].lastCommand, 'grapple'));
  check(() =>
    assert.ok(
      grab.characters[0].stamina >= 84 - 1,
      'A grapple costs only its own energy',
    ),
  );
  grab.destroy();
  const limit = new ArenaSession(config('fighting', false));
  advance(limit, 60.5);
  check(() =>
    assert.equal(limit.snapshot().finished, false, 'The entrance is not fight time'),
  );
  advance(limit, 1.3);
  check(() => assert.equal(limit.snapshot().finished, true));
  check(() => assert.equal(limit.snapshot().message, 'Draw'));
  // B-30: a finished match stays on its result; the pause key does nothing.
  limit.inject('p0', 'pause', 1);
  limit.advance(1 / 60);
  limit.inject('p0', 'pause', 0);
  limit.advance(1 / 60);
  check(() => assert.equal(limit.paused, false, 'No pause over a result'));
  limit.destroy();
  check(() =>
    assert.equal(
      FightingActionMap.combos.find((c) => c.id === 'direction-special')
        .command,
      'chargedSpecial',
    ),
  );
  check(() => assert.ok(ATTACKS.chargedSpecial.damage > ATTACKS.special.damage));
  // A pause pressed mid-step cancels that step, so the clock stays with the
  // steps that actually ran.
  const clock = new ArenaSession(config('running', false));
  advance(clock, 1);
  for (let i = 0; i < 3; i++) {
    clock.inject('p0', 'pause', 1);
    clock.advance(1 / 60);
    clock.inject('p0', 'pause', 0);
    clock.advance(1 / 60);
    clock.pause(false);
    advance(clock, 0.2);
  }
  check(() =>
    assert.ok(
      Math.abs(clock.time - clock.debugSnapshot().fixedSteps / 60) < 1e-9,
      'A button pause does not advance the clock',
    ),
  );
  clock.destroy();
  // A runner who crosses the line mid-jump still lands.
  const { RUNNING_LENGTH } =
    await import('../.test-build/engine/events/running/RunningPhysics.mjs');
  for (const both of [false, true]) {
    const leap = new ArenaSession(config('running', false));
    advance(leap, 1.7);
    for (const c of both ? leap.characters : leap.characters.slice(0, 1)) {
      c.body.x = RUNNING_LENGTH - 1;
      c.body.z = 40;
      c.body.vz = 200;
    }
    advance(leap, 2);
    check(() =>
      assert.ok(leap.event.motions.get('p0').finished, 'The runner finished'),
    );
    check(() =>
      assert.deepEqual(
        [leap.characters[0].body.z, leap.characters[0].body.vz],
        [0, 0],
        both ? 'Lands after the race ends' : 'Lands after finishing',
      ),
    );
    leap.destroy();
  }
  // A grapple out of a counter stance counts the stance's refund toward its
  // cost, and one it cannot afford leaves the stance in place.
  const stance = new ArenaSession(config('fighting', false));
  advance(stance, 1.7);
  const guard = stance.event.components.get('p0');
  guard.counterUntil = stance.time + 0.5;
  stance.characters[0].stamina = 2;
  check(() => assert.equal(guard.perform('grapple'), false));
  check(() => assert.equal(stance.characters[0].stamina, 2));
  check(() =>
    assert.ok(guard.counterUntil > stance.time, 'A failed grapple keeps the stance'),
  );
  stance.characters[0].stamina = 4;
  check(() => assert.equal(guard.perform('grapple'), true));
  check(() => assert.equal(stance.characters[0].stamina, 0));
  check(() => assert.equal(guard.counterUntil, 0));
  stance.destroy();
  // Two keyboard layouts may not share a key, whichever way it got there.
  const { bindingsConflict } =
    await import('../.test-build/engine/input/InputBindings.mjs');
  const layouts = [
    { layout: 0, keys: bindingsFor(0).keys },
    { layout: 1, keys: bindingsFor(1).keys },
  ];
  check(() => assert.equal(bindingsConflict(layouts), undefined));
  check(() =>
    assert.deepEqual(
      bindingsConflict([
        { layout: 0, keys: { ...bindingsFor(0).keys, primaryAction: 'Numpad5' } },
        layouts[1],
      ]),
      {
        player: 0,
        intent: 'primaryAction',
        code: 'Numpad5',
        other: 1,
        use: 'aim',
      },
    ),
  );
  // An action key does not replay a held direction after it is released.
  const { KeyboardDevice } =
    await import('../.test-build/engine/input/KeyboardDevice.mjs');
  const saved = { window: globalThis.window, document: globalThis.document };
  const listeners = {};
  globalThis.window = {
    addEventListener: (type, f) => (listeners[type] = f),
    removeEventListener: (type) => delete listeners[type],
  };
  globalThis.document = { activeElement: null };
  const keyboard = new KeyboardDevice('kb', bindingsFor(0), 0, {
    contains: () => true,
  });
  const key = (type, code) =>
    listeners[type]({ code, repeat: false, target: {}, preventDefault() {} });
  const dodge = bindingsFor(0).keys.tertiaryAction;
  key('keydown', 'KeyD');
  check(() => assert.deepEqual(keyboard.poll(0).values.move, { x: 1, y: 0 }));
  key('keydown', dodge);
  key('keyup', 'KeyD');
  const ghost = keyboard.poll(1 / 60).values;
  check(() => assert.deepEqual(ghost.move, { x: 0, y: 0 }, 'No ghost move'));
  check(() => assert.ok(!ghost.aim?.x && !ghost.aim?.y, 'No ghost aim'));
  check(() => assert.equal(ghost.tertiaryAction, 1));
  key('keyup', dodge);
  key('keydown', 'KeyA');
  key('keyup', 'KeyA');
  check(() =>
    assert.deepEqual(
      keyboard.poll(2 / 60).values.move,
      { x: -1, y: 0 },
      'A tap inside one step still registers',
    ),
  );
  // Auto-repeat of a held key is kept from scrolling the page without being
  // recorded again as a fresh tap.
  const repeat = (type, code, extra = {}) => {
    let prevented = 0;
    listeners[type]({
      code,
      repeat: true,
      target: {},
      preventDefault: () => prevented++,
      ...extra,
    });
    return prevented;
  };
  key('keydown', 'ArrowDown');
  check(() =>
    assert.deepEqual(keyboard.poll(3 / 60).values.aim, { x: 0, y: 1 }),
  );
  check(() =>
    assert.equal(repeat('keydown', 'ArrowDown'), 1, 'Held key is prevented'),
  );
  check(() =>
    assert.deepEqual(
      keyboard.poll(4 / 60).values.aim,
      { x: 0, y: 1 },
      'Repeat leaves the held aim unchanged',
    ),
  );
  key('keyup', 'ArrowDown');
  check(() =>
    assert.ok(
      !keyboard.poll(5 / 60).values.aim?.y,
      'Repeat is not replayed as a tap after release',
    ),
  );
  check(() =>
    assert.equal(
      repeat('keydown', 'ArrowUp'),
      0,
      'A key never pressed through the device is not prevented',
    ),
  );
  key('keydown', 'KeyD');
  check(() =>
    assert.equal(
      repeat('keydown', 'KeyD', { target: { tagName: 'INPUT' } }),
      0,
      'A held key repeating inside a text field is not prevented',
    ),
  );
  check(() => assert.equal(repeat('keydown', 'KeyD'), 1));
  listeners.blur();
  check(() =>
    assert.equal(
      repeat('keydown', 'KeyD'),
      0,
      'A repeat after blur is not prevented',
    ),
  );
  key('keydown', 'KeyD');
  check(() =>
    assert.equal(
      repeat('keydown', 'KeyZ'),
      0,
      'A key outside the bindings is not prevented',
    ),
  );
  key('keyup', 'KeyD');
  keyboard.destroy();
  const outside = new KeyboardDevice('kb-outside', bindingsFor(0), 0, {
    contains: () => false,
  });
  key('keydown', 'KeyD');
  check(() =>
    assert.equal(
      repeat('keydown', 'KeyD'),
      0,
      'A repeat outside the arena scope is not prevented',
    ),
  );
  outside.destroy();
  Object.assign(globalThis, saved);
  fs.mkdirSync('docs/review', { recursive: true });
  fs.writeFileSync(
    'docs/review/live-engine-tests.json',
    JSON.stringify(
      {
        referenceEvents: outcomes,
        hardware:
          'Gamepad input and haptics contracts are tested with synthetic snapshots; physical devices need hardware verification.',
        proofs: [
          'semantic input parity',
          'charging changes outcomes',
          'four player infrastructure',
          'continuous acceleration and jumping',
          'combat active windows',
          'blocking',
          'input buffering and expiry',
          'hit-stop holds the clock without dropping input',
          'deterministic AI sessions',
          'pause',
        ],
      },
      null,
      2,
    ),
  );
}
