import assert from 'node:assert/strict';
export async function testHumanMotion({ check }) {
  const { CharacterMotor } =
    await import('../.test-build/engine/movement/CharacterMotor.mjs');
  const { motionProfiles } =
    await import('../.test-build/engine/motion/MotionTypes.mjs');
  const { AnimationGraph } =
    await import('../.test-build/engine/motion/AnimationGraph.mjs');
  const { FootLock } =
    await import('../.test-build/engine/movement/FootLock.mjs');
  const { AttachmentManager } =
    await import('../.test-build/engine/equipment/AttachmentManager.mjs');
  const { validateHumanRig, SIDE_RIG_BONES } =
    await import('../.test-build/engine/motion/HumanSkeleton.mjs');
  const { importReference, retargetReference, retargetMotion } =
    await import('../.test-build/engine/motion-tools/ReferenceMotion.mjs');
  const motor = new CharacterMotor(
    motionProfiles.dan,
    { x: 0, y: 0 },
    (_from, to) => ({
      position: { x: Math.min(15, to.x), y: to.y },
      blockedX: to.x > 15,
    }),
  );
  motor.move({ x: 1, y: 0 });
  motor.update(1 / 60);
  check(() =>
    assert.ok(
      motor.velocity.x > 0 && motor.velocity.x < motionProfiles.dan.topSpeed,
    ),
  );
  for (let i = 0; i < 60; i++) motor.update(1 / 60, { x: 1, y: 0 });
  check(() => assert.equal(motor.position.x, 15));
  check(() => assert.ok(motor.rejectedRoot > 0));
  const before = motor.velocity.x;
  motor.jump();
  check(() => assert.equal(motor.velocity.x, before));
  let landed = false;
  for (let i = 0; i < 120; i++) landed ||= motor.update(1 / 60).landed;
  check(() => assert.ok(landed));
  check(() => assert.equal(motor.jump(), true));
  check(() => assert.equal(motor.jump(), false));
  check(() => assert.throws(() => motor.update(NaN)));
  const m2 = new CharacterMotor(motionProfiles.doug, { x: 0, y: 0 });
  m2.move({ x: 1, y: 0 });
  m2.update(1 / 60);
  check(() => assert.ok(m2.velocity.x > motionProfiles.dan.acceleration / 60));
  const clip = {
    id: 'throw',
    native: 'native_throw',
    duration: 1,
    layer: 'action',
    priority: 2,
    fade: 0.12,
    phases: [
      { phase: 'load', at: 0 },
      { phase: 'release', at: 0.4 },
      { phase: 'recovery', at: 0.6 },
    ],
    markers: [
      { name: 'grab', at: 0 },
      { name: 'equipmentRelease', at: 0.4 },
    ],
    cancel: [[0.8, 1]],
  };
  const graph = new AnimationGraph();
  graph.request(clip);
  const events = [];
  for (let i = 1; i <= 60; i++) events.push(...graph.advance(1 / 60, i / 60));
  check(() =>
    assert.equal(events.filter((e) => e.name === 'equipmentRelease').length, 1),
  );
  check(() => assert.equal(events.filter((e) => e.name === 'grab').length, 1));
  check(() =>
    assert.equal(events.filter((e) => e.name === 'motionComplete').length, 1),
  );
  graph.remove('action');
  graph.request(clip);
  graph.advance(0.1, 0.1);
  check(() => assert.equal(graph.request({ ...clip, id: 'another' }), false));
  graph.advance(0.75, 0.85);
  check(() => assert.equal(graph.request({ ...clip, id: 'another' }), true));
  graph.request({ ...clip, id: 'hit', layer: 'reaction', priority: 10 }, true);
  check(() => assert.equal(graph.get('action'), undefined));
  check(() => assert.equal(graph.phase(), 'load'));
  check(() => assert.equal(graph.canInterrupt(), false));
  graph.advance(0.85, 1.7);
  check(() => assert.equal(graph.canInterrupt(), true));
  const repeated = new AnimationGraph();
  repeated.request(clip);
  check(() => assert.equal(repeated.request(clip), false));
  repeated.advance(0.85, 0.85);
  const revision = repeated.revision;
  check(() => assert.equal(repeated.request(clip), true));
  check(() => assert.equal(repeated.get('action').time, 0));
  check(() => assert.ok(repeated.revision > revision));
  const loop = new AnimationGraph();
  loop.request({
    ...clip,
    id: 'run',
    layer: 'base',
    loop: true,
    markers: [
      { name: 'footPlant', at: 0 },
      { name: 'footRelease', at: 0.5 },
    ],
  });
  const loopEvents = [];
  for (let i = 0; i < 240; i++)
    loopEvents.push(...loop.advance(1 / 60, i / 60));
  check(() =>
    assert.equal(loopEvents.filter((e) => e.name === 'footRelease').length, 4),
  );
  check(() =>
    assert.equal(loopEvents.filter((e) => e.name === 'footPlant').length, 5),
  );
  const foot = new FootLock();
  foot.plant('right', { x: 10, y: 20 });
  foot.measure('right', { x: 10.5, y: 20 });
  check(() => assert.equal(foot.snapshot()[0].warning, null));
  foot.measure('right', { x: 13, y: 20 });
  check(() => assert.ok(foot.snapshot()[0].warning));
  foot.release('right');
  check(() => assert.equal(foot.snapshot().length, 0));
  foot.plant('right', { x: 0, y: 0 }, 0.5);
  foot.measure('right', { x: 0, y: -10 });
  check(() => assert.equal(foot.snapshot()[0].maxSlide, 0));
  foot.setInfluence('right', 1);
  foot.measure('right', { x: 4, y: 0 });
  check(() => assert.equal(foot.snapshot()[0].maxSlide, 4));
  const equipment = new AttachmentManager();
  equipment.attach('football');
  for (let i = 0; i < 8; i++)
    equipment.sample({
      time: i / 120,
      x: 50 + (i / 120) * 300,
      y: 100 - (i / 120) * 120,
      angle: (i / 120) * 0.5,
    });
  const release = equipment.release();
  check(() => assert.ok(Math.abs(release.velocity.x - 300) < 1e-6));
  check(() => assert.ok(Math.abs(release.velocity.y + 120) < 1e-6));
  check(() => assert.ok(Math.abs(release.angularVelocity - 0.5) < 1e-6));
  check(() => assert.equal(equipment.release(), null));
  check(() =>
    assert.equal(validateHumanRig(Object.values(SIDE_RIG_BONES)).valid, true),
  );
  check(() =>
    assert.ok(
      validateHumanRig([]).missing.some((m) => m.semantic === 'rightHand'),
    ),
  );
  const ref = {
    schema: 'arena-motion-reference-v1',
    source: { kind: 'synthetic unit fixture, not observed human motion' },
    warnings: [],
    samples: [
      {
        timestamp: 0,
        detected: true,
        normalized: {
          rightShoulder: { x: 0, y: 0 },
          rightElbow: { x: 1, y: 0 },
          rightWrist: { x: 2, y: 0 },
        },
      },
    ],
  };
  check(() => assert.equal(importReference(ref).samples.length, 1));
  const timed = retargetMotion(
    {
      ...ref,
      samples: [
        ref.samples[0],
        { ...ref.samples[0], timestamp: 2, detected: false },
      ],
    },
    {},
    { speed: 2, markers: [{ name: 'release', at: 1 }] },
  );
  check(() => assert.equal(timed.duration, 1));
  check(() => assert.equal(timed.markers[0].at, 0.5));
  check(() => assert.equal(timed.samples[1].joints, null));
  check(() => assert.throws(() => retargetMotion(ref, {}, { speed: 0 })));
  check(() =>
    assert.throws(() =>
      importReference({ ...ref, samples: [ref.samples[0], ref.samples[0]] }),
    ),
  );
  const retarget = retargetReference(
    ref.samples[0],
    {
      rightShoulder: { x: 0, y: 0 },
      rightElbow: { x: 0, y: 50 },
      rightWrist: { x: 0, y: 100 },
    },
    1,
  );
  check(() =>
    assert.ok(
      Math.abs(
        Math.hypot(
          retarget.joints.rightWrist.x - retarget.joints.rightElbow.x,
          retarget.joints.rightWrist.y - retarget.joints.rightElbow.y,
        ) - 50,
      ) < 1e-6,
    ),
  );
}
