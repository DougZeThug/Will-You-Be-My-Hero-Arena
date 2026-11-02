// Merge per-variant simulation JSON files into Markdown tables.
//   node scripts/experiments/summarize-sim.mjs work/qa/gameplay-lab/sim-*.json > out.md
import fs from 'node:fs';

const files = process.argv.slice(2);
const results = {};
let meta;
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  meta ??= r;
  Object.assign(results, r.results);
}
const order = [
  'shipped',
  'innings',
  'crowded',
  'crowded+innings',
  'crowded+innings7',
];
const variants = order.filter((v) => results[v]);
const row = (label, f) =>
  `| ${label} | ${variants.map((v) => f(results[v])).join(' | ')} |`;
const head = `| | ${variants.join(' | ')} |\n|---|${variants.map(() => '---').join('|')}|`;
const pairs = (x) => Object.values(x.winRate).join(' / ');
const out = [];
out.push(
  `Matches per cell: ${meta.matchesPerCell}. Timing models (release error std. dev., power units; 0.0667 ≈ 100 ms): sharp ${meta.timingModels.SHARP}, regular ${meta.timingModels.REGULAR}, loose ${meta.timingModels.LOOSE}; the shipped AI's error is modelled as mean ${meta.timingModels.STOCK_AI.bias}, sd ${meta.timingModels.STOCK_AI.sigma.toFixed(3)}.`,
  '',
  '### Mirror match (both regular timing, both board-aware)',
  '',
  head,
  row(
    'Board-dependent decisions (% of throws)',
    (x) => x.mirror.decisionThrows,
  ),
  row(
    'Mean value of reading the board (points/throw)',
    (x) => x.mirror.decisionGapMean,
  ),
  row('Throws touching another bag (%)', (x) => x.mirror.interactionThrows),
  row('Shot-choice entropy (0–1)', (x) => x.mirror.tacticalChoiceEntropy),
  row('Hole rate (%)', (x) => x.mirror.holeRate),
  row('Perfect releases that scored 3 (%)', (x) => x.mirror.perfectHoleRate),
  row('Draws (%)', (x) => x.mirror.drawRate),
  row('Lead changes per match', (x) => x.mirror.leadChanges),
  row('Winner was behind at halfway (%)', (x) => x.mirror.comebackRate),
  row('Median final margin', (x) => x.mirror.marginMedian),
  row('Thrower of the last bag wins (%)', (x) => x.mirror.lastThrowerWins),
  row(
    'Doug / Dan win share (%)',
    (x) => `${x.mirror.cardWinRate.Doug} / ${x.mirror.cardWinRate.Dan}`,
  ),
  row('Rounds per match', (x) => x.mirror.rounds),
  row(
    'Match length, mean / p90 / max (s)',
    (x) =>
      `${x.mirror.seconds.mean} / ${x.mirror.seconds.p90} / ${x.mirror.seconds.max}`,
  ),
  '',
  '### Skill expression (win share, draws split; seats and cards rotated)',
  '',
  head,
  row('Board-aware vs favourite-shot-at-the-hole, same timing', (x) =>
    pairs(x['tactical-vs-default']),
  ),
  row('Sharp vs regular timing, both board-aware', (x) =>
    pairs(x['sharp-vs-regular']),
  ),
  row('New player (loose, default) vs AI-timed board-aware', (x) =>
    pairs(x['loose-vs-ai']),
  ),
  row(
    'Board-dependent decisions in new-player games (%)',
    (x) => x['loose-vs-ai'].decisionThrows,
  ),
  '',
  '### What the board-aware thrower chose (mirror)',
  '',
  ...variants.map(
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
