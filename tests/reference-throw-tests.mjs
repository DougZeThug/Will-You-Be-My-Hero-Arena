import assert from 'node:assert/strict';
export async function testReferenceThrow({ check }) {
  const { AttachmentManager } =
    await import('../.test-build/engine/equipment/AttachmentManager.mjs');
  const { sampleRoot } =
    await import('../.test-build/engine/motion/RootCurve.mjs');
  const { advanceBag, bagContact } =
    await import('../.test-build/engine/events/cornhole/ScreenBagDynamics.mjs');
  for (const dt of [1 / 60, 1 / 120, 1 / 144]) {
    const a = new AttachmentManager();
    a.attach('bag');
    for (let i = 0; i < 9; i++) {
      const t = i * dt;
      a.sample({
        time: t,
        x: 300 * t - 1200 * t * t,
        y: -400 * t + 700 * t * t,
        angle: t,
      });
    }
    const r = a.release(),
      t = 8 * dt;
    check(() =>
      assert.ok(
        Math.abs(r.velocity.x - (300 - 2400 * t)) < 1e-6,
        'Release derivative belongs to the newest frame, not middle of history',
      ),
    );
    check(() => assert.ok(Math.abs(r.velocity.y - (-400 + 1400 * t)) < 1e-6));
  }
  const points = [
    { at: 0, x: 0, y: 0 },
    { at: 1, x: 4, y: 0 },
    { at: 2, x: 9, y: 0 },
    { at: 3, x: 0, y: 0 },
  ];
  const e = 1e-5,
    left = (sampleRoot(points, 1).x - sampleRoot(points, 1 - e).x) / e,
    right = (sampleRoot(points, 1 + e).x - sampleRoot(points, 1).x) / e;
  check(() =>
    assert.ok(
      left > 1 && Math.abs(left - right) < 0.001,
      'Root does not stop at a monotone breakdown',
    ),
  );
  for (let t = 0; t < 3; t += 0.01)
    check(() =>
      assert.ok(sampleRoot(points, t).x >= 0 && sampleRoot(points, t).x <= 9),
    );
  const make = (x, y, vx, vy) => ({
    position: { x, y },
    velocity: { x: vx, y: vy },
    gravity: { x: 0, y: 940 },
    angle: 0,
    landed: false,
    scored: false,
    contact: bagContact(0, 'flat'),
  });
  const bag = make(323, 415, 563, -405),
    initial = { ...bag.position };
  advanceBag(bag, 0.1);
  check(() => assert.ok(Math.abs(bag.position.x - (initial.x + 56.3)) < 1e-8));
  check(() => assert.equal(bag.velocity.x, 563));
  const phases = new Set(),
    speeds = [];
  let compression = 0,
    maxContactStep = 0,
    old = { ...bag.position };
  for (let i = 0; i < 480; i++) {
    advanceBag(bag, 1 / 120);
    phases.add(bag.contact.phase);
    compression = Math.max(compression, bag.contact.compression);
    if (bag.contact.phase === 'board') {
      speeds.push(Math.abs(bag.contact.tangentSpeed));
      maxContactStep = Math.max(
        maxContactStep,
        Math.hypot(bag.position.x - old.x, bag.position.y - old.y),
      );
    }
    old = { ...bag.position };
  }
  check(() => assert.ok(phases.has('board') && phases.has('hole')));
  check(() => assert.ok(compression > 0.1 && maxContactStep < 8));
  check(() =>
    assert.ok(speeds.every((v, i) => !i || v <= speeds[i - 1] + 1e-6)),
  );
  check(() => assert.equal(bag.contact.result, 'hole'));
  const settled = structuredClone(bag);
  advanceBag(bag, 1);
  check(() => assert.deepEqual(bag, settled));
  const miss = make(323, 415, 220, -250);
  for (let i = 0; i < 480; i++) advanceBag(miss, 1 / 120);
  check(() =>
    assert.equal(
      miss.contact.result,
      'miss',
      'A weak launch must not be steered onto the board',
    ),
  );
  check(() => assert.equal(miss.scored, false));
}
