import { defineConfig } from 'playwright/test';
import { browserLaunchOptions } from './scripts/qa-server.mjs';

const baseURL = process.env.ARENA_LAB_URL ?? 'http://127.0.0.1:3010';

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
    // Failure traces keep actions, DOM snapshots and console output. Their
    // per-action screenshots are off: the failure screenshot below and each
    // spec's own captures already show the rendered canvas, and on software
    // WebGL those extra captures cost about a tenth of a capture-heavy spec
    // (rendered-arm opacity test: 50 s with them, 46 s without, 32 s with
    // tracing off entirely, the rest being DOM snapshots that stay on).
    trace: { mode: 'retain-on-failure', screenshots: false },
    screenshot: 'only-on-failure',
    video:
      process.env.ARENA_BROWSER_VIDEO === '1' ? 'retain-on-failure' : 'off',
    launchOptions: browserLaunchOptions(),
  },
  projects: [{ name: 'desktop-chromium' }],
  // scripts/browser-tests.mjs owns the direct Node server lifecycle. A shell
  // webServer here hangs Windows teardown; direct runner users start Lab first.
});
