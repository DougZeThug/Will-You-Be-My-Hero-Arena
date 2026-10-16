import assert from 'node:assert/strict';

// Watch draws the back-lane figure at the equipment's lane depth. That is
// presentation only: recordings, release points and scoring stay byte-identical.
export async function testWatchLaneDepth({ check, m, s, a }) {
  const {
    characterDepthScale,
    projectilePerspectiveScale,
    equipmentDepthScale,
  } = await import('../.test-build/equipment-layout.mjs');
  // recordingHash of each Lab scenario simulated here (no registered custom
  // manifests, so unlike the browser Lab hashes 91cd474d/cd9ac447/a04ad94d),
  // captured before the lane-depth change; the browser spec pins the Lab ones.
  const before = {
    basketball: 'b0cff17c',
    football: '05be383c',
    'beer-pong': 'c7e109ce',
  };
  const lab = {
    basketball: ['basketball', 'basketball-recorded'],
    football: ['football', 'football-recorded'],
    'beer-pong': ['pong', 'beer-pong-recorded'],
  };
  for (const [name, [sport, id]] of Object.entries(lab)) {
    const seed = `arena-lab:${id}:v1`;
    const recording = s.simulate({
      id: `lab:${id}:${seed}`,
      seed,
      sport,
      participants: [
        {
          userId: 'user-dan',
          cardId: 'card-dan',
          copyId: 'lab-dan',
          strategy: 'steady',
        },
        {
          userId: 'user-doug',
          cardId: 'card-doug',
          copyId: 'lab-doug',
          strategy: 'steady',
        },
      ],
      mode: 'exhibition',
      tie: 'draw',
      secret: false,
      showcase: false,
      policy: { ...m.DEFAULT_POLICY },
      rulesVersion: s.RULES_VERSION,
      createdAt: '2026-09-11T00:00:00.000Z',
      characterAssets: [
        a.manifest('card-dan', 'dan', 'human'),
        a.manifest('card-doug', 'doug', 'human'),
      ],
    });
    check(() =>
      assert.equal(
        s.hash(JSON.stringify(recording)),
        before[name],
        'Lane depth must not change the recording: ' + name,
      ),
    );
    check(() => assert.equal(characterDepthScale(sport, 0), 1));
    check(() =>
      assert.equal(
        characterDepthScale(sport, 1),
        equipmentDepthScale(sport, 1),
      ),
    );
    check(() => assert.equal(characterDepthScale(sport, 1), 0.78));
    for (const attempt of recording.attempts)
      for (const t of [0, attempt.duration / 2, attempt.duration])
        // Held, released and landing ball share one scale per lane.
        check(() =>
          assert.equal(
            projectilePerspectiveScale(attempt, t),
            characterDepthScale(sport, attempt.actor),
          ),
        );
  }
  // A cornhole rig that scales itself (the performance provider) stays at 1 so
  // it is not scaled twice; every other cornhole rig is drawn at the 0.70 board.
  check(() => assert.equal(characterDepthScale('cornhole', 1, true), 1));
  check(() => assert.equal(characterDepthScale('cornhole', 1), 0.7));
  check(() =>
    assert.equal(
      characterDepthScale('cornhole', 1),
      equipmentDepthScale('cornhole', 1),
    ),
  );
  for (const selfScaled of [false, true])
    check(() =>
      assert.equal(characterDepthScale('cornhole', 0, selfScaled), 1),
    );
  const bag = { sport: 'cornhole', actor: 1, duration: 1, contact: 'miss' };
  // Fallback rig: held, released and landing bag share the 0.70 lane scale.
  check(() => assert.equal(projectilePerspectiveScale(bag, 0), 0.7));
  check(() => assert.equal(projectilePerspectiveScale(bag, 1), 0.7));
}
