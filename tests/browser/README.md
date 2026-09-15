# Arena browser regression tests

Run from the repository root with Node 22.13+ and pnpm:

```sh
pnpm test:browser
pnpm check:regression
```

The test runner starts the isolated Arena Lab on port 3010 when needed. Each test owns a clean browser context, does not use your normal browser profile, and never changes your game saves. Named scenarios have fixed seeds and manual clocks. Tests inspect the versioned `window.__HERO_ARENA__` contract and capture screenshots plus state JSON in `work/qa/browser`. Failures retain a Playwright trace. Open the HTML report with `pnpm exec playwright show-report work/qa/browser/report`. Optional failure video is enabled with `ARENA_BROWSER_VIDEO=1` after `pnpm exec playwright install ffmpeg`.

Windows defaults to installed Chrome. Elsewhere the default is Playwright Chromium (`pnpm exec playwright install chromium` once). Override with `ARENA_BROWSER_CHANNEL=msedge` or `ARENA_BROWSER_EXECUTABLE` for an explicitly selected browser executable. `ARENA_LAB_URL` uses an already running Lab instead of starting a server. Set environment variables in your shell using its native syntax; no machine-specific paths are committed.

The script owns Vite as a direct Node subprocess to avoid Windows shell cleanup hangs. It stops only a server it started and preserves an existing Lab. Direct Playwright runner/editor users must start `pnpm lab` first; the package scripts handle startup automatically. Avoid editing Lab source while a regression run is active: development hot reload intentionally replaces the page and invalidates an in-flight browser step.

`pnpm check:regression` runs typechecking, the pure simulation/animation/observability suite, browser tests, a fresh production build, then `pnpm test:production`. The final smoke test scans exported files for accidental Lab API leakage and opens Play and Watch in a separate clean browser on its own port 3011. It verifies live practice does not write the saved-results key. Set `ARENA_PRODUCTION_QA_PORT` if 3011 is occupied. It never reuses or stops the normal game at port 3001. Results and screenshots are saved in `work/qa/production`; the combined report is `work/qa/regression.json`.

## Pixel baselines

The regular suite always captures screenshots for review. Pixel comparison is a separate, opt-in check:

```sh
pnpm test:browser:visual
```

It requires reviewed baseline PNGs under `tests/browser/baselines`. To intentionally create or replace them, first inspect the captured screenshots and confirm the intended appearance, then run:

```sh
pnpm test:browser:update
```

Review every changed PNG before committing. Never update snapshots solely to make a failing test pass. Keep the browser version, operating system and rendering mode consistent for pixel comparisons; GPU/browser changes can produce rasterization differences. Default tests do not automatically write or approve baselines. Semantic state assertions remain the portable regression gate.

## Evidence boundaries

Keyboard tests use real browser key events through `KeyboardDevice`. Controller tests replace only browser `navigator.getGamepads()` data; the real `GamepadDevice`, bindings, tracker, action map and controller process those snapshots. This verifies software mapping and disconnect behavior, not physical controller connectivity, operating-system drivers or felt haptics. A hardware pass remains separate.

Performance sampling uses a real-time interval, separate from deterministic screenshots. The suite checks valid measurements, not a machine-independent FPS target. Headless/software-rendered results must not be presented as player GPU measurements.
