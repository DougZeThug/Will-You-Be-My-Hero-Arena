import assert from 'node:assert/strict';

/** Smoothness contracts: continuity of motion at every hand-off the player can
 * see (bag release, knee reach, clip seams, fixed-step presentation). */
export async function testAnimationSmoothness({ check }) {
  const { ballisticFlight } =
    await import('../.test-build/engine/events/cornhole/ReleasedBagPhysics.mjs');
  const { softReach, softReachDrop, SOFT_REACH_MAX, SOFT_REACH_START } =
    await import('../.test-build/engine/performance/KneeReach.mjs');

  // Bag flight: exact landing, continuous release, ballistic after the blend,
  // bounded gravity and a velocity blend that never reverses.
  const cases = [
    { v: { x: 900, y: -420 }, d: { x: 640, y: 40 }, air: 0.97 },
    { v: { x: 300, y: -120 }, d: { x: 610, y: 60 }, air: 0.97 },
    { v: { x: 1600, y: -700 }, d: { x: 700, y: 10 }, air: 1.1 },
    { v: { x: 650, y: 80 }, d: { x: 520, y: 70 }, air: 0.6 },
  ];
  for (const c of cases) {
    const release = { x: 200, y: 400, scale: 1 },
      touch = { x: release.x + c.d.x, y: release.y + c.d.y },
      f = ballisticFlight(release, c.v, touch, c.air),
      h = 1e-4;
    const start = f.at(0),
      end = f.at(c.air);
    check(() => assert.ok(Math.hypot(start.x - 200, start.y - 400) < 1e-9));
    check(() =>
      assert.ok(
        Math.hypot(end.x - touch.x, end.y - touch.y) < 1e-6,
        'lands exactly on the recorded touch point',
      ),
    );
    check(() =>
      assert.ok(
        Math.hypot(start.vx - c.v.x, start.vy - c.v.y) < 1e-9,
        'leaves the hand at the hand velocity',
      ),
    );
    const numeric = { x: (f.at(h).x - start.x) / h, y: (f.at(h).y - start.y) / h };
    check(() =>
      assert.ok(Math.hypot(numeric.x - c.v.x, numeric.y - c.v.y) < 0.5),
    );
    // After the blend: constant horizontal velocity, vertical acceleration g.
    for (const t of [f.tau + 0.01, (f.tau + c.air) / 2, c.air - 0.02]) {
      const a = f.at(t - h),
        b = f.at(t),
        e = f.at(t + h);
      check(() => assert.ok(Math.abs((e.x - 2 * b.x + a.x) / (h * h)) < 1e-2));
      check(() =>
        assert.ok(
          Math.abs((e.y - 2 * b.y + a.y) / (h * h) - f.gravity) < 1e-2,
        ),
      );
    }
    const g0 = 9.8 * 78;
    check(() =>
      assert.ok(f.gravity >= 0.7 * g0 - 1e-9 && f.gravity <= 1.5 * g0 + 1e-9),
    );
    // Monotone blend: horizontal velocity moves toward cruise without overshoot.
    let previous = c.v.x;
    for (let t = 0; t <= f.tau + 1e-9; t += f.tau / 30) {
      const vx = f.at(t).vx,
        toward = Math.sign(f.cruise.x - c.v.x);
      check(() => assert.ok((vx - previous) * toward >= -1e-9));
      previous = vx;
    }
  }

  // Take contract: shipped takes validate; optional footwork must match the
  // grid; times and the release land on 60 Hz frames.
  const { validateTake } =
    await import('../.test-build/engine/performance/TakeValidation.mjs');
  for (const id of ['dan', 'doug']) {
    const take = (
      await import(`../.test-build/engine/performance/takes/${id}-underhand.mjs`)
    ).default;
    check(() => assert.doesNotThrow(() => validateTake(take)));
    check(() => assert.equal(take.provenance.kind, 'authored'));
    const zeros = take.times.map(() => 0);
    check(() =>
      assert.doesNotThrow(() =>
        validateTake({ ...take, channels: { ...take.channels, frontFootX: zeros } }),
      ),
    );
    check(() =>
      assert.throws(() =>
        validateTake({ ...take, channels: { ...take.channels, backFootY: [0] } }),
      ),
    );
    check(() =>
      assert.throws(() =>
        validateTake({ ...take, times: take.times.map((t, i) => (i === 3 ? t + 0.004 : t)) }),
      ),
    );
  }

  // Squash & stretch: silent outside the pulse, no pop at either end, capped,
  // volume-preserving, and a pure function of time (seek/pause safe).
  const { squashOffset, squashScale, velocityStretch, MAX_SQUASH } =
    await import('../.test-build/engine/motion/SquashStretch.mjs');
  const pulse = [{ at: 1, amount: -0.16, settle: 0.3, frequency: 4 }];
  check(() => assert.equal(squashOffset(pulse, 0.99), 0));
  check(() => assert.equal(squashOffset(pulse, 1), 0));
  check(() => assert.equal(squashOffset(pulse, 1.3), 0));
  check(() => assert.equal(squashOffset(pulse, 1.31), 0));
  check(() => assert.ok(Math.abs(squashOffset(pulse, 1.299)) < 1e-3));
  let peak = 0,
    step = 0,
    last = 0;
  for (let t = 0.95; t <= 1.35; t += 1 / 240) {
    const o = squashOffset(pulse, t);
    peak = Math.min(peak, o);
    step = Math.max(step, Math.abs(o - last));
    last = o;
    check(() => assert.equal(squashOffset(pulse, t), o));
  }
  check(() => assert.ok(peak < -0.1, 'the landing squash reads'));
  check(() => assert.ok(step < 0.05, 'no single-frame scale pop'));
  const stacked = Array.from({ length: 6 }, () => pulse[0]);
  for (let t = 1; t <= 1.3; t += 0.01)
    check(() => assert.ok(Math.abs(squashOffset(stacked, t)) <= MAX_SQUASH));
  for (const o of [-0.2, -0.1, 0, 0.12, 0.2]) {
    const q = squashScale(o);
    check(() => assert.ok(Math.abs(q.x * q.x * q.y - 1) < 1e-12));
  }
  check(() => assert.deepEqual(squashScale(0), { x: 1, y: 1 }));
  const fast = velocityStretch(5000, 900, 0.35);
  check(() => assert.ok(fast.along <= 1.35 + 1e-12));
  check(() => assert.ok(Math.abs(fast.along * fast.across ** 2 - 1) < 1e-12));

  // View angle: profile for travel and exchanges, front for camera-facing
  // beats; a turn closes one drawing to edge-on before the other opens.
  const { chooseView, viewWidths } =
    await import('../.test-build/engine/characters/CharacterView.mjs');
  check(() => assert.equal(chooseView({ substate: 'ready' }), 'front'));
  check(() => assert.equal(chooseView({ substate: 'finished' }), 'front'));
  for (const substate of ['running', 'sprinting', 'airborne', 'neutral', 'attacking', 'hitstun'])
    check(() => assert.equal(chooseView({ substate }), 'side'));
  check(() => assert.deepEqual(viewWidths(0), { side: 1, front: 0 }));
  check(() => assert.deepEqual(viewWidths(1), { side: 0, front: 1 }));
  let lastSide = 1,
    lastFront = 0;
  for (let f = 0; f <= 1.0001; f += 0.02) {
    const w = viewWidths(f);
    check(() => assert.ok(w.side === 0 || w.front === 0, 'one drawing at a time'));
    check(() => assert.ok(w.side <= lastSide + 1e-12 && w.front >= lastFront - 1e-12));
    lastSide = w.side;
    lastFront = w.front;
  }

  // Frontal knees: a bent knee foreshortens toward the camera instead of
  // bowing sideways; hip and ankle are unchanged.
  const { frontLeg, solveLimb, FRONT_KNEE_SPLAY } =
    await import('../.test-build/puppet-geometry.mjs');
  for (const hipY of [-190, -170, -150]) {
    const hip = { x: -23, y: hipY },
      foot = { x: -40, y: -22 },
      full = solveLimb(hip, foot, 90, 88, 1),
      leg = frontLeg(hip, foot, 90, 88, 1);
    check(() => assert.deepEqual(leg.end, full.end));
    const lateral = (j) => {
      const dx = foot.x - hip.x,
        dy = foot.y - hip.y,
        n = Math.hypot(dx, dy);
      return ((j.x - hip.x) * dy - (j.y - hip.y) * dx) / n;
    };
    check(() =>
      assert.ok(
        Math.abs(lateral(leg.joint) - FRONT_KNEE_SPLAY * lateral(full.joint)) < 1e-9,
      ),
    );
  }

  // Soft reach: identity below the start, C1 at the start, bounded above.
  check(() => assert.equal(softReach(0.9), 0.9));
  check(() => assert.equal(softReach(SOFT_REACH_START), SOFT_REACH_START));
  const e = 1e-6,
    slope =
      (softReach(SOFT_REACH_START + e) - softReach(SOFT_REACH_START)) / e;
  check(() => assert.ok(Math.abs(slope - 1) < 1e-3));
  for (const r of [0.97, 0.99, 1, 1.05, 2])
    check(() => assert.ok(softReach(r) <= SOFT_REACH_MAX && softReach(r) <= r));
  // Nearly straight bind legs (the side-v3 rigs) get lowered, planted feet
  // stay fixed, and the knee response is gradual instead of a pop.
  const leg = (hipY) => [
    { hip: { x: -40, y: hipY }, ankle: { x: -128, y: -69 }, length: 475.2 },
    { hip: { x: 43, y: hipY - 4 }, ankle: { x: 72.5, y: -77 }, length: 463.6 },
  ];
  const kneeBend = (a, b, d) =>
    180 -
    (Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b)))) *
      180) /
      Math.PI;
  const bends = [];
  for (let drop = -10; drop <= 30; drop += 1) {
    const legs = leg(-535 + drop),
      extra = softReachDrop(legs),
      hip = { x: -40, y: -535 + drop + extra },
      d = Math.hypot(hip.x + 128, -69 - hip.y);
    check(() => assert.ok(d / 475.2 <= SOFT_REACH_MAX + 1e-9));
    bends.push(kneeBend(167.6, 307.6, d));
  }
  const worst = Math.max(
    ...bends.slice(1).map((b, i) => Math.abs(b - bends[i])),
  );
  check(() =>
    assert.ok(worst < 3, `knee changes ${worst.toFixed(2)}° per rig px`),
  );
}
