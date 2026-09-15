import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
export async function testMotionV3({ check }) {
  const { matchStride, gaitSupport } =
    await import('../.test-build/engine/motion/StrideMatcher.mjs');
  const { MotionContacts } =
    await import('../.test-build/engine/motion/MotionContacts.mjs');
  const { CharacterProximity } =
    await import('../.test-build/engine/movement/CharacterProximity.mjs');
  const { advanceBasketball } =
    await import('../.test-build/engine/physics/BasketballFlight.mjs');
  const { AttachmentManager } =
    await import('../.test-build/engine/equipment/AttachmentManager.mjs');
  const clips = [
    ['walk', 76, 1.05],
    ['jog', 112, 0.84],
    ['run', 143, 0.73],
    ['sprint', 170, 0.66],
  ].map(([id, stride, duration]) => ({
    id,
    stride,
    duration,
    gait: { stance: 0.43 },
  }));
  for (const scale of [0.7, 1, 1.02])
    for (let speed = 25; speed <= 230; speed += 5) {
      const fit = matchStride(speed, clips, scale);
      check(() =>
        assert.ok(fit.error < 1e-6, 'Feasible speed must match cycle travel'),
      );
      check(() =>
        assert.ok(
          fit.rate >= 0.5 &&
            fit.rate <= 1.18 &&
            fit.reachScale >= 0.35 &&
            fit.reachScale <= 1.18,
        ),
      );
    }
  check(() => assert.deepEqual(gaitSupport(0.45, 0.43), []));
  check(() => assert.deepEqual(gaitSupport(0.55, 0.43), ['left']));
  check(() => assert.deepEqual(gaitSupport(0.05, 0.6), ['right', 'left']));
  const contacts = new MotionContacts();
  const event = (name, time, foot) => ({
    name,
    time,
    foot,
    at: 0,
    cycle: 0,
    clip: 'test',
  });
  contacts.update(
    0.01,
    [event('land', 1), event('footPlant', 1, 'right')],
    330,
  );
  check(() => assert.equal(contacts.compression, 0));
  contacts.update(0.085, []);
  check(() => assert.ok(contacts.compression > 9 && contacts.compression < 11));
  contacts.update(0.8, []);
  check(() => assert.ok(contacts.compression < 0.1));
  check(() =>
    assert.ok(
      contacts.snapshot().active.some((c) => c.contact === 'rightFoot'),
    ),
  );
  contacts.update(0.01, [event('footRelease', 2, 'right')]);
  check(() => assert.equal(contacts.snapshot().active.length, 0));
  contacts.signal('hitContact', 2, 'body', true);
  contacts.update(0.01, [event('noop', 2.01)]);
  check(() =>
    assert.ok(contacts.snapshot().active.some((c) => c.contact === 'body')),
  );
  contacts.update(0.2, []);
  check(() => assert.equal(contacts.snapshot().active.length, 0));
  const body = (id, x, y = 0) => ({
    id,
    position: { x, y },
    radius: 49,
    depthRadius: 29,
    height: 290,
  });
  const proximity = new CharacterProximity();
  for (const distance of [100, 200, 1000]) {
    const result = proximity.sweep('a', { x: 0, y: 0 }, { x: distance, y: 0 }, [
      body('a', 0),
      body('b', 120),
    ]);
    check(() =>
      assert.ok(
        result.position.x <= 22.001 && result.blockedX,
        'Swept body cannot tunnel through opponent',
      ),
    );
  }
  check(() =>
    assert.equal(
      proximity.sweep('a', { x: 0, y: 70 }, { x: 250, y: 70 }, [
        body('a', 0, 70),
        body('b', 120),
      ]).position.x,
      250,
    ),
  );
  check(() =>
    assert.equal(
      proximity.sweep('a', { x: 22, y: 0 }, { x: -50, y: 0 }, [
        body('a', 22),
        body('b', 120),
      ]).position.x,
      -50,
    ),
  );
  const makeBall = () => ({
    position: { x: 0, y: 0 },
    velocity: { x: 100, y: -100 },
    gravity: { x: 0, y: 200 },
    age: 0,
  });
  const outcomes = [30, 60, 120].map((hz) => {
    const b = makeBall();
    let hit = false;
    for (let k = 0; k < hz * 2; k++) {
      b.age += 1 / hz;
      const result = advanceBasketball(b, 1 / hz, { x: 100, y: 0 }, 4);
      hit ||= result === 'score';
    }
    return { ...b, hit };
  });
  for (const b of outcomes) {
    check(() => assert.ok(b.hit));
    check(() => assert.equal(b.velocity.x, 100));
  }
  for (const b of outcomes)
    check(() =>
      assert.ok(
        Math.abs(b.position.x - 200) < 1e-9 &&
          Math.abs(b.position.y - 200) < 1e-9,
      ),
    );
  const miss = makeBall();
  let scored = false;
  for (let k = 0; k < 240; k++) {
    miss.age += 1 / 120;
    scored ||=
      advanceBasketball(miss, 1 / 120, { x: 250, y: 0 }, 4) === 'score';
  }
  check(() => assert.equal(scored, false));
  let now = 2;
  const interactions = [];
  const held = new AttachmentManager(
    () => now,
    (e) => interactions.push(e),
  );
  held.attach('ball', 'twoHandGrip');
  for (let i = 0; i < 8; i++) {
    now += 1 / 120;
    held.sampleAnchors(
      {
        twoHandGrip: { x: now * 80, y: now * -40, angle: 0.2 },
        rightHand: { x: 999, y: 999, angle: 0 },
      },
      now,
    );
  }
  const release = held.release();
  check(() =>
    assert.ok(
      Math.abs(release.velocity.x - 80) < 1e-6 &&
        Math.abs(release.velocity.y + 40) < 1e-6,
    ),
  );
  check(() => assert.equal(release.x, now * 80));
  check(() => assert.equal(interactions[0].time, 2));
  check(() => assert.equal(interactions.at(-1).time, now));
  check(() => assert.throws(() => held.transfer('leftHand'), /possession/));
  held.attach('ball');
  held.transfer('leftHand');
  check(() => assert.equal(held.snapshot().anchor, 'leftHand'));
  // Evaluate Phaser's ALREADY bundled Matter primitives without a renderer or a new engine.
  const require = createRequire(import.meta.url),
    Matter = require('../node_modules/phaser/src/physics/matter-js/CustomMain.js');
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } }),
    wall = Matter.Bodies.rectangle(150, 0, 20, 200, { isStatic: true }),
    player = Matter.Bodies.circle(0, 0, 30, { frictionAir: 0 });
  Matter.Composite.add(engine.world, [wall, player]);
  Matter.Body.setVelocity(player, { x: 4, y: 0 });
  for (let i = 0; i < 120; i++) Matter.Engine.update(engine, 1000 / 120);
  check(() =>
    assert.ok(
      player.position.x < 111,
      'Bundled Matter resolves basic character/obstacle collision',
    ),
  );
  Matter.Body.applyForce(player, player.position, { x: -0.02, y: 0 });
  Matter.Engine.update(engine, 1000 / 120);
  check(() =>
    assert.ok(player.velocity.x < 0, 'Bundled Matter supplies impulses'),
  );
  Matter.Engine.clear(engine);
}
