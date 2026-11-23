// Headless runner for core/checks.ts.
//   node --import ./prototype/character-lab/core/ts-loader.mjs prototype/character-lab/core/run-checks.mjs [--deep] [--all] [--json out.json]
// --deep adds "every command in every phase" (slow); --all prints passing lines too.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const { runChecks } = await import('./checks.ts');
const { defaultProportions, lankyProportions, sanitizeProportions } = await import('./proportions.ts');
const { dougStyle } = await import('../styles/doug.ts');
const { danStyle } = await import('../styles/dan.ts');

const args = process.argv.slice(2);
const rig = (id) => {
  const file = here(`../rigs/${id}/proportions.json`);
  return fs.existsSync(file) ? sanitizeProportions(JSON.parse(fs.readFileSync(file, 'utf8'))) : null;
};
const configs = [
  { label: 'doug/default', proportions: defaultProportions(), style: dougStyle },
  { label: 'dan/default', proportions: defaultProportions(), style: danStyle },
  { label: 'doug/lanky', proportions: lankyProportions(), style: dougStyle },
  { label: 'dan/lanky', proportions: lankyProportions(), style: danStyle },
];
for (const [id, style] of [['doug', dougStyle], ['dan', danStyle]]) {
  const p = rig(id);
  if (p) configs.push({ label: `${id}/rig`, proportions: p, style });
}
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const started = Date.now();
const report = runChecks(only ? configs.filter((c) => c.label === only) : configs, { deep: args.includes('--deep') });
const showAll = args.includes('--all');
let pass = 0;
for (const l of report.lines) {
  if (l.ok) pass++;
  if (!l.ok || showAll || l.limit === 'info') {
    console.log(`${l.ok ? (l.limit === 'info' ? 'info' : 'ok  ') : 'FAIL'}  ${l.name}: ${l.measured}  [${l.limit}]${!l.ok && l.where ? `\n        at ${l.where}` : ''}`);
  }
}
console.log(`\n${pass}/${report.lines.length} checks passed in ${((Date.now() - started) / 1000).toFixed(1)} s -> ${report.ok ? 'PASS' : 'FAIL'}`);
if (args.includes('--json')) fs.writeFileSync(args[args.indexOf('--json') + 1], JSON.stringify(report, null, 1));
process.exitCode = report.ok ? 0 : 1;
