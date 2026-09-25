import { readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

// Transpile the validator and the runtime compiler (plus their runtime
// dependency tree) into an isolated stage, mirroring tests/run-tests.mjs.
// The promotion command is the documented primary gate for shipped profiles,
// so it must reject anything the runtime compiler rejects before stamping the
// candidate into lib/arena/engine/performance/profiles — validating alone is
// not enough once a wide field (e.g. followThrough) and a corroborating one
// (e.g. posture) combine within the validator's ranges but outside the
// compiler's per-frame native limits.
const stage = path.join(os.tmpdir(), 'arena-apply-profile');
fs.rmSync(stage, { recursive: true, force: true });
const transpile = (absFile, repoRel) => {
  const dest = path.join(stage, repoRel.replace(/\.ts$/, '.mjs'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const output = ts
    .transpileModule(fs.readFileSync(absFile, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replace(
      /from (['"])(\.[^'"]+)\1/g,
      (_, q, url) =>
        'from ' +
        q +
        url.replace(/\.json$/, '.mjs') +
        (url.endsWith('.json') ? '' : '.mjs') +
        q,
    )
    .replace(
      /import (['"])(\.[^'"]+)\1/g,
      (_, q, url) => 'import ' + q + url + '.mjs' + q,
    );
  fs.writeFileSync(dest, output);
};
const transpileDir = (dir, rel = '') => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(rel, entry.name),
      file = path.join(dir, entry.name);
    if (entry.isDirectory()) transpileDir(file, next);
    else if (entry.name.endsWith('.ts')) transpile(file, next);
  }
};
transpileDir('lib/arena', 'lib/arena');
transpile(
  path.resolve('lab/loongbones/cornhole-motion/curves.ts'),
  'lab/loongbones/cornhole-motion/curves.ts',
);
transpile(
  path.resolve('lab/performance/compile.ts'),
  'lab/performance/compile.ts',
);
const moduleUrl = (repoRel) =>
  new URL('file://' + path.join(stage, repoRel.replace(/\.ts$/, '.mjs'))).href;
const { validatePerformanceProfile } = await import(
  moduleUrl('lib/arena/engine/performance/ProfileValidation.ts')
);
const { compilePerformance } = await import(
  moduleUrl('lab/performance/compile.ts')
);

const file = process.argv[2];
if (!file)
  throw Error(
    'Usage: node scripts/apply-performance-profile.mjs candidate.json',
  );
const candidate = validatePerformanceProfile(
  JSON.parse(await readFile(file, 'utf8')),
);
// Compile-check the validated candidate before writing it: the validator's
// numeric ranges can permit a field combination the runtime rejects (a high
// followThrough with a corroborating posture drives upper_arm_L below its
// native floor). Throw before writeFile so the shipped set never carries a
// profile the match path's LoongBonesAdapter construct will throw on.
try {
  compilePerformance(candidate);
} catch (error) {
  throw Error(
    `Candidate "${candidate.id}" passes validation but fails runtime compilation:\n${error.message}\n` +
      'Narrow a wide field (e.g. followThrough or posture) until the compiler accepts it.',
  );
}
// The profiles directory is overridable for isolated testing; the default is
// the shipped set the normal match reads at runtime.
const profilesDir =
  process.env.ARENA_PROFILES_DIR ?? 'lib/arena/engine/performance/profiles';
const target = path.join(profilesDir, `${candidate.id}.json`);
await writeFile(target, JSON.stringify(candidate, null, 2) + '\n');
console.log(
  `Updated ${target}. Run the turn review, then rebuild the normal match.`,
);
