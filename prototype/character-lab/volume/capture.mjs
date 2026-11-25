// Capture tool for the comparison page and the volume review pages.
//   node prototype/character-lab/volume/capture.mjs turntable [query]   -> <out>/volume-turntable.png
//   node prototype/character-lab/volume/capture.mjs bind                -> <out>/bind-vs-source.png
//   node prototype/character-lab/volume/capture.mjs still <frame> [zoom] [name]
//   node prototype/character-lab/volume/capture.mjs clips               -> compare-game.mp4, compare-inspect.mp4, frames
// Output: work/qa/character-lab/shot/ (git-ignored).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  out = resolve(repository, 'work/qa/character-lab/shot'),
  [command = 'clips', ...rest] = process.argv.slice(2),
  png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: resolve(here, '../vite.config.ts'), server: { port: 3037, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0],
  browser = await chromium.launch({ executablePath: process.env.PROTO_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async (query = '') => {
  const page = await browser.newPage({ viewport: { width: 2000, height: 900 } });
  page.on('pageerror', (error) => console.error('pageerror:', error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('console:', message.text());
  });
  await page.goto(`${base}compare.html${query ? `?${query}` : ''}`);
  await page.waitForFunction(() => window.__CMP__?.ready || window.__CMP__?.error, null, { timeout: 180000 });
  const error = await page.evaluate(() => window.__CMP__.error);
  if (error) throw new Error(error);
  return page;
};
const canvasPng = (page, id) => page.evaluate((name) => document.getElementById(name).toDataURL('image/png'), id);
/** Both stages side by side as one PNG. */
const pair = (page) =>
  page.evaluate(() => {
    const a = document.getElementById('stageA'),
      b = document.getElementById('stageB'),
      c = document.createElement('canvas');
    c.width = a.width + b.width + 4;
    c.height = a.height;
    const g = c.getContext('2d');
    g.fillStyle = '#26262b';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(a, 0, 0);
    g.drawImage(b, a.width + 4, 0);
    return c.toDataURL('image/png');
  });
try {
  if (command === 'turntable' || command === 'bind') {
    const page = await open(`mode=${command}${rest[0] ? `&${rest[0]}` : ''}`),
      file = resolve(out, rest[1] ?? (command === 'turntable' ? 'volume-turntable.png' : 'bind-vs-source.png'));
    writeFileSync(file, png(await canvasPng(page, 'sheet')));
    const numbers = await page.evaluate(() => window.__CMP__.numbers);
    if (numbers) {
      writeFileSync(resolve(out, 'bind-diff.json'), JSON.stringify(numbers, null, 2) + '\n');
      console.log(JSON.stringify(numbers));
    }
    console.log(file);
  } else if (command === 'still') {
    const page = await open(rest[3] ?? '');
    if (rest[1] === 'zoom') await page.evaluate(() => window.__CMP__.zoom(true));
    for (const n of rest[0].split(',')) {
      const info = await page.evaluate((k) => window.__CMP__.seek(k), Number(n)),
        file = resolve(out, 'stills', `${rest[2] ?? 'still'}-${String(n).padStart(3, '0')}${rest[1] === 'zoom' ? '-zoom' : ''}.png`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, png(await pair(page)));
      console.log(file, JSON.stringify(info));
    }
  } else if (command === 'clips') {
    const page = await open(rest[0] ?? ''),
      length = await page.evaluate(() => window.__CMP__.frames);
    for (const [name, zoomed] of [['compare-game', false], ['compare-inspect', true]]) {
      await page.evaluate((on) => window.__CMP__.zoom(on), zoomed);
      const frames = resolve(out, `frames/${name}`),
        log = [];
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      for (let n = 0; n < length; n++) {
        log.push(JSON.stringify(await page.evaluate((k) => window.__CMP__.seek(k), n)));
        writeFileSync(resolve(frames, `${String(n).padStart(4, '0')}.png`), png(await pair(page)));
      }
      writeFileSync(resolve(out, `${name}.frames.jsonl`), log.join('\n') + '\n');
      const joints = [];
      for (let n = 0; n < length; n++) joints.push(await page.evaluate((k) => window.__CMP__.joints(k), n));
      writeFileSync(resolve(out, `${name}.joints.json`), JSON.stringify(joints));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', resolve(frames, '%04d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', resolve(out, `${name}.mp4`)]);
      console.log(resolve(out, `${name}.mp4`), `${length} frames`);
    }
  } else throw new Error(`unknown command ${command}`);
} finally {
  await browser.close();
  await server.close();
}
