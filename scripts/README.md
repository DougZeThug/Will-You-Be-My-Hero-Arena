# Scripts index

Run from the repository root. `pnpm check:scripts` fails when a file here is not
referenced from `package.json`, `.github`, another script, tests, lab, a README,
agent config or a current doc (not `docs/review` or `docs/checkpoints`).
Removed one-off capture/review/build tooling stays in git history.

Build, serve, test
- `build.mjs`: production build and static export (`pnpm build`).
- `serve.mjs`: static preview of `dist/client` (`pnpm start`).
- `browser-tests.mjs`: Playwright runner and visual modes (`pnpm test:browser`).
- `production-smoke.mjs`: production isolation journey (`pnpm test:production`).
- `production-assets.mjs`: shipped-asset audit used by the smoke test.
- `regression.mjs`: aggregate local regression run (`pnpm check:regression`).
- `verify-ci-browser.mjs`: browser launch preflight (`pnpm browser:preflight`).
- `check-performance-provider-dependencies.mjs`: provider dependency audit
  (`pnpm check:performance-provider`).
- `check-unreferenced-scripts.mjs`: this directory's reference check
  (`pnpm check:scripts`).
- `qa-server.mjs`: owned QA server helper and `browserLaunchOptions`.
- `source-fingerprint.mjs`: source hash stamped into builds and reviews.
- `performance-revision.mjs`: reads the shipped cornhole runtime revision.

Review and capture
- `cornhole-turn-review.mjs`: cornhole turn review package (`pnpm review:cornhole-*`).
- `capture-motion-quality.mjs`: frame-exact motion evidence for every character path.
- `capture-loongbones-proof.mjs`: LoongBones proof capture.

Asset and profile tooling
- `apply-performance-profile.mjs`: validate and promote a performance profile
  (`pnpm motion:apply-profile`).
- `generate-doug-arm-material.mjs`: derived Doug arm material
  (`pnpm generate:doug-arm-material`).
- `author-release-hands.mjs`: rebuild release-hand crops from preserved sources.
- `audit-dan-editor-export.mjs`: audit/restore the Dan editor round trip.
- `prepare-loongbones-proof.mjs`: rebuild the pinned LoongBones runtime.
- `export-animation-upgrade.mjs`, `verify-upgrade-import.mjs`: human-motion
  upgrade-v1 export and import check.
- `motion-reference/extract.py`, `compare.py`, `compile_running.py`: reference
  video extraction, comparison and running-take compile.

Shared helpers (`lib/`)
- `static-server.mjs`: static file server (mime table, traversal guard).
- `hash.mjs`: `sha256`, `sha256File`.
- `browser.mjs`: `launchBrowser` (headless Chromium via `browserLaunchOptions`).
- `args.mjs`: `cliOption` for `--name value` flags.
