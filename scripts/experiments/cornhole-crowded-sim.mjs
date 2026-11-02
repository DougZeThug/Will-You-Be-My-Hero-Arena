// GAMEPLAY EXPERIMENT: headless, deterministic simulation of Play cornhole
// under the shipped rules and the three experiment variants.
//
//   node scripts/experiments/cornhole-crowded-sim.mjs [--matches 300] [--out work/qa/gameplay-lab/sim.json]
//
// It plays whole matches on the pure rules (CrowdedBoardRules) with the real
// card stats read from an ArenaSession, scripted throwers whose release error
// is normally distributed (sigma in power units: 0.667 = one second of charge),
// and two policies: "default" (the card's favourite shot, aimed at the hole,
// which is what the shipped AI and the starting caption do) and "tactical"
// (the board-aware planner). Every random draw comes from a seeded stream, so
// a run is exactly reproducible.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const MATCHES = Number(arg('matches', 300));
const OUT = arg('out', 'work/qa/gameplay-lab/sim.json');
if (!process.argv.includes('--no-build'))
  execFileSync(process.execPath, ['scripts/experiments/transpile.mjs'], {
    stdio: 'inherit',
  });
const root = path.resolve('.test-build');
const R = await import(
  root + '/engine/events/precision/experiments/CrowdedBoardRules.mjs'
);
const T = await import(
  root + '/engine/events/precision/experiments/TacticalPlanner.mjs'
);
const { seeded } = await import(root + '/engine/core/Random.mjs');
const { ArenaSession } = await import(root + '/engine/core/ArenaSession.mjs');
const { bindingsFor } = await import(root + '/engine/input/InputBindings.mjs');

// Real card data, read through the experiment event's own model().
const probe = new ArenaSession({
  event: 'cornhole',
  seed: 'sim-probe',
  options: { cornholeBoard: 'crowded' },
  players: ['card-doug', 'card-dan'].map((cardId, i) => ({
    id: 'p' + i,
    cardId,
    device: 'ai',
    bindings: bindingsFor(i),
  })),
});
const CARDS = Object.fromEntries(
  probe.characters.map((c) => {
    const m = probe.event.model(c);
    const fav =
      Object.entries(c.profile.throwingStyle.tendencies)
        .filter(([s]) => R.SHOTS.includes(s))
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'flat';
    return [c.profile.name, { ...m, favourite: fav }];
  }),
);

