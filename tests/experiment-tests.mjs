// GAMEPLAY EXPERIMENT tests: the real-cornhole prototype (crowded board and
// cancellation innings to 21; lib/arena/engine/events/precision/experiments).
// They prove the prototype is isolated from the shipped event, deterministic,
// and that its rules do what docs/experiments/crowded-board/README.md says.
// They say nothing about fun.
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
  const play = (s, limit = 60 * 3600) => {
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

  // Parity: classic board + total scoring + the easy AI is the shipped event,
  // throw for throw, so measured differences are the rule change alone.
  // ('stock' is the easy AI's earlier name and must still select it.)
  for (const [seed, ai] of [
    ['parity:a', 'easy'],
    ['parity:b', 'easy'],
    ['parity:c', 'stock'],
  ]) {
    const shipped = new ArenaSession(config(seed));
    const proto = new ArenaSession(
      config(seed, {
        cornholeBoard: 'classic',
        cornholeScoring: 'total',
        cornholeAI: ai,
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

  // Each shot has its own answer to a bag in the lane (the README's table).
  // A Perfect release, no scatter, aimed at the hole.
  const lane = (shot, distance, owner = 'them', rest = target) => {
    const bags = [
      {
        id: 'g',
        owner,
        x: target.x - u.x * distance,
        y: target.y - u.y * distance,
        points: 1,
        angle: 0,
      },
    ];
    const r = R.resolveThrow(
      { board: 'crowded' },
      'x',
      'me',
      shot,
      { ...rest },
      bags,
    );
    return { me: r.landed.points, them: bags[0].points, tags: r.tags };
  };
  // Their bag mid-board (80 px, about 11 inches short): the Hole runner drops
  // past it; the Slide lands on it and knocks it in for them.
  check(() => assert.deepEqual(lane('flat', 80), { me: 3, them: 1, tags: [] }));
  check(() => {
    const g = lane('slide', 80);
    assert.equal(g.me, 1);
    assert.equal(g.them, 3);
    assert.ok(g.tags.includes('gift'));
  });
  // Their bag near the lip (35 px): sliding shots knock it in; the Airmail
  // flies over it.
  check(() => {
    const g = lane('flat', 35);
    assert.equal(g.them, 3);
    assert.ok(g.tags.includes('gift'));
  });
  check(() =>
    assert.deepEqual(lane('airmail', 35), { me: 3, them: 1, tags: [] }),
  );
  // Your own bag anywhere in the slide's path: the Slide knocks it in.
  for (const d of [35, 60, 90])
    check(() => {
      const g = lane('slide', d, 'me');
      assert.equal(g.them, 3, `own bag ${d} px short`);
      assert.ok(g.tags.includes('own-push-in'));
    });
  // The Roll tumbles over a blocker, but a tumble is chaotic: over a range of
  // rest points it goes in sometimes, never always.
  {
    let hops = 0,
      holes = 0,
      n = 0;
    for (let along = -6; along <= 24; along += 2)
      for (let across = -6; across <= 6; across += 3) {
        const g = lane('roll', 50, 'them', {
          x: target.x + u.x * along,
          y: target.y + u.y * along + across,
        });
        n++;
        if (g.tags.includes('hop')) hops++;
        if (g.me === 3) holes++;
      }
    check(() => assert.equal(hops, n, 'every roll meets the blocker'));
    check(() =>
      assert.ok(
        holes > n * 0.1 && holes < n * 0.7,
        `roll over a blocker went in ${holes}/${n}`,
      ),
    );
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
  // (Innings variants play to 7, at most four innings, to keep the suite
  // fast; the full game to 21 is played below.)
  const variants = [
    { cornholeBoard: 'crowded', cornholeScoring: 'total', cornholeAI: 'hard' },
    {
      cornholeBoard: 'classic',
      cornholeScoring: 'innings',
      cornholeAI: 'easy',
      cornholeTarget: 7,
      cornholeMaxRounds: 4,
    },
    {
      cornholeBoard: 'crowded',
      cornholeScoring: 'innings',
      cornholeAI: 'hard',
      cornholeTarget: 7,
      cornholeMaxRounds: 4,
    },
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
      if (options.cornholeScoring === 'innings') {
        const innings = Math.max(...first.s.event.log.map((t) => t.round)) + 1;
        check(() =>
          assert.ok(
            innings <= 4 &&
              (innings === 4 ||
                Math.max(...first.s.characters.map((c) => c.score)) >= 7),
          ),
        );
      }
      else check(() => assert.equal(first.s.event.log.length, count * 4));
      if (options.cornholeAI === 'hard')
        for (const t of first.s.event.log) {
          shotsSeen.add(t.shot);
          aimsSeen.add(Math.round(t.aim.x * 10) / 10);
        }
    }
  check(() => assert.ok(shotsSeen.size >= 3, 'AI shots: ' + [...shotsSeen]));
  check(() => assert.ok(aimsSeen.size >= 2, 'AI aims: ' + [...aimsSeen]));

  // A full real game to 21 (the Lab's cornhole-real scenario): cancellation
  // scoring, the scorer throws first next inning, the players switch ends
  // between innings, and it ends at the first inning that takes someone to 21.
  {
    const s = new ArenaSession(
      config('real:21', {
        cornholeBoard: 'crowded',
        cornholeScoring: 'innings',
        cornholeAI: 'easy',
      }),
    );
    const ev = s.event;
    check(() => assert.equal(ev.rules.target, 21));
    check(() => assert.equal(ev.aiMode, 'easy'));
    let switching = 0,
      switchNote = false,
      steps = 0,
      last = '';
    while (!ev.resolveOutcome().finished && steps < 60 * 3600) {
      s.advance(1 / 60);
      steps++;
      const v = ev.view();
      if (v.phase === 'switching' && last !== 'switching') {
        switching++;
        if (/switch ends/.test(v.message)) switchNote = true;
      }
      last = v.phase;
    }
    const scores = s.characters.map((c) => c.score).sort((a, b) => b - a);
    const innings = Math.max(...ev.log.map((t) => t.round)) + 1;
    check(() => assert.ok(ev.resolveOutcome().finished, 'game to 21 ended'));
    check(() => assert.ok(scores[0] >= 21 && scores[1] < 21, `${scores}`));
    check(() => assert.equal(ev.resolveOutcome().winners.length, 1));
    check(() => assert.equal(switching, innings - 1));
    check(() => assert.ok(switchNote));
    check(() => assert.equal(ev.log.length, innings * 8));
    // Replay the cancellation and the honours from the log.
    const game = { p0: 0, p1: 0 };
    let ok = true,
      firstThrower = 'p0';
    for (let r = 0; r < innings; r++) {
      const throws = ev.log.filter((t) => t.round === r);
      if (throws[0].player !== firstThrower) ok = false;
      // Alternate throws, four bags each.
      if (throws[0].player === throws[1].player) ok = false;
      throws.forEach((t, k) => {
        if (t.player !== (k % 2 ? throws[1].player : throws[0].player))
          ok = false;
      });
      const totals = throws.at(-1).scores,
        award = R.inningAward(totals);
      game.p0 += award.p0;
      game.p1 += award.p1;
      const scorer = award.p0 ? 'p0' : award.p1 ? 'p1' : undefined;
      if (scorer) firstThrower = scorer;
    }
    check(() => assert.ok(ok, 'alternating throws and scorer-first honours'));
    check(() =>
      assert.deepEqual(
        game,
        Object.fromEntries(s.characters.map((c) => [c.id, c.score])),
      ),
    );
  }
  // The safety cap ends a game that never reaches the target.
  {
    const s = new ArenaSession(
      config('real:cap', {
        cornholeBoard: 'crowded',
        cornholeScoring: 'innings',
        cornholeAI: 'easy',
        cornholeMaxRounds: 2,
      }),
    );
    play(s);
    check(() => assert.ok(s.event.resolveOutcome().finished));
    check(() =>
      assert.equal(Math.max(...s.event.log.map((t) => t.round)) + 1, 2),
    );
  }
}
