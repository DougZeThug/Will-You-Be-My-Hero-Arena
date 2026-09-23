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
