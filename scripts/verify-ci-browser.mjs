import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './qa-server.mjs';

const executablePath = process.env.ARENA_BROWSER_EXECUTABLE;
assert.ok(
  executablePath,
  'Set ARENA_BROWSER_EXECUTABLE to a Chromium or Chrome binary installed in the CI image.',
);
await access(executablePath);

const launchOptions = browserLaunchOptions();
const browser = await chromium.launch({ ...launchOptions, headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<title>Arena browser preflight</title>');
  assert.equal(await page.title(), 'Arena browser preflight');
  const webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return context
      ? {
          available: true,
          renderer: context.getParameter(context.RENDERER),
          version: context.getParameter(context.VERSION),
        }
      : { available: false };
  });
  assert.ok(
    webgl.available,
    'Arena browser preflight requires WebGL for Phaser scenes.',
  );
  console.log(
    JSON.stringify({
      executablePath,
      version: browser.version(),
      headless: true,
      webgl,
      args: launchOptions.args ?? [],
    }),
  );
} finally {
  await browser.close();
}
