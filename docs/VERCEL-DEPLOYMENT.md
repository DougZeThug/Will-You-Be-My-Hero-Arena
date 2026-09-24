# Vercel deployment

Arena is a frontend-only static export. The existing React UI uses vinext
1.0.0-beta.5 with Vite 8.3.0; Phaser 3.90.0 and the current LoongBones adapter
run in the browser. `scripts/build.mjs` builds with Vite and runs vinext's static
prerender, as selected by `next.config.ts` (`output: 'export'`). No engine,
animation, artwork, rules, or game-flow changes are required for Vercel.

## Exact import settings

| Setting                                              | Value                                                     |
| ---------------------------------------------------- | --------------------------------------------------------- |
| GitHub repository                                    | `DougZeThug/Will-You-Be-My-Hero-Arena`                    |
| Production branch                                    | `main`                                                    |
| Root Directory                                       | `.` (repository root containing `package.json`)           |
| Framework Preset                                     | **Other**                                                 |
| Build Command                                        | `node scripts/build.mjs` (also available as `pnpm build`) |
| Output Directory                                     | `dist/client`                                             |
| Install Command                                      | Leave Override **off**; Corepack uses the pinned pnpm     |
| Package manager                                      | `pnpm@11.19.0`, specified in `package.json`               |
| Node.js Version                                      | **24.x**, specified in `package.json`                     |
| Required build environment variable                  | `ENABLE_EXPERIMENTAL_COREPACK` = `1`                      |
| Required application environment variables / secrets | **None**                                                  |

Set the Corepack flag for Production and Preview builds. It is a public build
option, not a secret. The exact pnpm version is installed in this checkout and
was also verified against the public npm registry. `pnpm-workspace.yaml` retains
the existing dependency build-script allowlist. Keep the committed lockfile.

The repository's `vercel.json` sets framework, build command and output. Vercel
documents `framework: null` as Other. Do not choose Next.js simply because the
source has an `app/` folder and `next.config.ts`; this project's builder is
vinext. Do not change output to `.next`, `out`, or `dist`.

Vercel's documented default pnpm detection selects pnpm 9 or 10 for lockfile
format 9.0; Corepack pins the actual project version. Leave the install override
disabled: a bare `pnpm install` override can select an older bundled pnpm.

Sources: [Vercel build/Corepack settings](https://vercel.com/docs/builds/configure-a-build),
[package managers](https://vercel.com/docs/package-managers),
[static configuration](https://vercel.com/docs/project-configuration/vercel-json),
[supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## What is hosted

Two browser findings were corrected: the page now names its existing
`favicon.svg` instead of causing a missing `/favicon.ico` request, and unused
starter Geist font imports were removed. Arena's authored CSS already uses
Arial/Helvetica and Impact/Arial Narrow; none of its styles referenced the
removed Geist variables. Its typography is preserved without those Google
Fonts requests.

- Publish only `dist/client`. `dist/server` is an intermediate used by the local
  prerender step, not an application server to deploy.
- `scripts/serve.mjs` is the local static preview. No Vercel start command,
  long-running Node process, Cloudflare Worker, database, API route, or socket
  server is required. Existing `.openai/hosting.json` is preserved for Sites.
- Identity, ownership, competitions, points and recordings use the existing
  local demo services. Saves live in browser localStorage; installed character
  packs live in IndexedDB. These are not shared accounts or online multiplayer.
  A new deployment origin starts with its own browser storage; local saves are
  not automatically transferred from localhost or the existing Sites domain.
  Character packs can be reinstalled. Save/recording export is available for
  backup, but the current UI has no full-save restore importer.
- Public card art, paper character assets, arena, equipment and CSS copy from
  `public/`. Production cornhole imports both skeletons, atlases, textures and
  corrective hands through Vite `?url` imports, including source files under
  `lab/`. Keep those tracked source assets even though Lab pages are not deployed.
- Audio cues are synthesized with Web Audio after Enable sound is clicked;
  there is no missing audio-file directory to upload.
- The app is served at the domain root. All production menus use `/` and React
  state. Reload returns to the lobby and offers Resume contest. No wildcard SPA
  rewrite is needed. Unrecognized paths should remain 404; `/performance/` and
  the other Lab entry points are development-only.
- Runtime source has no localhost service URLs, environment-secret references,
  or absolute local-file dependencies. Localhost in the preview server and QA
  commands is intentional. No development debug globals are shipped.

## Repeatable verification

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test:production
```

The production check starts its own static server on port 3011 and stops it
afterwards. Set `ARENA_PRODUCTION_QA_PORT` if that port is occupied. It uses the
existing Playwright setup: installed Chrome on Windows, Chromium elsewhere.
`ARENA_BROWSER_EXECUTABLE` or `ARENA_BROWSER_CHANNEL` can select an installed
browser; these are local QA options, not Vercel application variables.

The check compares all public files byte-for-byte, validates Vite manifest and
CSS paths with case-sensitive names even on Windows, and compares the eight
weighted-character source assets to their exported files. It opens real Play
and Watch UI, completes Dan/Doug's showcase at normal speed, enables sound,
checks replay preserves recorded facts, then reloads and resumes the save.
It collects console errors and HTTP failures and rejects unexpected external
dependencies. Reports and screenshots go to ignored `work/qa/production/`.

## Verification record

September 16, 2026: deployment preparation based on integrated project commit
`407c2df3825770e59f67429db4d8b1f7f10f18d5`. The pre-existing generated change in
`docs/test-results.json` is preserved separately from this work.

- TypeScript and all 170,734 simulation/animation checks passed. The full
  browser suite passed 140 tests; its opt-in pixel-baseline case was skipped.
  This includes the four Watch sports, character rigs, replay and input checks.
- The final production build/prerender and enhanced production browser check
  passed on Windows, Node 24.19.0, headless Chrome, 1440 × 1080. The showcase
  `velvet-paw-29` completed at 1×: Dan 3, Doug 7, four bags each. Replay and
  reload/resume preserved the recording and ledger. All 150 observed requests
  were local to the static host, with no failed requests or console errors.
- All 81 public files and eight bundled character assets matched their source
  bytes. Vite manifest and CSS references passed exact-name checks. Exported
  pages are `/` and `404.html`; no backend was needed for the browser journey.
- Opened and inspected production Play, Watch, final-result and resumed-match
  screenshots. The before/after menu PNGs were byte-identical, as were the
  computed font settings for all 15 sampled UI elements. Sound activation was
  exercised through the UI; audible output was not listened to.
- Evidence: `work/qa/vercel-regression.log`, `work/qa/vercel/regression.json`,
  `work/qa/vercel/production.json`, `work/qa/production/*.png`, and
  `work/qa/vercel/{baseline,candidate}-layout.png`. These generated files stay local.

- A fresh pnpm 11.19.0 install of all 562 locked dependencies succeeded in an
  isolated folder; lockfile and workspace policy remained byte-identical.
  Offline installation first reported an unavailable package; the normal
  authorized install completed using 562 cached packages and no downloads.
  Its optional registry update check logged a network warning, with a successful
  install exit status. This is a Windows install, not a Vercel Linux build.
- Case audit: 832 resolved local imports matched tracked filenames exactly.
- Targeted lint found the same pre-existing `next/no-css-tags` error for the
  authored `/assets/arena-interface.css` link in both original main and this
  candidate. The link works in the vinext static export; it was preserved.
  Newly added QA code produced no lint diagnostics.

The Vercel cloud build, HTTPS deployment, CDN behavior, and account/repository
permissions require the actual import and remain unverified by local testing.
This task prepares the repository; it does not create a deployment.
