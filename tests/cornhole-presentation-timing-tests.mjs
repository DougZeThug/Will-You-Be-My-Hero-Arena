import assert from 'node:assert/strict';

export async function testCornholePresentationTiming({ check, setup, s }) {
  const { firstImpactTime, surfaceTravelSeconds } =
      await import('../.test-build/engine/events/cornhole/CornholePresentationTiming.mjs'),
    { BattleDirector, directBattle } =
      await import('../.test-build/engine/core/BattleDirector.mjs'),
    { scoreTime, matchState } =
      await import('../.test-build/match-timeline.mjs');
  const base = s.simulate(setup('cornhole', 'presentation-boundaries')),
    template = base.attempts[0],
    target = { ...template.target },
    touch = { ...target, x: target.x - 0.7 },
    makeAttempt = (contact, shot, index) => ({
      ...structuredClone(template),
      id: `timing-${contact}-${shot}`,
      index,
      actor: index % 2,
      contact,
      score: contact === 'hole' ? 3 : contact === 'board' ? 1 : 0,
      target,
      boardResolution: { shot, touch },
      commentary: `${contact} saved outcome`,
    });
  const cases = [
    { attempt: makeAttempt('board', 'flat', 0), travel: 0.28 },
    { attempt: makeAttempt('hole', 'flat', 1), travel: 0.28 },
    { attempt: makeAttempt('miss', 'flat', 2), travel: 0.22 },
    {
      attempt: {
        ...makeAttempt('hole', 'airmail', 3),
        boardResolution: { shot: 'airmail', touch: target },
      },
      travel: 0,
    },
  ];
  for (const { attempt, travel } of cases) {
    const shot = attempt.boardResolution.shot,
      impact = firstImpactTime(attempt, shot),
      reveal = scoreTime(attempt),
      epsilon = Number.EPSILON * Math.max(1, Math.abs(attempt.contactAt)) * 8,
      stepTolerance = 1 / 120 + epsilon;
    check(() =>
      assert.ok(
        Math.abs(surfaceTravelSeconds(attempt, shot) - travel) <= epsilon,
      ),
    );
    check(() =>
      assert.ok(Math.abs(impact - (attempt.contactAt - travel)) <= epsilon),
    );
    check(() => assert.ok(impact <= attempt.contactAt + epsilon));
    check(() => assert.equal(scoreTime(attempt), reveal));

    const recording = {
      ...structuredClone(base),
      attempts: [attempt],
      scores: attempt.scoreAfter,
      duration: attempt.end + 1,
    };
    recording.direction = directBattle(recording);
    const action = recording.direction.actions[0],
      impactCue = recording.direction.cues.filter(
        (cue) => cue.attemptId === attempt.id && cue.name === 'impact',
      ),
      scoreCue = recording.direction.cues.find(
        (cue) => cue.attemptId === attempt.id && cue.name === 'score',
      );
    check(() => assert.equal(impactCue.length, 1));
    check(() => assert.ok(Math.abs(impactCue[0].time - impact) <= epsilon));
    check(() => assert.ok(Math.abs(scoreCue.time - reveal) <= epsilon));
    check(() => assert.ok(action.reactionDelay > 0));

    if (travel) {
      check(() =>
        assert.equal(
          matchState(recording, impact + stepTolerance / 2).phase,
          'boardTravel',
        ),
      );
      check(() =>
        assert.equal(matchState(recording, attempt.contactAt).phase, 'landing'),
      );
    } else {
      check(() =>
        assert.notEqual(matchState(recording, impact).phase, 'boardTravel'),
      );
    }
    check(() =>
      assert.deepEqual(
        matchState(recording, reveal - stepTolerance / 2).scores,
        [0, 0],
      ),
    );
    check(() =>
      assert.deepEqual(
        matchState(recording, reveal).scores,
        attempt.scoreAfter,
      ),
    );

    recording.direction.cues.find(
      (cue) => cue.attemptId === attempt.id && cue.name === 'impact',
    ).time = attempt.contactAt;
    const emitted = [],
      director = new BattleDirector(recording);
    check(() =>
      assert.equal(
        recording.direction.cues.find(
          (cue) => cue.attemptId === attempt.id && cue.name === 'impact',
        ).time,
        attempt.contactAt,
        'Playback derives presentation timing without modifying saved fields',
      ),
    );
    director.seek(impact - stepTolerance / 2);
    director.advance(impact + stepTolerance / 2, (cue) => emitted.push(cue));
    check(() =>
      assert.equal(emitted.filter((cue) => cue.name === 'impact').length, 1),
    );
    director.seek(reveal - stepTolerance / 2);
    director.advance(reveal + stepTolerance / 2, (cue) => emitted.push(cue));
    check(() =>
      assert.equal(emitted.filter((cue) => cue.name === 'score').length, 1),
    );
    check(() => assert.ok(reveal + action.reactionDelay > reveal + epsilon));
  }
}
