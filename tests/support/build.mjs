import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Builds the modules the Node tests import into `.test-build`.
// `lib/arena/**` keeps its historical flat layout (`lib/arena/engine/x.ts` ->
// `.test-build/engine/x.mjs`). Lab-owned modules that tests exercise are
// listed explicitly and keep their repository path under `.test-build/lab/`;
// production code never imports Lab, so the dependency only points this way.
const outDir = '.test-build';
const libRoot = 'lib/arena';
const labSources = [
  'lab/FrameTelemetry.ts',
  'lab/anatomy',
  'lab/human-motion/BasketballFlight.ts',
  'lab/human-motion/CharacterProximity.ts',
  'lab/human-motion/PropPerformance.ts',
  'lab/human-motion/events/ScreenBagDynamics.ts',
  'lab/human-motion/motion',
  'lab/human-motion/motion-tools',
];

// Repository-relative source path -> path inside `.test-build` (no extension
// change). Everything else lives outside the build and is left untouched.
function outputRelative(source) {
  return source.startsWith(libRoot + '/')
    ? source.slice(libRoot.length + 1)
    : source;
}

function jsonWrapper(source, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(
    dest,
    'export default ' + fs.readFileSync(source, 'utf8') + ';',
  );
}

// Rewrites relative specifiers so the emitted file points at the built
// location of its dependency, whichever tree (lib or Lab) it came from.
function rewriteSpecifier(source, dest, specifier) {
  const target = path
    .join(path.dirname(source), specifier)
    .split(path.sep)
    .join('/');
  const built = outputRelative(target).replace(/\.json$/, '');
  let relative = path
    .relative(path.dirname(dest), path.join(outDir, built))
    .split(path.sep)
    .join('/');
  if (!relative.startsWith('.')) relative = './' + relative;
  return relative + '.mjs';
}

function transpileFile(source) {
  const dest = path.join(
    outDir,
    outputRelative(source).replace(/\.ts$/, '.mjs'),
  );
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const result = ts
    .transpileModule(fs.readFileSync(source, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replace(
      /(from|import) (['"])(\.[^'"]+)\2/g,
      (_, keyword, q, url) =>
        keyword + ' ' + q + rewriteSpecifier(source, dest, url) + q,
    );
  fs.writeFileSync(dest, result);
}

function transpileTree(entry) {
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    if (entry.endsWith('.ts')) transpileFile(entry);
    return;
  }
  for (const name of fs.readdirSync(entry).sort())
    transpileTree(path.posix.join(entry, name));
}

export function buildTestModules() {
  fs.mkdirSync(outDir, { recursive: true });
  // The reviewed motion defaults are the same JSON inputs used by normal matches.
  for (const id of ['doug', 'dan'])
    jsonWrapper(
      `${libRoot}/engine/performance/profiles/${id}.json`,
      `${outDir}/engine/performance/profiles/${id}.mjs`,
    );
  jsonWrapper(`${libRoot}/motion-catalog.json`, `${outDir}/motion-catalog.mjs`);
  jsonWrapper(`${libRoot}/puppet-assets.json`, `${outDir}/puppet-assets.mjs`);
  // Preserve relative module identities (the catalog is intentionally mutable).
  transpileTree(libRoot);
  for (const entry of labSources) transpileTree(entry);
}
