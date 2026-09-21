import { rm, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sourceFingerprint } from './source-fingerprint.mjs';
import {
  auditProvider,
  auditStageEntries,
} from './check-performance-provider-dependencies.mjs';
process.env.NODE_ENV = 'production';
const { createBuilder } = await import('vite');
const { runPrerender } = await import('vinext/internal/build/run-prerender');

// Use the same build and export APIs as vinext's CLI, but allow native worker
// handles to finish naturally. Forced process.exit in the CLI crashes libuv
// during worker shutdown on the bundled Windows Node runtime.
const root = process.cwd();
const providerAudit = auditProvider();
const providerViolations = [
  ...auditStageEntries(),
  ...providerAudit.violations,
];
if (providerViolations.length)
  throw Error(
    `Performance provider dependency audit failed:\n${providerViolations.join('\n')}`,
  );
await rm(path.join(root, 'dist'), { recursive: true, force: true });
const builder = await createBuilder({ root, mode: 'production' });
await builder.buildApp();
const result = await runPrerender({ root });
if (!result) throw new Error('Static export did not run.');
await access(path.join(root, 'dist/client/index.html'));
await writeFile(
  path.join(root, 'dist/client/arena-build.json'),
  JSON.stringify(
    {
      head: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      sourceFingerprint: sourceFingerprint(),
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
console.log('Arena static build and prerender finished.');
