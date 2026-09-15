import assert from 'node:assert/strict';
export async function testPerformanceUpgrade({ check }) {
  const { rolledAnkle, contactRoll } =
    await import('../.test-build/engine/motion/FootContactRoll.mjs');
  const { CombatIntentRhythm } =
    await import('../.test-build/engine/motion/CombatIntentRhythm.mjs');
  // The visible support point must stay fixed while the ankle rolls in either facing.
  for (const facing of [-1, 1])
    for (const degrees of [-8, -4, 0, 6, 16, 24]) {
      const a = { x: 420, y: 600 },
        p = { x: (degrees < 0 ? -14 : 36) * facing, y: 18 };
      const r = contactRoll((degrees * Math.PI) / 180).radians * facing;
      const ankle = rolledAnkle(a, p, r);
      const contact = {
        x: ankle.x + p.x * Math.cos(r) - p.y * Math.sin(r),
        y: ankle.y + p.x * Math.sin(r) + p.y * Math.cos(r),
      };
      check(() =>
        assert.ok(
          Math.hypot(contact.x - a.x - p.x, contact.y - a.y - p.y) < 1e-9,
        ),
      );
    }
  check(() => assert.equal(contactRoll(10).region, 'forefoot'));
  check(() => assert.ok(contactRoll(10).radians <= (24 * Math.PI) / 180));
  const trace = (seed, first) => {
    const rhythm = new CombatIntentRhythm(seed, first),
      pulses = [];
    let last = '';
    for (let f = 0; f < 1200; f++) {
      const value = rhythm.sample(f / 120, true, false, 100);
      if (value && value !== last) pulses.push({ frame: f, value });
      last = value;
    }
    return pulses;
  };
  check(() => assert.deepEqual(trace(7041, 0.24), trace(7041, 0.24)));
  check(() => assert.notDeepEqual(trace(7041, 0.24), trace(1702, 0.63)));
  check(() => assert.ok(trace(7041, 0.24).length >= 7));
  const blocked = new CombatIntentRhythm(1, 0);
  check(() => assert.equal(blocked.sample(1, false, true, 100), ''));
  check(() => assert.equal(blocked.snapshot().decisions, 0));
  check(() => assert.notEqual(blocked.sample(1.1, true, true, 100), ''));
}
