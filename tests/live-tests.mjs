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
  limit.destroy();
  check(() =>
    assert.equal(
      FightingActionMap.combos.find((c) => c.id === 'direction-special')
        .command,
      'chargedSpecial',
    ),
  );
  check(() => assert.ok(ATTACKS.chargedSpecial.damage > ATTACKS.special.damage));
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
