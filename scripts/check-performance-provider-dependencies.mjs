import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const productionEntry = 'lab/performance/provider.ts';
const playEntry = 'lab/human-motion/provider.ts';
// ArenaStage and LiveStage both load the providers through this one module.
const stageEntries = ['components/arena/rig-provider.ts'];
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
  /^lab\/performance\/(?:provider|definitions|LoongBonesAdapter|RigMaterialSetup|ClipEmitter|PerformancePoses|LegMaterialRepair|compile|revision|ReleaseHands|HandMaterialRegistration)\.ts$/,
  /^lab\/performance\/assets\//,
  /^lab\/rig-shared\/(?:ArmMaterialRegistration|FootMaterialRepair|NativeClip)\.ts$/,
  /^lab\/rig-shared\/ArmMaterialRecipe\.mjs$/,
  /^lab\/loongbones\/(?:NativeFactory|NativeMesh|NativeSlot|validate-export)\.ts$/,
  /^lab\/loongbones\/arena\/(?:RigDefinition|definitions|assetHash|sideRigSockets)\.ts$/,
  /^lab\/loongbones\/assets\//,
  /^lab\/loongbones\/cornhole-motion\/(?:curves|throws)\.ts$/,
  /^lab\/loongbones\/side-rig\/(?:anatomy|definitions|limits|skeleton)\.ts$/,
  /^lab\/loongbones\/vendor\/dragonBones\.(?:js|d\.ts)$/,
];
// Play running/fighting (lab/human-motion/provider.ts) ships a much larger Lab
// graph than the cornhole performance provider: today the Play bundle still
// carries Lab authoring code (lab/human-motion/authoring*) and the motion
// planner. This list is a regression CEILING built from the current transitive
// graph, not an endorsement. Lab files and forbidden-pattern matches outside it
// fail the audit; shrink it when that code leaves the Play path, and never add
// to it without deliberately classifying the new dependency.
const playAllowedLabFiles = new Set([
  'lab/human-motion/ArmaturePreparation.ts',
  'lab/human-motion/DirectionalSkin.ts',
  'lab/human-motion/FarArmMaterial.ts',
  'lab/human-motion/HandAttachments.ts',
  'lab/human-motion/InertialPose.ts',
  'lab/human-motion/NativeAnimator.ts',
  'lab/human-motion/NativeBridge.ts',
  'lab/human-motion/NativeRigIntegrity.ts',
  'lab/human-motion/PlayMotionRig.ts',
  'lab/human-motion/assets/directional/dan-rear-source.png',
  'lab/human-motion/assets/directional/doug-rear-source.png',
  'lab/human-motion/assets/hands/hand-sheet-v1.png',
  'lab/human-motion/authoring.ts',
  'lab/human-motion/authoring/basketball.ts',
  'lab/human-motion/authoring/builder.ts',
  'lab/human-motion/authoring/combat.ts',
  'lab/human-motion/authoring/cornhole-curves.ts',
  'lab/human-motion/authoring/cornhole.ts',
  'lab/human-motion/authoring/gait.ts',
  'lab/human-motion/authoring/gestures.ts',
  'lab/human-motion/authoring/locomotion.ts',
  'lab/human-motion/authoring/play.ts',
  'lab/human-motion/motion/BodyBalance.ts',
  'lab/human-motion/motion/FootContactRoll.ts',
  'lab/human-motion/motion/FootLock.ts',
  'lab/human-motion/motion/GaitEvents.ts',
  'lab/human-motion/motion/GaitResponse.ts',
  'lab/human-motion/motion/KineticChains.ts',
  'lab/human-motion/motion/MotionContacts.ts',
  'lab/human-motion/motion/MotionPlanner.ts',
  'lab/human-motion/motion/OrganicMotion.ts',
  'lab/human-motion/motion/RecoveryMatcher.ts',
  'lab/human-motion/motion/RootCurve.ts',
  'lab/human-motion/motion/StrideMatcher.ts',
  'lab/human-motion/motion/SupportAdjustment.ts',
  'lab/human-motion/provider.ts',
  'lab/loongbones/NativeFactory.ts',
  'lab/loongbones/NativeMesh.ts',
  'lab/loongbones/NativeSlot.ts',
  'lab/loongbones/arena/RigDefinition.ts',
  'lab/loongbones/arena/assetHash.ts',
  'lab/loongbones/arena/definitions.ts',
  'lab/loongbones/arena/sideRigSockets.ts',
  'lab/loongbones/assets/cornhole-motion-v2/provenance.json',
  'lab/loongbones/assets/cornhole-side-v3/dan_ske.json',
  'lab/loongbones/assets/cornhole-side-v3/dan_tex.json',
  'lab/loongbones/assets/cornhole-side-v3/dan_tex.png',
  'lab/loongbones/assets/cornhole-side-v3/doug_ske.json',
  'lab/loongbones/assets/cornhole-side-v3/doug_tex.json',
  'lab/loongbones/assets/cornhole-side-v3/doug_tex.png',
  'lab/loongbones/assets/cornhole-side-v3/provenance.json',
  'lab/loongbones/assets/dan-editor-r2/provenance.json',
  'lab/loongbones/assets/doug-weighted-v1/provenance.json',
  'lab/loongbones/cornhole-motion/curves.ts',
  'lab/loongbones/cornhole-motion/throws.ts',
  'lab/loongbones/side-rig/anatomy.ts',
  'lab/loongbones/side-rig/definitions.ts',
  'lab/loongbones/side-rig/hand-surfaces.ts',
  'lab/loongbones/side-rig/limits.ts',
  'lab/loongbones/side-rig/skeleton.ts',
  'lab/loongbones/vendor/dragonBones.js',
  'lab/rig-shared/ArmMaterialRecipe.mjs',
  'lab/rig-shared/ArmMaterialRegistration.ts',
  'lab/rig-shared/FootMaterialRepair.ts',
  'lab/rig-shared/NativeClip.ts',
]);
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

