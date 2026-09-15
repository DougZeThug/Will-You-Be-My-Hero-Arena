/** Rebuild the isolated proof's pinned MIT runtime. No global install or Phaser replacement. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const revision = '64b6c69ae35777c2404be68c9192e2c56906079e';
const base = `https://raw.githubusercontent.com/DragonBones/DragonBonesJS/${revision}/`;
const scratch = 'work/loongbones-upstream';
const destination = 'lab/loongbones/vendor';
async function download(relative) {
  const r = await fetch(base + relative);
  if (!r.ok) throw Error(`${relative}: HTTP ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  const target = path.join(scratch, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return bytes;
}
const config = JSON.parse(await download('DragonBones/tsconfig.json'));
for (let i = 0; i < config.files.length; i += 8) {
  await Promise.all(
    config.files
      .slice(i, i + 8)
      .map((f) => download(`DragonBones/${f.replace('./', '')}`)),
  );
}
await fs.mkdir(destination, { recursive: true });
const license = await download('LICENSE');
await fs.writeFile(`${destination}/LICENSE`, license);
const program = ts.createProgram(
  config.files.map((f) => path.join(scratch, 'DragonBones', f)),
  {
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.None,
    outFile: `${scratch}/core.js`,
    declaration: true,
    preserveConstEnums: true,
    types: [],
    skipLibCheck: true,
    stripInternal: false,
  },
);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length)
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }),
  );
program.emit();
await fs.writeFile(
  `${destination}/dragonBones.js`,
  `// Pinned official DragonBones core ${revision}. See LICENSE.\n` +
    (await fs.readFile(`${scratch}/core.js`, 'utf8')) +
    '\nexport { dragonBones };\n',
);
await fs.writeFile(
  `${destination}/dragonBones.d.ts`,
  (await fs.readFile(`${scratch}/core.d.ts`, 'utf8')).replaceAll(
    'const enum ',
    'enum ',
  ) + '\nexport { dragonBones };\n',
);

const assets = 'lab/loongbones/assets';
await fs.mkdir(assets, { recursive: true });
const hashes = {};
for (const suffix of ['ske.json', 'tex.json', 'tex.png']) {
  const name = `mecha_1406_${suffix}`;
  const bytes = await download(`Pixi/Demos/resource/mecha_1406/${name}`);
  await fs.writeFile(`${assets}/${name}`, bytes);
  hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
}
await fs.writeFile(
  `${destination}/provenance.json`,
  JSON.stringify(
    {
      repository: 'https://github.com/DragonBones/DragonBonesJS',
      revision,
      license: 'MIT',
      runtimeVersion: '5.7.000',
      compiler: ts.version,
      changes:
        'Official core compiled unchanged; ESM export appended. Phaser bridge is separate Arena code.',
      sample:
        'Unmodified official mecha_1406 DragonBones 5.5 export; not a fresh LoongBones editor export.',
      hashes,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Pinned DragonBones core and official sample prepared for the Lab-only proof.',
);