const gauss = (rng) => {
  const u = Math.max(1e-12, rng()),
    v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
/** Seconds a throw takes on screen, from turn start to the next turn. */
const throwSeconds = (aim, shot, error, moved) =>
  0.4 +
  Math.hypot(aim.x, aim.y) / 0.65 +
  Math.max(0, Math.min(2.2, (0.7 + error) * 1.5)) +
  0.44 +
  (shot === 'airmail' ? 1.25 : 0.88) +
  (moved ? 0.45 : 0) +
  1.2;

const HABITS = new Map();
function playMatch({ rules, seats, seed }) {
  const rng = seeded(seed);
  const ids = seats.map((_, i) => 'p' + i);
  const models = seats.map((s, i) => ({
    ...CARDS[s.card],
    id: ids[i],
    sigma: s.sigma,
    bias: s.bias ?? 0,
  }));
  let order = ids.map((_, i) => i),
    bags = [],
    round = 0,
    serial = 0,
    seconds = 1.45;
  const match = Object.fromEntries(ids.map((id) => [id, 0]));
  const throws = [];
  const leaderTrace = [];
  const rounds = [];
  const n = seats.length;
  for (;;) {
    for (let k = 0; k < n * 4; k++) {
      const seat = order[k % n],
        me = models[seat],
        policy = seats[seat].policy;
      const next = [];
      for (let j = 1; j <= Math.min(n, n * 4 - k - 1); j++) {
        const s = order[(k + j) % n];
        if (s !== seat) next.push(models[s]);
      }
      const ctx = {
        board: rules.board,
        bags,
        me,
        next: next.slice(0, 1),
        rivals: ids.filter((id) => id !== me.id),
        clutchNow: k >= n * 3,
      };
      const evals = T.plan(ctx);
      // The best option on an empty board for the same thrower and situation:
      // a board-independent habit (e.g. "aim a touch long"), not a decision.
      const habitKey = `${rules.board}:${me.id}:${seats[seat].card}:${me.sigma}:${ctx.clutchNow}:${next[0]?.sigma ?? '-'}:${next[0] ? seats[order[(k + 1) % n]].card : '-'}`;
      let habit = HABITS.get(habitKey);
      if (!habit) {
        habit = T.plan({ ...ctx, bags: [] })[0].option;
        HABITS.set(habitKey, habit);
      }
      const habitValue =
        habit === evals[0].option
          ? evals[0].value
          : evals.find(
              (e) =>
                e.option.shot === habit.shot && e.option.kind === habit.kind,
            ).value;
      const def = evals.find(
        (e) => e.option.shot === me.favourite && e.option.kind === 'hole',
      );
      const choice = policy === 'tactical' ? evals[0].option : def.option;
      const window = R.releaseWindow(
        me.skill[choice.shot],
        false,
        ctx.clutchNow && me.clutch,
      );
      const error = me.bias + gauss(rng) * me.sigma;
      const rest = R.restPoint(
        {
          error,
          window,
          accuracy: me.accuracy,
          precision: false,
          shot: choice.shot,
          aim: choice.aim,
          board: rules.board,
        },
        rng(),
        rng(),
      );
      const before = R.bagTotals(ids, bags);
      const res = R.resolveThrow(
        rules,
        'b' + serial++,
        me.id,
        choice.shot,
        rest,
        bags,
      );
      const after = R.bagTotals(ids, bags);
      const moved = res.motions.some(
        (m) => Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 1,
      );
      seconds += throwSeconds(
        choice.aim,
        choice.shot,
        error,
        rules.board === 'crowded' && moved,
      );
      const delta = Object.fromEntries(
        ids.map((id) => [id, after[id] - before[id]]),
      );
      throws.push({
        round,
        player: me.id,
        card: seats[seat].card,
        policy,
        shot: choice.shot,
        kind: choice.kind,
        perfect: Math.abs(error) <= window,
        points: res.landed.points,
        delta,
        tags: res.tags,
        gap: evals[0].value - def.value,
        boardGap: evals[0].value - habitValue,
        best: evals[0].option.shot + ':' + evals[0].option.kind,
        top2: evals.length > 1 ? evals[0].value - evals[1].value : 0,
        bagsOnBoard: bags.filter((b) => b.points === 1).length,
      });
      // Standing after this throw, in the match's own scoring terms.
      const standing =
        rules.scoring === 'total'
          ? after
          : Object.fromEntries(
              ids.map((id) => [
                id,
                match[id] + (R.inningAward(after)[id] ?? 0),
              ]),
            );
      const top = Math.max(...Object.values(standing));
      const leaders = ids.filter((id) => standing[id] === top);
      leaderTrace.push(leaders.length === 1 ? leaders[0] : null);
    }
    if (rules.scoring === 'total') {
      const totals = R.bagTotals(ids, bags);
      return finish(totals);
    }
    const totals = R.bagTotals(ids, bags),
      award = R.inningAward(totals);
    rounds.push({ totals, award });
    for (const id of ids) match[id] += award[id];
    const scorer = ids.find((id) => award[id] > 0);
    round++;
    bags = [];
    if (
      Math.max(...Object.values(match)) >= rules.target ||
      round >= rules.maxRounds
    )
      return finish(match);
    if (scorer) {
      const s = ids.indexOf(scorer);
      order = ids.map((_, i) => (s + i) % n);
    }
  }
  function finish(scores) {
    const top = Math.max(...Object.values(scores));
    const winners = ids.filter((id) => scores[id] === top);
    // Lead changes: the sole leader differs from the previous sole leader.
    let changes = 0,
      last = null;
    for (const l of leaderTrace) {
      if (l && last && l !== last) changes++;
      if (l) last = l;
    }
    // Was the result already certain before the last throw? (no bag can score more than 3, plus 2 per shoved bag)
    const half = leaderTrace[Math.floor(leaderTrace.length / 2) - 1];
    return {
      scores,
      winners,
      throws,
      rounds,
      seconds,
      leadChanges: changes,
      comeback: winners.length === 1 && half && half !== winners[0],
      lastThrower: throws.at(-1).player,
      margin: top - Math.min(...Object.values(scores)),
    };
  }
}

const VARIANTS = {
  shipped: { board: 'classic', scoring: 'total', target: 11, maxRounds: 5 },
  crowded: { board: 'crowded', scoring: 'total', target: 11, maxRounds: 5 },
  innings: { board: 'classic', scoring: 'innings', target: 11, maxRounds: 5 },
  'crowded+innings': {
    board: 'crowded',
    scoring: 'innings',
    target: 11,
    maxRounds: 5,
  },
  // A shorter innings match: first to 7, three rounds at most.
  'crowded+innings7': {
    board: 'crowded',
    scoring: 'innings',
    target: 7,
    maxRounds: 3,
  },
};
const REGULAR = 0.045; // ~68 ms std. dev.: an attentive casual player
const SHARP = 0.027; // ~40 ms
const LOOSE = 0.075; // ~112 ms: first few matches
const STOCK_AI = { sigma: 0.0647, bias: -0.048 }; // the shipped AI's uniform error, as a normal

const MATCHUPS = {
  // Does thinking about the board win more? Same hands, same cards rotated.
  'tactical-vs-default': [
    { policy: 'tactical', sigma: REGULAR },
    { policy: 'default', sigma: REGULAR },
  ],
  // Do hands still matter? Both play the board.
  'sharp-vs-regular': [
    { policy: 'tactical', sigma: SHARP },
    { policy: 'tactical', sigma: REGULAR },
  ],
  // A new player against the stock AI's timing.
  'loose-vs-ai': [
    { policy: 'default', sigma: LOOSE },
    { policy: 'tactical', ...STOCK_AI },
  ],
  // Mirror: both regular, both tactical. Pacing, tension, hammer, balance.
  mirror: [
    { policy: 'tactical', sigma: REGULAR },
    { policy: 'tactical', sigma: REGULAR },
  ],
};

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (x) => Math.round(x * 1000) / 10;
const quant = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const entropy = (counts) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const k = Object.keys(counts).length;
  if (!total || k < 2) return 0;
  return (
    -Object.values(counts).reduce(
      (h, c) => (c ? h + (c / total) * Math.log(c / total) : h),
      0,
    ) / Math.log(12)
  );
};

