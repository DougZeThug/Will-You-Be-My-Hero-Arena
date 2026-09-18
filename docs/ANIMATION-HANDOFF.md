# Animation handoff

This is the current router for Dan and Doug's **recorded-cornhole Watch**
performance. Replace stale details here when the installed path changes; do not
append a pass-by-pass history. Historical implementation evidence remains in
[`CHARACTER-PERFORMANCE.md`](CHARACTER-PERFORMANCE.md).

## Project and source checkpoint

- Repository root: `/workspace/Will-You-Be-My-Hero-Arena`
- Branch at task start: `work`
- Source HEAD at task start: `b7920f93f312561a2206d8a711cf7476f72588b8`
- Configured Git remotes at task start: none. The checkout therefore cannot
  independently verify a `DougZeThug/Will-You-Be-My-Hero-Arena` hosting URL;
  the root and committed project content are the available local identity.
- Starting worktree: clean. No newer local changes or untracked files needed
  merging, and the requested research revision was the checked-out HEAD.
- Recoverable pre-task checkpoint: ignored
  `work/qa/checkpoints/router-start/source.bundle` (SHA-256
  `ed1926b20cea771a55109929d241b6080290d5ccdc67a90ddda0807adda141e1`).
  `git bundle verify` reports complete history ending at the source HEAD. The
  bundle contains Git-tracked project history only—no environment files,
  credentials, browser profiles, dependencies, build output, or QA captures.

## Current runtime path

Normal app route:

1. `components/arena/ArenaStage.tsx` creates the recorded `ArenaGame`.
2. Only when `recording.setup.sport === 'cornhole'`, it dynamically loads
   `lab/performance/provider.ts` and calls `performanceMatchProvider()`.
3. The provider hash-checks and preloads side-view-v3 Dan/Doug assets, creates
   `lab/performance/LoongBonesAdapter.ts`, loads the matching profile from
   `lib/arena/engine/performance/profiles/`, and wraps the adapter in
   `lib/arena/engine/performance/CharacterPerformanceController.ts`.
4. `ArenaScene` and `CornholePerformancePlayback` drive semantic actions on the
   immutable recorded clock. The adapter presents the evaluated rig; it does
   not own scoring or alter saved release/contact/result facts.

Matching review routes:

- `/performance/`: isolated use of the same controller, adapter, profiles,
  compiled performance clips, release hands, and side-view-v3 definitions.
- `/?scenario=cornhole-performance`: the same provider in the recorded Arena
  scene.
- normal app **Watch → cornhole**: production entry and final real-match check.

These are not substitutes: `character-doug` and `character-dan` are legacy
paper previews; `cornhole-recorded` is an earlier weighted-rig comparison;
other Watch sports, live Play, and `/human-motion/` have separate providers and
contracts.

## Asset, profile, and recording identity

- Runtime revision: `cornhole-finish-settle-v1` in
  `lab/performance/compile.ts`.
- Character profiles:
  `lib/arena/engine/performance/profiles/dan.json` and `doug.json`, validated by
  `PerformanceProfiles.ts`.
- Native assets: `lab/loongbones/assets/cornhole-side-v3/{dan,doug}_{ske,tex}.*`.
  `lab/loongbones/side-rig/definitions.ts` binds their provenance, common
  68-inch stature, right-handed semantics, depth scaling, and hand surfaces.
- Skeleton SHA-256: Dan
  `5c6d58cc12733bff662e54108b4586461bae7b9e7f4de1192e95480bb773d28e`;
  Doug `35f761239247de3bd49bdd24d528d0bee55a6268d0f5add6520d682e9349a1aa`.
- Texture SHA-256: Dan
  `3ab18b381a7f534c8b4971910952ea71a649a6f60d3e1982f61e5aaa579953fb`;
  Doug `c558fcd634ea998d4c9c97a27135b0003239a9f9f0de1bdae551de69675e5f4d`.
- Provenance: these are Arena-authored layered LoongBones import rigs derived
  from approved likeness/art sources. They are not verified unchanged editor
  round trips. Original sources and returned-export distinctions remain in the
  provenance manifest and linked historical reviews.
- Preferred real-match case: immutable showcase seed `velvet-paw-29`. The
  repository's preserved recording is `docs/showcase-recording.json`
  (SHA-256 `6400b75a501895b950025e94b4941ff3aa71cab730c47cc102dd652d42ebc85f`).

## Baseline and preview

The current capture command was attempted at the source HEAD with label
`current-router-baseline`. The production build completed, but this environment
has no Chromium executable, and Playwright's browser download was rejected by
the package CDN. Consequently there is **no fresh rendered video claimed for
this HEAD**. The honest attempt report is
`work/qa/turn-polish/current-router-baseline/review.json`; it records revision,
seed, viewport, and the browser-launch failure.

Until the capture can be rerun in an environment with Chromium, use:

- actual immutable match recording: `docs/showcase-recording.json` with seed
  `velvet-paw-29`;
- last preserved real-court side-view preview:
  `docs/review/cornhole-side-v3/polish-court-release.png` (SHA-256
  `0e4dcc62f224a99b077de24c7e88d15fe5ddde858d3a438094ff0abf744f01f5`).

That PNG is a useful asset/court preview, **not** a fresh proof of the current
performance controller or finish timing. Do not relabel it as current capture
evidence.

## Launch and capture

```bash
pnpm lab
# http://127.0.0.1:3010/performance/
# http://127.0.0.1:3010/?scenario=cornhole-performance&seed=velvet-paw-29

pnpm review:cornhole-turn -- --build --label current-baseline
# work/qa/turn-polish/current-baseline/{recording.json,match.mp4,results.png,...}
```

The capture tool uses isolated contexts/storage and saves the actual selected
Watch recording plus its seed. A successful rerun should replace this section's
failed-attempt note with the exact output directory, recording hash, preview,
errors/console result, viewport, and revision. Do not copy a personal browser
profile into the repository.

## Known defects and next task

- Current blocker to a fresh local baseline is environmental: Chromium is
  absent and the Playwright download returned HTTP 403. This is not evidence of
  a runtime or animation failure.
- The last documented bounded animation defect is visibility/readability of
  bag impact against the existing `LANDING` cue after the settled finish. Do
  not change scoring, saved contact time, target registration, release motion,
  or artwork while investigating it.
- **Next task:** on a Chromium-capable machine, rerun the capture above and
  inspect the uninterrupted normal-speed real Watch match, especially visible
  impact, the final two Doug chest contacts, arm relaxation, and return to rest.
  Only after that current baseline exists should a separately scoped motion or
  presentation correction begin.