// Per-entry policy. `allowedFiles` (exact paths) replaces the pattern island
// and also tolerates the Lab UI/authoring path patterns for the listed files.
const performancePolicy = {};
const playPolicy = { allowedFiles: playAllowedLabFiles };

function forbiddenReason(name, policy = performancePolicy) {
  const listed = policy.allowedFiles?.has(name);
  if (!listed && forbiddenPaths.some((pattern) => pattern.test(name)))
    return 'is a Lab UI/authoring dependency';
  if (
    name.startsWith('lab/') &&
    !listed &&
    (policy.allowedFiles ||
      !allowedLabProductionPaths.some((pattern) => pattern.test(name)))
  )
    return policy.allowedFiles
      ? 'is outside the explicit Play provider allow-list'
      : 'is outside the explicit shared production-runtime island';
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

export function auditProvider(
  entry = productionEntry,
  policy = performancePolicy,
) {
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
    const reason = forbiddenReason(name, policy);
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

export function auditPlayProvider() {
  return auditProvider(playEntry, playPolicy);
}

export function auditStageEntries() {
  return stageEntries.flatMap((entry) => {
    const file = path.resolve(root, entry);
    const imports = moduleSpecifiers(file).dynamicImports.map((specifier) =>
      resolveLocal(file, specifier),
    );
    return [productionEntry, playEntry].flatMap((provider) =>
      imports.includes(path.resolve(root, provider))
        ? []
        : [`${entry} must dynamically import ${provider}`],
    );
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyAuditPolicy();
  const result = auditProvider(process.argv[2] ?? productionEntry);
  const play = auditPlayProvider();
  const violations = [
    ...auditStageEntries(),
    ...result.violations,
    ...play.violations,
  ];
  if (violations.length) {
    console.error(
      `Performance provider dependency audit failed:\n${violations.join('\n')}`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Performance provider dependency audit passed (${result.files.length} transitive files; Play provider ${play.files.length}).`,
    );
  }
}
