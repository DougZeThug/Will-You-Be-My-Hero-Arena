// Contact sheets of the view test, for both characters:
//   node prototype/character-lab/views/capture.mjs [doug dan] [--sheets=turntable,walk] [--s=330] [--tag=-game]
// Starts the lab's Vite server on a free port and writes PNGs plus the test /
// foot log to the git-ignored work/qa/character-lab/views/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  out = resolve(repository, 'work/qa/character-lab/views'),
  args = process.argv.slice(2),
  ids = args.filter((arg) => !arg.startsWith('--')),
  option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1],
  sheets = (option('sheets') ?? 'turntable,turn,orbit,walk,reach,foreshorten,poses,hands,layering,dissolve,proportions,squash').split(','),
  s = option('s') ?? '330',
  tag = option('tag') ?? '';

const server = await createServer({
  configFile: resolve(here, '../vite.config.ts'),
  server: { port: Number(option('port') ?? 3035), strictPort: false },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.PROTO_CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
mkdirSync(out, { recursive: true });
let failed = false;
try {
  for (const id of ids.length ? ids : ['doug', 'dan'])
    for (const sheet of sheets) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      page.on('pageerror', (error) => console.error(`${id}/${sheet}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') console.error(`${id}/${sheet}: ${message.text()}`);
      });
      await page.goto(`${base}viewtest.html?c=${id}&sheet=${sheet}&s=${s}`);
      await page.waitForFunction(() => window.__viewtest?.done, null, { timeout: 120000 });
      const result = await page.evaluate(() => window.__viewtest);
      if (result.error) {
        console.error(`${id}/${sheet}: ${result.error}`);
        failed = true;
      } else {
        const data = await page.evaluate(() => document.getElementById('sheet').toDataURL('image/png')),
          file = resolve(out, `${id}-${sheet}${tag}.png`);
        writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
        writeFileSync(
          resolve(out, `${id}-${sheet}${tag}.txt`),
          result.tests.map((t) => `${t.pass ? 'PASS' : 'FAIL'} ${t.name}: ${t.detail}`).join('\n') + '\n\n' + result.log.join('\n') + '\n',
        );
        const fails = result.tests.filter((t) => !t.pass);
        if (fails.length) failed = true;
        console.log(`${file}${fails.length ? `  FAILED TESTS: ${fails.map((t) => t.name).join('; ')}` : ''}`);
      }
      await page.close();
    }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
