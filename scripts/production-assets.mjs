import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function filesIn(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const file = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(root, file)));
    else files.push(file);
  }
  return files;
}

/** Check exact spelling and bytes, including on case-insensitive Windows hosts. */
export async function auditProductionAssets() {
  const output = 'dist/client';
  const files = new Set(await filesIn(output));
  const publicFiles = await filesIn('public');
  for (const file of publicFiles) {
    assert.ok(files.has(file), `Public asset absent or wrong case: ${file}`);
    assert.deepEqual(
      await readFile(path.join(output, file)),
      await readFile(path.join('public', file)),
      `Public asset changed during export: ${file}`,
    );
  }
  const manifest = JSON.parse(
    await readFile(`${output}/.vite/manifest.json`, 'utf8'),
  );
  for (const [key, entry] of Object.entries(manifest)) {
    for (const file of [
      entry.file,
      ...(entry.css ?? []),
      ...(entry.assets ?? []),
    ])
      assert.ok(
        files.has(file),
        `Manifest ${key} references missing/wrong-case file: ${file}`,
      );
    for (const key of [
      ...(entry.imports ?? []),
      ...(entry.dynamicImports ?? []),
    ])
      assert.ok(manifest[key], `Missing manifest import: ${key}`);
  }
  const performanceAssets = Object.entries(manifest)
    .filter(([source]) =>
      /^lab\/(loongbones\/assets\/cornhole-side-v3|performance\/assets|human-motion\/assets)\//.test(
        source,
      ),
    )
    .map(([source, entry]) => ({ source, file: entry.file }));
  // Cornhole ships Doug's derived arm-material skeleton; Play running and
  // fighting ship the original side skeleton (the Human Motion animator
  // applies that correction at runtime) plus the hand sheet and the
  // rear-garment sources.
  const side = 'lab/loongbones/assets/cornhole-side-v3/';
  assert.deepEqual(
    performanceAssets.map((a) => a.source).sort(),
    [
      ...[
        'dan_ske.json',
        'dan_tex.json',
        'dan_tex.png',
        'doug_arm-material-v1_ske.json',
        'doug_ske.json',
        'doug_tex.json',
        'doug_tex.png',
      ].map((f) => side + f),
      'lab/human-motion/assets/directional/dan-rear-source.png',
      'lab/human-motion/assets/directional/doug-rear-source.png',
      'lab/human-motion/assets/hands/hand-sheet-v1.png',
      'lab/performance/assets/dan-release.png',
      'lab/performance/assets/doug-release.png',
    ].sort(),
    'Side rigs, atlases, textures, release hands and side-motion art must ship',
  );
  for (const { source, file } of performanceAssets)
    assert.deepEqual(
      await readFile(source),
      await readFile(path.join(output, file)),
      `Performance asset bytes changed: ${source}`,
    );
  // CSS assets are not necessarily listed individually in Vite's manifest.
  const cssUrls = [];
  for (const file of files)
    if (file.endsWith('.css')) {
      const css = await readFile(path.join(output, file), 'utf8');
      for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
        if (/^(data:|#)/.test(match[1])) continue;
        const url = new URL(match[1], `https://arena.invalid/${file}`);
        assert.equal(
          url.origin,
          'https://arena.invalid',
          `External CSS dependency: ${url}`,
        );
        assert.ok(
          files.has(decodeURIComponent(url.pathname.slice(1))),
          `Missing CSS asset: ${url.pathname}`,
        );
        cssUrls.push(url.pathname);
      }
    }
  return {
    files,
    report: {
      publicFiles: publicFiles.length,
      manifestEntries: Object.keys(manifest).length,
      performanceAssets,
      cssUrls,
    },
  };
}
