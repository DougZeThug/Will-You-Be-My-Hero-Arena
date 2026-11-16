import { chromium } from 'playwright';
import { browserLaunchOptions } from '../qa-server.mjs';

// Headless Chromium with the repository's launch options (ARENA_BROWSER_*, CI
// software GL). Extra options override the defaults.
export const launchBrowser = (options = {}) =>
  chromium.launch({ ...browserLaunchOptions(), headless: true, ...options });
