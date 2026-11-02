// Transpile lib/arena into .test-build exactly as tests/run-tests.mjs does, so
// experiment simulations can run without the full test suite.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
fs.mkdirSync('.test-build', { recursive: true });
// The reviewed motion defaults are the same JSON inputs used by normal matches.
for (const id of ['doug', 'dan']) {
  const folder = '.test-build/engine/performance/profiles';
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    `${folder}/${id}.mjs`,
    'export default ' +
      fs.readFileSync(
        `lib/arena/engine/performance/profiles/${id}.json`,
        'utf8',
      ) +
      ';',
  );
}
fs.writeFileSync(
  '.test-build/motion-catalog.mjs',
  'export default ' +
    fs.readFileSync('lib/arena/motion-catalog.json', 'utf8') +
    ';',
);
fs.writeFileSync(
  '.test-build/puppet-assets.mjs',
  'export default ' +
    fs.readFileSync('lib/arena/puppet-assets.json', 'utf8') +
    ';',
);
// Preserve relative module identities (the catalog is intentionally mutable).
function transpileDirectory(dir, relative = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name),
      file = path.join(dir, entry.name),
      dest = path.join('.test-build', rel.replace(/\.ts$/, '.mjs'));
    if (entry.isDirectory()) {
      transpileDirectory(file, rel);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const result = ts
      .transpileModule(fs.readFileSync(file, 'utf8'), {
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
    fs.writeFileSync(dest, result);
  }
}
transpileDirectory('lib/arena');
