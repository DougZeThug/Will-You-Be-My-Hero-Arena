// Prints the README's result tables from one or more simulator JSON files.
//
//   node scripts/experiments/summarize-sim.mjs work/qa/gameplay-lab/real/sim-*.json
import fs from 'node:fs';

const files = process.argv.slice(2);
const results = {};
let meta;
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  meta ??= r;
  // Files may hold different matchups of the same variant: merge per variant.
  for (const [v, cells] of Object.entries(r.results))
    results[v] = { ...(results[v] ?? {}), ...cells };
}
const order = ['shipped', 'real-v1', 'real'];
const variants = order.filter((v) => results[v]);
const cell = (v, m, f) => {
  const x = results[v]?.[m];
  if (!x) return '–';
  const out = f(x);
  return out === null || out === undefined ? '–' : out;
};
const row = (label, m, f) =>
  `| ${label} | ${variants.map((v) => cell(v, m, f)).join(' | ')} |`;
const head = `| | ${variants.join(' | ')} |\n|---|${variants.map(() => '---').join('|')}|`;
const first = (x) => Object.values(x.winRate)[0];
const out = [];
out.push(
  `Matches per cell: ${files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')).matchesPerCell).join(', ')} (by file). Timing models (release error std. dev., power units; 0.0667 ≈ 100 ms): sharp ${meta.timingModels.SHARP}, regular ${meta.timingModels.REGULAR}, loose ${meta.timingModels.LOOSE}; both AIs' error is modelled as mean ${meta.timingModels.STOCK_AI.bias}, sd ${meta.timingModels.STOCK_AI.sigma.toFixed(3)}.`,
  '',
  '### Even players (both regular timing, both board-aware)',
  '',
  head,
  row(
    'Board-dependent decisions (% of throws)',
    'mirror',
    (x) => x.decisionThrows,
  ),
  row(
    'Mean value of reading the board (points/throw)',
    'mirror',
    (x) => x.decisionGapMean,
  ),
  row('Throws touching another bag (%)', 'mirror', (x) => x.interactionThrows),
  row('Shot-choice entropy (0–1)', 'mirror', (x) => x.tacticalChoiceEntropy),
  row('Hole rate (%)', 'mirror', (x) => x.holeRate),
  row('Perfect releases that scored 3 (%)', 'mirror', (x) => x.perfectHoleRate),
  row(
    'Deliberate guards (per 1,000 throws)',
    'mirror',
    (x) => x.guards?.perThousand,
  ),
  row('Draws (%)', 'mirror', (x) => x.drawRate),
  row('Innings that cancel out (%)', 'mirror', (x) =>
    x.rounds > 1 ? x.cancelledInnings : null,
  ),
  row('Points scored per inning', 'mirror', (x) =>
    x.rounds > 1 ? x.pointsPerInning : null,
  ),
  row(
    'Innings per game, mean / p90 / max',
    'mirror',
    (x) => `${x.rounds} / ${x.inningsP90} / ${x.inningsMax}`,
  ),
  row('Games stopped by the 40-inning cap (%)', 'mirror', (x) =>
    x.rounds > 1 ? x.capRate : null,
  ),
  row(
    'Game length, mean / p90 (min)',
    'mirror',
    (x) =>
      `${(x.seconds.mean / 60).toFixed(1)} / ${(x.seconds.p90 / 60).toFixed(1)}`,
  ),
  row('Lead changes per game (counting the inning in progress)', 'mirror', (x) => x.leadChanges),
  row('Winner was behind at halfway (%)', 'mirror', (x) => x.comebackRate),
  row(
    'Doug / Dan win share (%)',
    'mirror',
    (x) => `${x.cardWinRate.Doug} / ${x.cardWinRate.Dan}`,
  ),
  '',
  '### Skill expression (win share of the first-named side, draws split; seats and cards rotated)',
  '',
  head,
  row(
    'Board-aware vs favourite-shot-at-the-hole, same timing',
    'tactical-vs-default',
    first,
  ),
  row('Sharp vs regular timing, both board-aware', 'sharp-vs-regular', first),
  row('New player (loose, favourite shot) vs easy AI', 'loose-vs-easy', first),
  row('New player vs hard AI', 'loose-vs-hard', first),
  row('Regular player (favourite shot) vs easy AI', 'regular-vs-easy', first),
  row('Regular player vs hard AI', 'regular-vs-hard', first),
  '',
  '### Game length against the AI (min, mean / p90)',
  '',
  head,
  ...[
    'loose-vs-easy',
    'loose-vs-hard',
    'regular-vs-easy',
    'regular-vs-hard',
    'sharp-vs-regular',
  ].map((m) =>
    row(
      m,
      m,
      (x) =>
        `${(x.seconds.mean / 60).toFixed(1)} / ${(x.seconds.p90 / 60).toFixed(1)}`,
    ),
  ),
  '',
  '### What the board-aware thrower chose (even players)',
  '',
  ...variants
    .filter((v) => results[v].mirror)
    .map(
      (v) =>
        `- **${v}**: ${Object.entries(results[v].mirror.tacticalChoices)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}. Events: ${
          Object.entries(results[v].mirror.tags)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${k} ${n}`)
            .join(', ') || 'none'
        }.`,
    ),
);
console.log(out.join('\n'));
