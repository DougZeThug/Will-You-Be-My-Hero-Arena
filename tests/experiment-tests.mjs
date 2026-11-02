// GAMEPLAY EXPERIMENT tests: the crowded-board / innings cornhole prototype
// (lib/arena/engine/events/precision/experiments). They prove the prototype is
// isolated from the shipped event, deterministic, and that its rules do what
// docs/experiments/crowded-board/README.md says. They say nothing about fun.
import assert from 'node:assert/strict';
export async function testExperiments({ check }) {
  const root = '../.test-build/engine';
  const R = await import(
    `${root}/events/precision/experiments/CrowdedBoardRules.mjs`
  );
  const { CrowdedBoardEvent } = await import(
    `${root}/events/precision/experiments/CrowdedBoardEvent.mjs`
  );
  const { PrecisionEvent } = await import(
    `${root}/events/precision/PrecisionEvent.mjs`
  );
  const { precisionTarget, bagPoints } = await import(
    `${root}/events/precision/PrecisionPhysics.mjs`
  );
  const { playableEvent, playableEvents } = await import(
    `${root}/core/EventRegistry.mjs`
  );
  const { ArenaSession } = await import(`${root}/core/ArenaSession.mjs`);
  const { bindingsFor } = await import(`${root}/input/InputBindings.mjs`);

  const config = (seed, options, count = 2) => ({
    event: 'cornhole',
    seed,
    ...(options ? { options } : {}),
    players: Array.from({ length: count }, (_, i) => ({
      id: 'p' + i,
      cardId: i % 2 ? 'card-dan' : 'card-doug',
      device: 'ai',
      bindings: bindingsFor(i),
    })),
  });
  const play = (s, limit = 60 * 600) => {
    let steps = 0;
    while (!s.event.resolveOutcome().finished && steps < limit) {
      s.advance(1 / 60);
      steps++;
    }
    return steps;
  };

  // Isolation: the player app's event list and default construction are unchanged.
  check(() => assert.equal(playableEvents().length, 3));
  check(() =>
    assert.ok(playableEvent('cornhole').create() instanceof PrecisionEvent),
  );
  check(() =>
    assert.ok(
      playableEvent('cornhole').create({ movement: 'lanes' }) instanceof
        PrecisionEvent,
    ),
  );
  check(() =>
    assert.ok(
      playableEvent('cornhole').create({ cornholeBoard: 'crowded' }) instanceof
        CrowdedBoardEvent,
    ),
  );

  // Parity: classic board + total scoring + stock AI is the shipped event,
  // throw for throw, so measured differences are the rule change alone.
  for (const seed of ['parity:a', 'parity:b', 'parity:c']) {
    const shipped = new ArenaSession(config(seed));
    const proto = new ArenaSession(
      config(seed, {
        cornholeBoard: 'classic',
        cornholeScoring: 'total',
        cornholeAI: 'stock',
      }),
    );
    check(() => assert.ok(proto.event instanceof CrowdedBoardEvent));
    const a = [],
      b = [];
    for (
      let i = 0;
      i < 60 * 60 && !shipped.event.resolveOutcome().finished;
      i++
    ) {
      shipped.advance(1 / 60);
      proto.advance(1 / 60);
      const va = shipped.event.view(),
        vb = proto.event.view();
      a.push(va.message + JSON.stringify(va.scores));
      b.push(vb.message + JSON.stringify(vb.scores));
    }
    check(() => assert.ok(shipped.event.resolveOutcome().finished));
    check(() => assert.deepEqual(b, a, 'classic prototype diverged: ' + seed));
  }

  // Crowded board: on an empty board a Perfect release at the hole scores
  // three for every sliding shot, across the whole window and scatter.
  const target = precisionTarget(),
    u = R.boardAxis(),
    cards = {
      doug: {
        accuracy: 0.68,
        skill: { flat: 0.9, slide: 0.9, roll: 0.55, airmail: 0.63 },
      },
      dan: {
        accuracy: 0.76,
        skill: { flat: 0.72, slide: 0.72, roll: 0.86, airmail: 0.72 },
      },
    };
  for (const card of Object.values(cards))
    for (const shot of ['flat', 'slide', 'roll']) {
      const w = R.releaseWindow(card.skill[shot], false, false);
      let all = true;
      for (const e of [-1, -0.5, 0, 0.5, 1])
        for (const rx of [0, 0.5, 1])
          for (const ry of [0, 0.5, 1]) {
            const rest = R.restPoint(
              {
                error: e * w,
                window: w,
                accuracy: card.accuracy,
                precision: false,
                shot,
                aim: { x: 0, y: 0 },
                board: 'crowded',
              },
              rx,
              ry,
            );
            if (
              R.resolveThrow({ board: 'crowded' }, 'x', 'me', shot, rest, [])
                .landed.points !== 3
            )
              all = false;
          }
      check(() =>
        assert.ok(all, `${shot} perfect must score three on an empty board`),
      );
    }
  // ...but the airmail pays for flying over blockers: Doug can rim out.
  {
    let rims = 0;
    for (let i = 0; i <= 10; i++)
      for (let j = 0; j <= 10; j++) {
        const rest = R.restPoint(
          {
            error: 0,
            window: 0.05,
            accuracy: 0.68,
            precision: false,
            shot: 'airmail',
            aim: { x: 0, y: 0 },
            board: 'crowded',
          },
          i / 10,
          j / 10,
        );
        if (
          R.resolveThrow({ board: 'crowded' }, 'x', 'me', 'airmail', rest, [])
            .landed.points !== 3
        )
          rims++;
      }
    check(() => assert.ok(rims > 10 && rims < 70, 'airmail rim rate ' + rims));
  }

  // Each shot has a different answer to an opponent's guard 60 px short.
  const guarded = (shot) => {
    const bags = [
      {
        id: 'g',
        owner: 'them',
        x: target.x - u.x * 60,
        y: target.y - u.y * 60,
        points: 1,
        angle: 0,
      },
    ];
    const r = R.resolveThrow(
      { board: 'crowded' },
      'x',
      'me',
      shot,
      { ...target },
      bags,
    );
    return { me: r.landed.points, them: bags[0].points, tags: r.tags };
  };
  check(() =>
    assert.deepEqual(guarded('flat'), { me: 1, them: 1, tags: ['blocked'] }),
  );
  check(() => {
    const g = guarded('slide');
    assert.equal(g.me, 1);
    assert.equal(g.them, 3);
    assert.ok(g.tags.includes('gift'));
  });
  check(() => {
    const g = guarded('roll');
    assert.equal(g.me, 3);
    assert.ok(g.tags.includes('hop'));
  });
  check(() =>
    assert.deepEqual(guarded('airmail'), { me: 3, them: 1, tags: [] }),
  );
  // Your own guard knocked in is yours.
  {
    const bags = [
      {
        id: 'g',
        owner: 'me',
        x: target.x - u.x * 60,
        y: target.y - u.y * 60,
        points: 1,
        angle: 0,
      },
    ];
    const r = R.resolveThrow(
      { board: 'crowded' },
      'x',
      'me',
      'slide',
      { ...target },
      bags,
    );
    check(() => assert.ok(r.tags.includes('own-push-in')));
  }
  // Aiming long is not free: a sliding bag with pace left skates the hole.
  {
    const rest = { x: target.x + u.x * 35, y: target.y + u.y * 35 };
    const r = R.resolveThrow(
      { board: 'crowded' },
      'x',
      'me',
      'slide',
      rest,
      [],
    );
    check(() => assert.notEqual(r.landed.points, 3));
    check(() => assert.ok(r.tags.includes('hot')));
  }

  // The resolver's cached board test is the shipped scoring test.
  {
    let same = true;
    for (let x = 650; x <= 1100; x += 3)
      for (let y = 490; y <= 620; y += 1.5)
        if (R.fastBagPoints({ x, y }) !== bagPoints({ x, y })) same = false;
    check(() => assert.ok(same, 'fastBagPoints must equal bagPoints'));
  }

  // Innings cancel: only the difference scores.
  check(() => assert.deepEqual(R.inningAward({ a: 7, b: 4 }), { a: 3, b: 0 }));
  check(() => assert.deepEqual(R.inningAward({ a: 6, b: 6 }), { a: 0, b: 0 }));
  check(() =>
    assert.deepEqual(R.inningAward({ a: 2, b: 9, c: 5 }), { b: 4, a: 0, c: 0 }),
  );

  // Every variant finishes, deterministically, for 1-4 throwers, with the
  // board-aware AI actually choosing shots and aims through its inputs.
  const variants = [
    { cornholeBoard: 'crowded', cornholeScoring: 'total' },
    {
      cornholeBoard: 'classic',
      cornholeScoring: 'innings',
      cornholeAI: 'stock',
    },
    { cornholeBoard: 'crowded', cornholeScoring: 'innings' },
  ];
  const shotsSeen = new Set(),
    aimsSeen = new Set();
  for (const options of variants)
    for (const count of [1, 2, 4]) {
      const run = () => {
        const s = new ArenaSession(config(`finish:${count}`, options, count));
        const steps = play(s);
        return { s, steps, log: JSON.stringify(s.event.log) };
      };
      const first = run(),
        second = run();
      check(() =>
        assert.ok(
          first.s.event.resolveOutcome().finished,
          `${JSON.stringify(options)} x${count} did not finish`,
        ),
      );
      check(() => assert.equal(first.log, second.log));
      check(() => assert.equal(first.steps, second.steps));
      const rounds = Math.max(0, ...first.s.event.log.map((t) => t.round)) + 1;
      if (options.cornholeScoring === 'innings')
        check(() =>
          assert.ok(
            rounds <= 5 &&
              (rounds === 5 ||
                Math.max(...first.s.characters.map((c) => c.score)) >= 11),
          ),
        );
      else check(() => assert.equal(first.s.event.log.length, count * 4));
      for (const t of first.s.event.log) {
        shotsSeen.add(t.shot);
        aimsSeen.add(Math.round(t.aim.x * 10) / 10);
      }
    }
  check(() => assert.ok(shotsSeen.size >= 3, 'AI shots: ' + [...shotsSeen]));
  check(() => assert.ok(aimsSeen.size >= 2, 'AI aims: ' + [...aimsSeen]));
}
