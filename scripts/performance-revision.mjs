import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** The shipped cornhole runtime revision as declared by the sole motion
 * compiler. Node scripts cannot import the TypeScript module, so read the
 * exported constant from source; the browser specs import it directly. */
export async function shippedPerformanceRevision() {
  const compiled = await readFile('lab/performance/compile.ts', 'utf8');
  const match = compiled.match(/PERFORMANCE_REVISION = '([^']+)'/);
  assert.ok(match, 'compile.ts must declare the shipped PERFORMANCE_REVISION');
  return match[1];
}
