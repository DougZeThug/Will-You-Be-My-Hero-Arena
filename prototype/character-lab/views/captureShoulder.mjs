// Doug shoulder review capture: the take as mp4 (game and inspection scale),
// shoulder close-up sheets and game-scale contact sheets.
//   node prototype/character-lab/views/captureShoulder.mjs --variant=after [--only=clips|sheets|gamesheets|bones] [--motions=0,2] [--tag=r2]
//   node prototype/character-lab/views/captureShoulder.mjs --variant=before --tree=work/qa/character-lab/shoulder/before-tree
//   node prototype/character-lab/views/captureShoulder.mjs --compare      (before | after side by side, from the saved frames)
// `--tree` serves another checkout of prototype/ (the frozen pre-repair tree,
// with only this page and the synthetic frames copied in) so BEFORE can be
// re-rendered on the same frames at any time.
// Output: work/qa/character-lab/shoulder/ (git-ignored).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  out = resolve(repository, 'work/qa/character-lab/shoulder'),
  arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1],
  variant = arg('variant') ?? 'after',
  tree = arg('tree') ? resolve(repository, arg('tree')) : repository,
  only = arg('only'),
  tag = arg('tag') ? `-${arg('tag')}` : '',
  motions = arg('motions')?.split(',').map(Number),
  want = (name) => !only || only.split(',').includes(name),
  png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64'),
  SCALES = [[133, 'game'], [345, 'inspect']],
  ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]),
  encode = ['-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14'];
mkdirSync(out, { recursive: true });

if (process.argv.includes('--compare')) {
  for (const [, name] of SCALES) {
    const input = (v) => ['-framerate', '60', '-i', resolve(out, `work/frames-${v}-${name}/%04d.png`)];
    ffmpeg(...input('before'), ...input('after'), '-filter_complex', '[0:v][1:v]hstack=inputs=2,pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', resolve(out, `before-after-${name}.mp4`));
    console.log(resolve(out, `before-after-${name}.mp4`));
  }
  process.exit(0);
}

const server = await createServer({ configFile: resolve(tree, 'prototype/character-lab/vite.config.ts'), server: { port: 3037, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PROTO_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async (query) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (error) => console.error(error.message));
  page.on('console', (message) => message.type() === 'error' && console.error(message.text()));
  await page.goto(`${base}viewtest.html?sheet=shoulder&variant=${variant}&${query}`);
  await page.waitForFunction(() => window.__shoulder?.done || window.__viewtest?.error, null, { timeout: 120000 });
  const error = await page.evaluate(() => window.__viewtest?.error);
  if (error) throw new Error(error);
  return page;
};
const slug = (text) => (text.split(' (')[0] + (/\(far arm\)/.test(text) ? ' far' : '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
try {
  for (const [s, name] of SCALES) {
    const wanted = (name === 'game' && (want('clips') || want('gamesheets'))) || (name === 'inspect' && (want('clips') || want('sheets') || want('bones')));
    if (!wanted) continue;
    const page = await open(`s=${s}`),
      length = await page.evaluate(() => window.__shoulder.length),
      index = await page.evaluate(() => window.__shoulder.index),
      [width, height] = await page.evaluate(() => window.__shoulder.size),
      place = await page.evaluate(() => window.__shoulder.place),
      sheet = async (target, file, ...args) => writeFileSync(resolve(out, file), png(await target.evaluate((a) => window.__shoulder.sheet(...a), args))),
      every = (from, count, step) => Array.from({ length: Math.ceil(count / step) }, (_, i) => from + i * step);
    if (want('clips')) {
      const frames = resolve(out, `work/frames-${variant}-${name}`);
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      const log = [];
      for (let n = 0; n < length; n++) {
        const { info, png: data } = await page.evaluate((k) => window.__shoulder.draw(k), n);
        writeFileSync(resolve(frames, `${String(n).padStart(4, '0')}.png`), png(data));
        log.push(JSON.stringify(info));
      }
      writeFileSync(resolve(out, `${variant}-${name}.frames.jsonl`), log.join('\n') + '\n');
      ffmpeg('-framerate', '60', '-i', resolve(frames, '%04d.png'), ...encode, resolve(out, `${variant}-${name}.mp4`));
      console.log(resolve(out, `${variant}-${name}.mp4`), `${length} frames ${width}x${height}`);
    }
    for (const [k, [motion, view, from, count]] of index.entries()) {
      if (motions && !motions.includes(k)) continue;
      const far = /far arm\)/.test(motion),
        id = `${view === 'side' ? 'profile' : '34'}-${String(k).padStart(2, '0')}-${slug(motion)}`;
      if (name === 'inspect' && want('sheets'))
        // Shoulder close-up: 0.72 m square, 1.5x, every 6th frame, 5 per row (1940 px wide).
        await sheet(page, `closeup-${variant}${tag}-${id}.png`, every(from, count, 6), [0, 0, Math.round(0.75 * s), Math.round(0.75 * s)], 1.5, 5, far ? 'far' : 'near', [0.06 * s, 0.02 * s]);
      if (name === 'game' && want('gamesheets'))
        // Whole figure at game scale, 2x nearest (so game pixels stay honest), every 6th frame.
        await sheet(page, `game-${variant}${tag}-${id}.png`, every(from, count, 6), [Math.round(place.x - 0.8 * s), Math.round(place.y - 2.3 * s), Math.round(1.7 * s), Math.round(2.4 * s)], 1, 9);
    }
    await page.close();
    if (name === 'inspect' && want('bones') && variant === 'after') {
      const bones = await open(`s=${s}&debug=bones`),
        index2 = await bones.evaluate(() => window.__shoulder.index);
      for (const [k, [motion, view, from, count]] of index2.entries()) {
        if (motions && !motions.includes(k)) continue;
        if (/far arm\)/.test(motion)) continue;
        await writeFileSync(
          resolve(out, `pivots-${variant}${tag}-${view === 'side' ? 'profile' : '34'}-${String(k).padStart(2, '0')}-${slug(motion)}.png`),
          png(await bones.evaluate((a) => window.__shoulder.sheet(...a), [[from - 4, ...[0.25, 0.5, 0.75].map((f) => Math.round(from + count * f * 0.62))], [0, 0, Math.round(0.9 * s), Math.round(0.9 * s)], 1.5, 4, 'near', [0.06 * s, 0.02 * s]])),
        );
      }
      await bones.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
