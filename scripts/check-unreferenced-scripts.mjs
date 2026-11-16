import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Fails when a file under scripts/ is not referenced from package.json,
// .github, another referenced script, tests, lab, other READMEs, agent config
// or a non-historical doc. docs/review and docs/checkpoints are historical
// records and scripts/README.md is a pure index of scripts; none of them keep
// a script alive.
const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8', maxBuffer: 1 << 28 },
)
  .split('\n')
  .filter((file) => file && existsSync(file));
const scriptFiles = listed.filter(
  (file) => file.startsWith('scripts/') && file !== 'scripts/README.md',
);
const binary =
  /\.(?:png|jpe?g|webp|gif|mp4|webm|woff2?|ico|pdf|zip|glb|ogg|wav|mp3)$/i;
const historical = (file) =>
  file.startsWith('docs/review/') || file.startsWith('docs/checkpoints/');
const sources = listed.filter(
  (file) =>
    !binary.test(file) &&
    !historical(file) &&
    !file.startsWith('scripts/') &&
    statSync(file).size < 2_000_000,
);
const cache = new Map();
const read = (file) => {
  if (!cache.has(file)) cache.set(file, readFileSync(file, 'utf8'));
  return cache.get(file);
};
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text, script) => {
  const pattern = `(?:${escape(script)}|${escape(path.basename(script))})`;
  return new RegExp(`(^|[^A-Za-z0-9_-])${pattern}([^A-Za-z0-9_-]|$)`).test(
    text,
  );
};

const referencedBy = new Map();
for (const script of scriptFiles) {
  const owner = sources.find((file) => mentions(read(file), script));
  if (owner) referencedBy.set(script, owner);
}
// A script referenced only by an unreferenced script is itself unreferenced.
for (let changed = true; changed;) {
  changed = false;
  for (const script of scriptFiles) {
    if (referencedBy.has(script)) continue;
    const owner = [...referencedBy.keys()].find(
      (other) => other !== script && mentions(read(other), script),
    );
    if (owner) {
      referencedBy.set(script, owner);
      changed = true;
    }
  }
}
const orphans = scriptFiles.filter((script) => !referencedBy.has(script));
if (orphans.length) {
  console.error(
    `Unreferenced scripts (delete them, or reference them from package.json, a script, a test, lab/README or a current doc):\n${orphans.map((s) => `  ${s}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`All ${scriptFiles.length} scripts are referenced.`);
