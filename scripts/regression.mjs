import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const started = new Date().toISOString();
const checks = [
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['simulation-and-animation', ['tests/run-tests.mjs']],
  ['browser', ['scripts/browser-tests.mjs']],
  ['production-build', ['scripts/build.mjs']],
  ['production-isolation', ['scripts/production-smoke.mjs']],
];
const results = [];
for (const [name, args] of checks) {
  console.log(`\nArena regression: ${name}`);
  const before = performance.now();
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
  });
  results.push({
    name,
    passed: result.status === 0,
    exitCode: result.status,
    seconds: +(performance.now() - before).toFixed(0) / 1000,
    error: result.error?.message,
  });
}
mkdirSync('work/qa', { recursive: true });
const report = {
  started,
  completed: new Date().toISOString(),
  passed: results.every((r) => r.passed),
  checks: results,
  deployment: 'Not performed',
  controllerValidation:
    'Synthetic browser Gamepad API; physical hardware requires a separate manual pass',
};
writeFileSync(
  'work/qa/regression.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed ? 0 : 1;
