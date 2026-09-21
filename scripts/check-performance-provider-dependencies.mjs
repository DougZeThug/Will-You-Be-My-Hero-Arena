import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const productionEntry = 'lab/performance/provider.ts';
const stageEntries = [
  'components/arena/ArenaStage.tsx',
  'components/arena/live/LiveStage.tsx',
];
const tsconfigPath = path.join(root, 'tsconfig.json');
const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
if (tsconfig.error)
  throw Error(
    ts.flattenDiagnosticMessageText(tsconfig.error.messageText, '\n'),
  );
const compilerOptions = tsconfig.config.compilerOptions ?? {};
const aliasBase = path.resolve(
  path.dirname(tsconfigPath),
  compilerOptions.baseUrl ?? '.',
);
const aliases = Object.entries(compilerOptions.paths ?? {}).flatMap(
  ([pattern, targets]) =>
    targets.map((target) => ({
      pattern,
      target: path.resolve(aliasBase, target),
    })),
);
const forbiddenPaths = [
  /(^|\/)LabRuntime\.[cm]?[jt]sx?$/,
  /(^|\/)PerformanceScene\.[cm]?[jt]sx?$/,
  /(^|\/)authoring(\/|\.[cm]?[jt]sx?$)/,
  /(^|\/)(?:controls?|inspection|panels?|capture)(?:[./-]|$)/i,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /(^|\/)scenarios\.[cm]?[jt]s$/,
  /(^|\/)(?:RigInspector|Tuning)\.[cm]?[jt]sx?$/,
];
// Lab is also the historical location of this shared runtime. Keep that
// production island explicit: new Lab files are denied until deliberately
// classified, rather than relying only on UI naming conventions.
const allowedLabProductionPaths = [
  /^lab\/performance\/(?:provider|LoongBonesAdapter|compile|NativeClip|math|ReleaseHands|HandMaterialRegistration)\.ts$/,
  /^lab\/performance\/assets\//,
  /^lab\/human-motion\/ArmMaterialRegistration\.ts$/,
  /^lab\/loongbones\/(?:NativeFactory|NativeMesh|NativeSlot|validate-export)\.ts$/,
  /^lab\/loongbones\/arena\/(?:RigDefinition|definitions)\.ts$/,
  /^lab\/loongbones\/assets\//,
  /^lab\/loongbones\/cornhole-motion\/(?:curves|throws)\.ts$/,
  /^lab\/loongbones\/side-rig\/(?:anatomy|definitions|limits|skeleton)\.ts$/,
  /^lab\/loongbones\/vendor\/dragonBones\.(?:js|d\.ts)$/,
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
  const clean = specifier.replace(/\?.*$/, '');
  let candidate;
  if (clean.startsWith('.'))
    candidate = path.resolve(path.dirname(from), clean);
  else {
    const alias = aliases.find(({ pattern }) => {
      const star = pattern.indexOf('*');
      return star < 0
        ? clean === pattern
        : clean.startsWith(pattern.slice(0, star)) &&
            clean.endsWith(pattern.slice(star + 1));
    });
    if (!alias) return undefined;
    const star = alias.pattern.indexOf('*');
    const match =
      star < 0
        ? ''
        : clean.slice(star, clean.length - (alias.pattern.length - star - 1));
    candidate = alias.target.replace('*', match);
  }
  for (const extension of extensions) {
    const resolved = candidate + extension;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile())
      return resolved;
  }
  throw Error(`Cannot resolve ${specifier} imported by ${relative(from)}`);
}

function forbiddenReason(name) {
  if (forbiddenPaths.some((pattern) => pattern.test(name)))
    return 'is a Lab UI/authoring dependency';
  if (
    name.startsWith('lab/') &&
    !allowedLabProductionPaths.some((pattern) => pattern.test(name))
  )
    return 'is outside the explicit shared production-runtime island';
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
    const reason = forbiddenReason(name);
    if (reason) violations.push(`${name} ${reason}`);
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

function verifyAuditPolicy() {
  assert.equal(
    relative(
      resolveLocal(path.resolve(root, productionEntry), '@/lab/LabRuntime'),
    ),
    'lab/LabRuntime.ts',
    'configured @/* imports must participate in the graph',
  );
  for (const name of ['lab/RigInspector.ts', 'lab/performance/Tuning.ts'])
    assert.ok(forbiddenReason(name), `${name} must remain Lab-only`);
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
  verifyAuditPolicy();
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
