import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { chromium } from 'playwright';

const executablePath = process.env.ARENA_BROWSER_EXECUTABLE;
assert.ok(
  executablePath,
  'Set ARENA_BROWSER_EXECUTABLE to a Chromium or Chrome binary installed in the CI image.',
);
await access(executablePath);

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<title>Arena browser preflight</title>');
  assert.equal(await page.title(), 'Arena browser preflight');
  console.log(
    JSON.stringify({
      executablePath,
      version: browser.version(),
      headless: true,
    }),
  );
} finally {
  await browser.close();
}
