import { defineConfig } from 'playwright/test';

const baseURL = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010';
const executablePath = process.env.ARENA_BROWSER_EXECUTABLE;
const channel =
  process.env.ARENA_BROWSER_CHANNEL ??
  (process.platform === 'win32' ? 'chrome' : 'chromium');

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: 'work/qa/browser/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'work/qa/browser/report', open: 'never' }],
    ['json', { outputFile: 'work/qa/browser/results.json' }],
  ],
  snapshotPathTemplate:
    '{testDir}/baselines/{projectName}/{testFilePath}/{arg}{ext}',
  updateSnapshots: 'none',
  use: {
    baseURL,
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    contextOptions: { reducedMotion: 'no-preference' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video:
      process.env.ARENA_BROWSER_VIDEO === '1' ? 'retain-on-failure' : 'off',
    launchOptions: executablePath ? { executablePath } : { channel },
  },
  projects: [{ name: 'desktop-chromium' }],
  // scripts/browser-tests.mjs owns the direct Node server lifecycle. A shell
  // webServer here hangs Windows teardown; direct runner users start Lab first.
});
