import assert from 'node:assert/strict';
export async function testMotionV31({ check }) {
  const { registerLimbPoint } =
    await import('../.test-build/engine/motion/LimbRegistration.mjs');
  const { RigIntegrityValidator } =
    await import('../.test-build/engine/motion/RigIntegrityValidator.mjs');
  const { GaitResponse } =
    await import('../.test-build/engine/motion/GaitResponse.mjs');
  const source = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 5, y: 200 },
  ];
  const target = [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
    { x: 210, y: 25 },
  ];
  const a = registerLimbPoint({ x: -20, y: 40 }, source, target),
    b = registerLimbPoint({ x: 20, y: 40 }, source, target);
  check(() =>
    assert.ok(
      Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 40) < 1e-8,
      'Nearly collinear source must not inflate transverse width',
    ),
  );
  const elbow = registerLimbPoint(source[1], source, target);
  check(() => assert.deepEqual(elbow, target[1]));
  const validator = new RigIntegrityValidator();
  const good = {
    id: 'arm',
    length: 100,
    setupLength: 100,
    scaleX: 1,
    scaleY: 1,
    width: 30,
    setupWidth: 30,
  };
  check(() => assert.deepEqual(validator.inspect([good])[0].flags, []));
  for (const [patch, flag] of [
    [{ length: 105 }, 'limb length'],
    [{ scaleX: 1.2 }, 'anatomical scale'],
    [{ scaleX: 1.1 }, 'non-uniform scale'],
    [{ width: 38 }, 'mesh width'],
    [{ scaleX: NaN }, 'anatomical scale'],
  ])
    check(() =>
      assert.ok(
        validator.inspect([{ ...good, ...patch }])[0].flags.includes(flag),
      ),
    );
  check(() =>
    assert.deepEqual(good, {
      id: 'arm',
      length: 100,
      setupLength: 100,
      scaleX: 1,
      scaleY: 1,
      width: 30,
      setupWidth: 30,
    }),
  );
  const gait = new GaitResponse(),
    motor = {
      velocity: { x: 0, y: 0 },
      desired: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    };
  gait.update(motor, [], 1 / 60);
  check(() => assert.equal(gait.phase, 'idle'));
  motor.desired.x = 1;
  motor.velocity.x = 40;
  motor.acceleration.x = 200;
  gait.update(motor, [], 1 / 60);
  check(() => assert.equal(gait.phase, 'load'));
  for (let i = 0; i < 10; i++) gait.update(motor, [], 1 / 60);
  check(() => assert.equal(gait.phase, 'firstStep'));
  gait.update(motor, [{ name: 'footPlant' }, { name: 'footPlant' }], 1 / 60);
  check(() => assert.equal(gait.phase, 'secondStep'));
  gait.update(motor, [{ name: 'footPlant' }], 1 / 60);
  check(() => assert.equal(gait.phase, 'cruise'));
  motor.desired.x = 0;
  motor.acceleration.x = -100;
  gait.update(motor, [], 1 / 60);
  check(() => assert.equal(gait.phase, 'braking'));
  motor.velocity.x = 0;
  gait.update(motor, [], 1 / 60);
  check(() => assert.equal(gait.phase, 'finalPlant'));
  check(() =>
    assert.equal(
      motor.velocity.x,
      0,
      'Visual gait response must not overwrite motor velocity',
    ),
  );
}
