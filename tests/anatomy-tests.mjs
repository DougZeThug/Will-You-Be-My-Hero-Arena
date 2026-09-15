import assert from 'node:assert/strict';
export async function testAnatomy({ check }) {
  const { DAN_ANATOMY: plan } =
    await import('../.test-build/engine/characters/anatomy/dan.mjs');
  const { JOINTS, PARENTS, balanceEstimate, validateAnatomyPlan } =
    await import('../.test-build/engine/characters/anatomy/AnatomyPlan.mjs');
  check(() => assert.deepEqual(validateAnatomyPlan(plan), []));
  check(() => assert.equal(plan.status, 'landmark-proposal'));
  // Every joint reaches one root, without cycles or a head-parented shoulder.
  for (const joint of JOINTS) {
    check(() => {
      const seen = new Set();
      let name = joint;
      while (name !== 'root') {
        assert.ok(!seen.has(name));
        seen.add(name);
        name = PARENTS[name];
        assert.ok(JOINTS.includes(name));
      }
    });
  }
  check(() => assert.equal(PARENTS.clavicle_L, 'chest'));
  check(() => assert.equal(PARENTS.clavicle_R, 'chest'));
  check(() => assert.equal(PARENTS.hip_L, 'pelvis'));
  check(() => assert.notDeepEqual(plan.setup, plan.idle));
  const idle = balanceEstimate(plan.idle),
    setup = balanceEstimate(plan.setup);
  check(() => assert.ok(idle.shareL >= 0.6 && idle.shareL <= 0.7));
  check(() => assert.ok(Math.abs(setup.shareL - 0.5) < 0.01));
  const airborne = structuredClone(plan);
  airborne.idle.heel_L.y = -5;
  check(() =>
    assert.ok(
      validateAnatomyPlan(airborne).some((s) => s.includes('unplanted foot L')),
    ),
  );
  const offBalance = structuredClone(plan);
  offBalance.idle.head.x = 2000;
  check(() =>
    assert.ok(
      validateAnatomyPlan(offBalance).some((s) =>
        s.includes('outside support'),
      ),
    ),
  );
  const invalid = structuredClone(plan);
  invalid.idle.shoulder_R.x = NaN;
  check(() =>
    assert.ok(
      validateAnatomyPlan(invalid).some((s) =>
        s.includes('invalid shoulder_R'),
      ),
    ),
  );
}
