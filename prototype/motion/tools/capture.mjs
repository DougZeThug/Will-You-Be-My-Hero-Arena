// Render the torture sheet and the bind comparison for one or more characters:
//   node prototype/motion/tools/capture.mjs doug dan [--scale=0.5] [--bones] [--only=<label>]
// Starts the prototype Vite server on a free port, drives it with Playwright
// and writes PNGs to the git-ignored work/qa/reimagine/pass-b/.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  repository = resolve(here, '../../..'),
  out = resolve(repository, 'work/qa/reimagine/pass-b'),
  args = process.argv.slice(2),
  ids = args.filter((arg) => !arg.startsWith('--')),
  option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1],
  scale = option('scale') ?? '0.5',
  only = option('only'),
  tag = option('tag') ?? '';

const server = await createServer({
  configFile: resolve(here, '../vite.config.ts'),
  server: { port: Number(option('port') ?? 3033), strictPort: false },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];
const executablePath = process.env.PROTO_CHROMIUM ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : {});
mkdirSync(out, { recursive: true });
try {
  for (const id of ids.length ? ids : ['doug', 'dan']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (error) => console.error(`${id}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`${id}: ${message.text()}`);
    });
    const query = new URLSearchParams({ c: id, s: scale });
    if (args.includes('--bones')) query.set('bones', '1');
    if (args.includes('--flip')) query.set('flip', '1');
    if (only) query.set('only', only);
    await page.goto(`${base}torture.html?${query}`);
    await page.waitForFunction(() => window.__torture?.done, null, { timeout: 60000 });
    const result = await page.evaluate(() => window.__torture);
    if (result.error) throw new Error(`${id}: ${result.error}`);
    for (const [canvas, name] of [
      ['sheet', `torture-${id}${tag}.png`],
      ['bind', `bind-diff-${id}${tag}.png`],
    ]) {
      const data = await page.evaluate(
        (selector) => document.getElementById(selector).toDataURL('image/png'),
        canvas,
      );
      writeFileSync(resolve(out, name), Buffer.from(data.split(',')[1], 'base64'));
    }
    writeFileSync(resolve(out, `bind-diff-${id}${tag}.json`), JSON.stringify(result.bind, null, 2));
    console.log(`${id}: ${JSON.stringify(result.bind)}`);
    console.log(`  ${resolve(out, `torture-${id}${tag}.png`)}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
