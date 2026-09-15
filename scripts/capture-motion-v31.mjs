import { spawnSync } from 'node:child_process';
const root = 'work/qa/v31-review';
const takes = [
  [
    'dan',
    [
      '--events=cornhole,running,basketball,fighting',
      '--actor=dan',
      '--takes=1',
      '--rates=1,.25',
      '--seconds=4',
    ],
  ],
  [
    'doug',
    [
      '--events=cornhole,running,basketball,fighting',
      '--actor=doug',
      '--takes=1',
      '--rates=1,.25',
      '--seconds=4',
      '--query=focus=doug',
    ],
  ],
  ['combat', ['--events=fighting', '--rates=1,.25', '--seconds=5']],
  [
    'silhouette',
    [
      '--events=cornhole,running,basketball,fighting',
      '--actor=doug',
      '--takes=1',
      '--rates=.25',
      '--seconds=4',
      '--silhouette=1',
      '--query=focus=doug',
    ],
  ],
  ...['chestTap', 'bagFlip', 'fistPump'].map((action) => [
    action,
    [
      '--events=cornhole',
      '--actor=doug',
      '--takes=1',
      '--action=' + action,
      '--rates=1,.5,.25',
      '--seconds=3.3',
      '--query=focus=doug',
    ],
  ]),
];
for (const [name, args] of takes) {
  const combatOnly = process.argv.includes('--combat-only');
  if (combatOnly && !['dan', 'doug', 'combat', 'silhouette'].includes(name))
    continue;
  const captureArgs = combatOnly
    ? args.map((arg) =>
        arg.startsWith('--events=') ? '--events=fighting' : arg,
      )
    : args;
  console.log('V3.1 continuous review:', name);
  const result = spawnSync(
    process.execPath,
    [
      'scripts/capture-human-motion.mjs',
      ...captureArgs,
      '--out=' + root + '/' + name,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
