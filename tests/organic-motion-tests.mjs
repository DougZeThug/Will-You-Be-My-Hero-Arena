import assert from 'node:assert/strict';
export async function testOrganicMotion({ check }) {
  const { DampedMotion, InertialChannel } =
    await import('../.test-build/engine/motion/DampedMotion.mjs');
  const { OrganicMotion } =
    await import('../.test-build/engine/motion/OrganicMotion.mjs');
  const { bodyBalance } =
    await import('../.test-build/engine/motion/BodyBalance.mjs');
  const { matchRecovery } =
    await import('../.test-build/engine/motion/RecoveryMatcher.mjs');
  const { motionProfiles } =
    await import('../.test-build/engine/motion/MotionTypes.mjs');
  const { MotionCurves } =
    await import('../.test-build/engine/motion/MotionCurves.mjs');
  const values = [30, 60, 120].map((hz) => {
    const d = new DampedMotion();
    for (let i = 0; i < hz; i++) d.update(1, 1 / hz, 0.3, 0.85);
    return d.value;
  });
  check(() =>
    assert.ok(
      Math.max(...values) - Math.min(...values) < 1e-10,
      'Damped response must not depend on review frame rate',
    ),
  );
  const d = new DampedMotion();
  d.impulse(2);
  d.update(0, 1 / 120, 0.3);
  check(() =>
    assert.ok(d.value > 0 && d.velocity > 0, 'An impulse must retain momentum'),
  );
  for (let i = 0; i < 240; i++) d.update(0, 1 / 120, 0.3);
  check(() => assert.ok(Math.abs(d.value) < 1e-7));
  check(() => assert.throws(() => d.update(NaN, 0.01, 0.3)));
  const inertia = new InertialChannel();
  inertia.apply(0, false, 0.01, 0.3, 1);
  const blend = inertia.apply(0.5, true, 0.01, 0.3, 1);
  check(() =>
    assert.ok(
      Math.abs(blend) < 0.12,
      'Transition must retain outgoing position instead of exposing incoming snap',
    ),
  );
  const pose = {
    time: 0,
    root: { x: 0, y: 0 },
    massProxy: { x: 3, y: -25 },
    joints: {
      pelvis: { x: 3, y: -40 },
      chest: { x: 5, y: -70 },
      head: { x: 3, y: -95 },
      rightAnkle: { x: 12, y: 0 },
      leftAnkle: { x: -12, y: 0 },
      rightShoulder: { x: 7, y: -67 },
      rightElbow: { x: 10, y: -48 },
      rightWrist: { x: 10, y: -32 },
      rightHand: { x: 12, y: -29 },
    },
  };
  check(() =>
    assert.equal(bodyBalance(pose, true, ['left']).supportSide, 'left'),
  );
  check(() => assert.equal(bodyBalance(pose, false, []).weightBias, 0));
  check(() =>
    assert.notEqual(
      matchRecovery({ handHeight: 1.05, chestPitch: 0, speed: 0, footPhase: 0 })
        .id,
      matchRecovery({ handHeight: -0.1, chestPitch: 0, speed: 0, footPhase: 0 })
        .id,
    ),
  );
  const clip = {
    id: 'proof',
    native: 'proof',
    duration: 2,
    technique: 'underhand',
    markers: [{ name: 'equipmentRelease', at: 0.8 }],
    phases: [],
    layer: 'action',
    priority: 2,
    fade: 0.1,
  };
  const traces = [];
  for (const id of ['dan', 'doug']) {
    const motion = new OrganicMotion(motionProfiles[id]),
      trace = [];
    for (let i = 0; i < 300; i++) {
      const t = i / 120;
      const result = motion.update({
        state: t <= 2 ? { clip, time: t, rate: 1, revision: 1 } : undefined,
        pose,
        dt: 1 / 120,
        time: t,
        grounded: true,
        contacts: ['left', 'right'],
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        aim: { x: 0, y: 0 },
        recoverySeconds: 0.3,
      });
      check(() =>
        assert.ok(
          Object.values(result).every((o) =>
            Object.values(o).every(Number.isFinite),
          ),
        ),
      );
      trace.push(motion.snapshot());
    }
    const peaks = ['pelvis', 'chest', 'hand_L'].map((b) =>
      trace
        .slice(0, 180)
        .reduce(
          (best, s, i) =>
            s.propagation.find((c) => c.bone === b).value >
            trace[best].propagation.find((c) => c.bone === b).value
              ? i
              : best,
          0,
        ),
    );
    check(() =>
      assert.ok(
        peaks[0] < peaks[1] && peaks[1] < peaks[2],
        'Force response must propagate, not move as a synchronized block',
      ),
    );
    check(() =>
      assert.ok(
        Math.abs(trace[241].adjustments.hand_L.rotation) > 0,
        'Recovery must retain outgoing response after action completion',
      ),
    );
    traces.push(trace);
  }
  check(() =>
    assert.notDeepEqual(traces[0][80].propagation, traces[1][80].propagation),
  );
  const curves = new MotionCurves();
  for (let i = 0; i < 120; i++) {
    const p = structuredClone(pose);
    p.time = i / 60;
    p.joints.pelvis.x += i * 0.1;
    curves.push(p);
  }
  const s = curves.snapshot();
  check(() =>
    assert.ok(
      s.samples.at(-1).position.pelvis.x > 0.3,
      'Fixed normalization must retain pelvis travel',
    ),
  );
  check(() => assert.ok(s.samples.at(-1).velocity.pelvis.x > 0));
}
