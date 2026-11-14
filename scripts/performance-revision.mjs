import { readFile } from 'node:fs/promises';
import ts from 'typescript';

/** The shipped cornhole runtime revision as declared by the sole motion
 * compiler. Node scripts cannot import TypeScript directly, so transpile the
 * dependency-free revision module and import the result; the browser specs
 * import the same constant through compile.ts. */
export async function shippedPerformanceRevision() {
  const source = await readFile('lab/performance/revision.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
  const { PERFORMANCE_REVISION } = await import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  );
  return PERFORMANCE_REVISION;
}
