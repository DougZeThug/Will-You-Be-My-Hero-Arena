import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
// Reuse the pure runtime validator; no browser or debug hook writes source files.
const source = await readFile(
  'lib/arena/engine/performance/ProfileValidation.ts',
  'utf8',
);
const validatorCode = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const { validatePerformanceProfile } = await import(
  'data:text/javascript;base64,' + Buffer.from(validatorCode).toString('base64')
);
const file = process.argv[2];
if (!file)
  throw Error(
    'Usage: node scripts/apply-performance-profile.mjs candidate.json',
  );
const candidate = validatePerformanceProfile(
  JSON.parse(await readFile(file, 'utf8')),
);
const target = `lib/arena/engine/performance/profiles/${candidate.id}.json`;
await writeFile(target, JSON.stringify(candidate, null, 2) + '\n');
console.log(
  `Updated ${target}. Run the turn review, then rebuild the normal match.`,
);
