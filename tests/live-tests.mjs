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
          'deterministic AI sessions',
          'pause',
        ],
      },
      null,
      2,
    ),
  );
}
