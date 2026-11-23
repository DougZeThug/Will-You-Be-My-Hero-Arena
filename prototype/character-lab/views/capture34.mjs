// Doug three-quarter proof: bind comparison, the take as mp4 (inspection and
// game scale), contact sheets and close-ups of the three joins.
//   node prototype/character-lab/views/capture34.mjs [--only=bind|clips|sheets]
// Output: work/qa/character-lab/doug-34/ (git-ignored).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  out = resolve(repository, 'work/qa/character-lab/doug-34'),
  only = process.argv.find((arg) => arg.startsWith('--only='))?.split('=')[1],
  want = (name) => !only || only === name,
  png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

const server = await createServer({ configFile: resolve(here, '../vite.config.ts'), server: { port: 3036, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PROTO_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
mkdirSync(out, { recursive: true });
const open = async (query) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (error) => console.error(error.message));
  await page.goto(`${base}viewtest.html?sheet=doug34&${query}`);
  await page.waitForFunction(() => window.__move34?.done || window.__viewtest?.error, null, { timeout: 120000 });
  const error = await page.evaluate(() => window.__viewtest?.error);
  if (error) throw new Error(error);
  return page;
};
try {
  if (want('bind')) {
    const page = await open('mode=bind');
    writeFileSync(resolve(out, 'side-by-side.png'), png(await page.evaluate(() => document.getElementById('sheet').toDataURL('image/png'))));
    const numbers = await page.evaluate(() => window.__move34.numbers);
    writeFileSync(resolve(out, 'bind-diff.json'), JSON.stringify(numbers, null, 2) + '\n');
    console.log('bind diff', JSON.stringify(numbers));
    await page.close();
  }
  for (const [s, name] of [[345, 'doug-34-move'], [133, 'doug-34-move-game']]) {
    if (!want('clips') && !want('sheets')) continue;
    const page = await open(`mode=clip&s=${s}`),
      length = await page.evaluate(() => window.__move34.length),
      [width, height] = await page.evaluate(() => window.__move34.size);
    if (want('clips')) {
      const frames = resolve(out, `work/frames-${name}`);
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      const log = [];
      for (let n = 0; n < length; n++) {
        const { info, png: data } = await page.evaluate((k) => window.__move34.draw(k), n);
        writeFileSync(resolve(frames, `${String(n).padStart(4, '0')}.png`), png(data));
        log.push(JSON.stringify({ n: info.n, phase: info.phase, angle: +info.angle.toFixed(2), kind: info.kind, feet: info.feet }));
      }
      writeFileSync(resolve(out, `${name}.frames.jsonl`), log.join('\n') + '\n');
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', resolve(frames, '%04d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', resolve(out, `${name}.mp4`)]);
      console.log(resolve(out, `${name}.mp4`), `${length} frames ${width}x${height}`);
    }
    if (want('sheets')) {
      const place = await page.evaluate(() => window.__move34.place),
        m = s, // px per metre
        figure = [place.x - 0.75 * m, place.y - 1.95 * m, 1.7 * m, 2.1 * m],
        sheet = async (file, ...args) => writeFileSync(resolve(out, file), png(await page.evaluate((a) => window.__move34.sheet(...a), args)));
      // Every 3rd frame of the whole take.
      await sheet(`contact-${name}.png`, 0, length, 3, figure, s < 200 ? 1 : 0.5, s < 200 ? 10 : 12);
      if (s > 200) {
        const box = (w, h) => [0, 0, w * m, h * m];
        for (const [phase, from, to] of [['shoulder-lift', 36, 130], ['twist', 121, 319], ['step', 311, 455], ['turn', 451, 560]]) {
          await sheet(`closeup-neck-${phase}.png`, from, to, 6, box(0.62, 0.55), 2, 8, 'neck');
          await sheet(`closeup-shoulder-${phase}.png`, from, to, 6, box(0.62, 0.62), 2, 8, 'upper_arm_near');
          await sheet(`closeup-hem-${phase}.png`, from, to, 6, box(0.8, 0.55), 2, 8, 'shin_near');
        }
        // The switch, frame by frame.
        await sheet('switch-frames.png', 494, 510, 1, figure, 1, 8);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