const ONLY = arg('variants', '');
const results = {};
const started = Date.now();
for (const [vname, rules] of Object.entries(VARIANTS)) {
  if (ONLY && !ONLY.split(',').includes(vname)) continue;
  results[vname] = {};
  for (const [mname, pair] of Object.entries(MATCHUPS)) {
    const games = [];
    for (let i = 0; i < MATCHES; i++) {
      // Rotate cards and seats so neither card nor seat biases a matchup.
      const cards = i % 2 ? ['Dan', 'Doug'] : ['Doug', 'Dan'];
      const swap = Math.floor(i / 2) % 2 === 1;
      const seats = (swap ? [pair[1], pair[0]] : pair).map((s, k) => ({
        ...s,
        card: cards[k],
        side: swap ? 1 - k : k,
      }));
      const g = playMatch({ rules, seats, seed: `sim:${vname}:${mname}:${i}` });
      g.seats = seats;
      games.push(g);
    }
    const allThrows = games.flatMap((g) => g.throws);
    const sideWins = [0, 1].map((side) =>
      mean(
        games.map((g) => {
          const k = g.seats.findIndex((s) => s.side === side);
          const id = 'p' + k;
          return g.winners.includes(id) ? 1 / g.winners.length : 0;
        }),
      ),
    );
    const cardWins = Object.fromEntries(
      ['Doug', 'Dan'].map((card) => [
        card,
        pct(
          mean(
            games.map((g) => {
              const k = g.seats.findIndex((s) => s.card === card);
              return g.winners.includes('p' + k) ? 1 / g.winners.length : 0;
            }),
          ),
        ),
      ]),
    );
    const tactical = allThrows.filter((t) => t.policy === 'tactical');
    const choiceCounts = {};
    for (const t of tactical)
      choiceCounts[t.shot + ':' + t.kind] =
        (choiceCounts[t.shot + ':' + t.kind] ?? 0) + 1;
    const tagCounts = {};
    for (const t of allThrows)
      for (const tag of new Set(t.tags))
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    results[vname][mname] = {
      matches: games.length,
      winRate: {
        [pair[0].policy + '@' + pair[0].sigma]: pct(sideWins[0]),
        [pair[1].policy + '@' + pair[1].sigma]: pct(sideWins[1]),
      },
      cardWinRate: cardWins,
      drawRate: pct(mean(games.map((g) => (g.winners.length > 1 ? 1 : 0)))),
      lastThrowerWins: pct(
        mean(
          games.map((g) =>
            g.winners.length === 1 && g.winners[0] === g.lastThrower ? 1 : 0,
          ),
        ),
      ),
      throwsPerMatch:
        Math.round(mean(games.map((g) => g.throws.length)) * 10) / 10,
      rounds:
        Math.round(mean(games.map((g) => g.rounds.length || 1)) * 100) / 100,
      seconds: {
        mean: Math.round(mean(games.map((g) => g.seconds))),
        p90: Math.round(
          quant(
            games.map((g) => g.seconds),
            0.9,
          ),
        ),
        max: Math.round(Math.max(...games.map((g) => g.seconds))),
      },
      leadChanges:
        Math.round(mean(games.map((g) => g.leadChanges)) * 100) / 100,
      comebackRate: pct(mean(games.map((g) => (g.comeback ? 1 : 0)))),
      marginMedian: quant(
        games.map((g) => g.margin),
        0.5,
      ),
      perfectRate: pct(mean(allThrows.map((t) => (t.perfect ? 1 : 0)))),
      holeRate: pct(mean(allThrows.map((t) => (t.points === 3 ? 1 : 0)))),
      perfectHoleRate: pct(
        mean(
          allThrows
            .filter((t) => t.perfect)
            .map((t) => (t.points === 3 ? 1 : 0)),
        ),
      ),
      // Meaningful decision: the board in front of the thrower makes some
      // option at least 0.25 points better than what they would throw on an
      // empty board in the same situation.
      decisionThrows: pct(
        mean(allThrows.map((t) => (t.boardGap >= 0.25 ? 1 : 0))),
      ),
      decisionGapMean:
        Math.round(mean(allThrows.map((t) => t.boardGap)) * 100) / 100,
      // Any improvement at all over "favourite shot at the hole" (includes
      // board-independent habits such as aiming a touch long).
      overDefaultThrows: pct(
        mean(allThrows.map((t) => (t.gap >= 0.25 ? 1 : 0))),
      ),
      // Close calls: the best two options are within 0.15 points and differ in shot.
      interactionThrows: pct(
        mean(allThrows.map((t) => (t.tags.length ? 1 : 0))),
      ),
      tags: tagCounts,
      tacticalChoices: choiceCounts,
      tacticalChoiceEntropy: Math.round(entropy(choiceCounts) * 100) / 100,
      boardBagsAtLastThrow:
        Math.round(mean(games.map((g) => g.throws.at(-1).bagsOnBoard)) * 10) /
        10,
    };
    process.stderr.write(
      `${vname} / ${mname}: ${games.length} matches, ${((Date.now() - started) / 1000).toFixed(0)} s\n`,
    );
  }
}
const report = {
  generated: 'deterministic; rerun with the same --matches to reproduce',
  matchesPerCell: MATCHES,
  timingModels: { SHARP, REGULAR, LOOSE, STOCK_AI },
  cards: CARDS,
  results,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(results, null, 1));
