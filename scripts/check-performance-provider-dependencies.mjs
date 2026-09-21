import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const productionEntry = 'lab/performance/provider.ts';
const stageEntries = [
  'components/arena/ArenaStage.tsx',
  'components/arena/live/LiveStage.tsx',
];
const forbiddenPaths = [
  /(^|\/)LabRuntime\.[cm]?[jt]sx?$/,
  /(^|\/)PerformanceScene\.[cm]?[jt]sx?$/,
  /(^|\/)authoring(\/|\.[cm]?[jt]sx?$)/,
  /(^|\/)(?:controls?|inspection|panels?|capture)(?:[./-]|$)/i,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /(^|\/)scenarios\.[cm]?[jt]s$/,
];
const extensions = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.png',
  '/index.ts',
  '/index.tsx',
];

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function resolveLocal(from, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const clean = specifier.replace(/\?.*$/, '');
  const candidate = path.resolve(path.dirname(from), clean);
  for (const extension of extensions) {
    const resolved = candidate + extension;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile())
      return resolved;
  }
  throw Error(`Cannot resolve ${specifier} imported by ${relative(from)}`);
}

function moduleSpecifiers(file) {
  if (!/\.[cm]?[jt]sx?$/.test(file)) return [];
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  const dynamicImports = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
      dynamicImports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, dynamicImports, sourceText };
}

export function auditProvider(entry = productionEntry) {
  const pending = [path.resolve(root, entry)];
  const visited = new Set();
  const parents = new Map();
  const violations = [];
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    const name = relative(file);
    const parsed = moduleSpecifiers(file);
    if (forbiddenPaths.some((pattern) => pattern.test(name)))
      violations.push(`${name} is a Lab UI/authoring dependency`);
    if (parsed.sourceText?.includes('__HERO_'))
      violations.push(`${name} exposes or consumes a Lab debug global`);
    for (const specifier of parsed.imports ?? []) {
      const dependency = resolveLocal(file, specifier);
      if (!dependency || visited.has(dependency)) continue;
      if (!parents.has(dependency)) parents.set(dependency, file);
      pending.push(dependency);
    }
  }
  const paths = violations.map((violation) => {
    const name = violation.split(' ')[0];
    let cursor = path.resolve(root, name);
    const chain = [name];
    while (parents.has(cursor)) {
      cursor = parents.get(cursor);
      chain.unshift(relative(cursor));
    }
    return `${violation}\n  import chain: ${chain.join(' -> ')}`;
  });
  return { files: [...visited].map(relative).sort(), violations: paths };
}

export function auditStageEntries() {
  return stageEntries.flatMap((entry) => {
    const file = path.resolve(root, entry);
    const provider = path.resolve(root, productionEntry);
    const imports = moduleSpecifiers(file).dynamicImports.map((specifier) =>
      resolveLocal(file, specifier),
    );
    return imports.includes(provider)
      ? []
      : [`${entry} must dynamically import lab/performance/provider.ts`];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = auditProvider(process.argv[2] ?? productionEntry);
  const violations = [...auditStageEntries(), ...result.violations];
  if (violations.length) {
    console.error(
      `Performance provider dependency audit failed:\n${violations.join('\n')}`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Performance provider dependency audit passed (${result.files.length} transitive files).`,
    );
  }
}
