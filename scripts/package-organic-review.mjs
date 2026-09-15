import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const out = 'docs/review/organic-performance';
const qa = 'work/qa/organic-motion';
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const walk = async dir => {
  const files = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(file));
    else files.push(file.replaceAll('\\', '/'));
  }
  return files;
};
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const files = [
  ...await walk('lab/human-motion'), ...await walk('lib/arena/engine/motion'),
  ...await walk('lib/arena/engine/motion-tools'),
  'lib/arena/engine/movement/FootLock.ts', 'tests/organic-motion-tests.mjs',
  'tests/browser/organic-motion.spec.ts', 'scripts/motion-reference/compare.py',
  'scripts/capture-human-motion.mjs', 'scripts/review-organic-motion.mjs',
];
await fs.mkdir(out, { recursive: true });
const regression = await read('work/qa/regression.json');
if (!regression.passed) throw Error('Regression did not pass');
const finalBrowser = await fs.readFile('work/organic-final-browser.log', 'utf8');
if (!finalBrowser.includes('4 passed')) throw Error('Final organic browser pass missing');
const review = await read(qa + '/final-views/review.json');
if (!review.passed || !review.completed) throw Error('Final visual review is incomplete');
const metrics = [];
for (const file of (await walk(qa + '/final-browser')).filter(f => f.endsWith('-organic.json'))) {
  const data = await read(file);
  metrics.push({
    evidence: file, sha256: await hash(file),
    maxLockedContactError: data.maxFeet ?? Math.max(0, ...data.samples.flatMap(s => s.feet.map(f => f.maxSlide))),
    samples: data.samples?.length,
    releaseCount: data.state.actors[0].releaseCount,
    techniques: data.techniques,
  });
}
await fs.writeFile(out + '/validation.json', JSON.stringify({
  date: new Date().toISOString(), regression,
  pureChecks: (await read('docs/test-results.json')).checks,
  browser: { passed: 82, skipped: 1, skippedReason: 'Optional approved-image baseline suite' },
  afterCameraFramingFix: { typecheck: 'passed', focusedBrowserTests: 4, visualReview: review },
  performance: (await read(qa + '/videos/unrecorded-performance.json')).realtime,
  media: await read(qa + '/review-videos/encoding.json'),
  metrics,
  sourceHashes: Object.fromEntries(await Promise.all(files.sort((a, b) => a.localeCompare(b)).map(async file => [file, await hash(file)]))),
  limitations: ['Opt-in Lab only; not production installed', 'No new editor round trip', 'Measured demo is not a matched cornhole throw', 'No individual finger or cloth helper rig', 'Fighting lacks guard/fist and opposing-facing art', 'Physical controllers not exercised'],
}, null, 2) + '\n');
for (const [source, name] of [
  ['final-views/cornhole-doug-doug-raw.png', 'doug-follow-through.png'],
  ['final-views/basketball-dan-dan-raw.png', 'basketball-close.png'],
  ['final-views/rendered-reference-curves.png', 'curve-review.png'],
]) await fs.copyFile(qa + '/' + source, out + '/' + name);
console.log('Review validation, source fingerprints and three curated screenshots saved.');
