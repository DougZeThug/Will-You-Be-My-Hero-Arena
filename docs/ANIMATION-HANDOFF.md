# Animation handoff

This is the current router for Dan and Doug's **recorded Watch and interactive
Play cornhole** performance, and for their **side-view Play running and
fighting** and the **view (camera angle) system**. Replace stale details here
when the installed path changes; do not append a pass-by-pass history.
Historical implementation evidence remains in
[`CHARACTER-PERFORMANCE.md`](CHARACTER-PERFORMANCE.md). What is still missing
is tracked in [`ANIMATION-ROADMAP.md`](ANIMATION-ROADMAP.md).

## Project and source checkpoint

- Repository root: `/workspace/Will-You-Be-My-Hero-Arena`
- Branch at task start: `work`
- Source HEAD at workflow task start: `889988cb7ebb3cc274cdfe3e4d986d4a28bae6e4`
- Configured Git remotes at task start: none. The checkout therefore cannot
  independently verify a `DougZeThug/Will-You-Be-My-Hero-Arena` hosting URL;
  the root and committed project content are the available local identity.
- Starting worktree: clean. The workflow changes described below preserve that
  checkpoint and do not change performance curves, gameplay, or artwork.
- Recoverable pre-task checkpoint: ignored
  `work/qa/checkpoints/router-start/source.bundle` (SHA-256
  `ed1926b20cea771a55109929d241b6080290d5ccdc67a90ddda0807adda141e1`).
  `git bundle verify` reports complete history ending at the source HEAD. The
  bundle contains Git-tracked project history only—no environment files,
  credentials, browser profiles, dependencies, build output, or QA captures.

## Current runtime path

Normal app route:

1. `components/arena/ArenaStage.tsx` creates the recorded `ArenaGame`.
2. Only when the resolved sport is `cornhole` (`recording.setup.sport` once a
   recording is loaded, otherwise the stage's `sport` prop), it dynamically
   loads `lab/performance/provider.ts` and calls `performanceMatchProvider()`.
3. The provider hash-checks and preloads side-view-v3 Dan/Doug assets, creates
   `lab/performance/LoongBonesAdapter.ts`, loads the matching profile from
   `lib/arena/engine/performance/profiles/`, and wraps the adapter in
   `lib/arena/engine/performance/CharacterPerformanceController.ts`.
4. `ArenaScene` and `CornholePerformancePlayback` drive semantic actions on the
   immutable recorded clock. The adapter presents the evaluated rig; it does
   not own scoring or alter saved release/contact/result facts.

Interactive Play route:

1. `components/arena/live/LiveStage.tsx` injects the same hash-checked provider
   only for cornhole; unsupported characters and other sports retain their
   existing presentation rigs.
2. `LiveArenaScene` preloads that provider and `CharacterPresentation` advances
   the performance controller from the fixed-step live semantic action state.
3. Live event rules remain authoritative. The evaluated LoongBones hand supplies
   the held-bag and release origin, and the held sprite uses the rig's layer
   between the torso and opaque grip fingers. The performance rig owns the one
   lane-depth-scaled court shadow. Existing input, contact, scoring, pause, and
   turn transitions remain unchanged.

Play running and fighting (side-view motion rig):

1. `LiveStage.tsx` (and `LabRuntime` for `running-live` / `fighting-live`)
   injects `lab/human-motion/provider.ts` → `sideMotionProvider(event)`. It
   hash-checks the original side-v3 skeletons/atlases and loads the hand sheet
   and rear-garment sources. Only Dan and Doug get the rig; any other
   character keeps its puppet.
2. `lab/human-motion/PlayMotionRig.ts` runs the Human Motion
   `NativeAnimator` + `MotionPlanner` (reference-measured gaits, world-space
   foot locks, touchdown blends, support compression, complete far arm,
   rear-three-quarter garment view when facing left). The **event simulation
   stays the only authority**: each frame `CharacterPresentation` mirrors the
   presented body (position, step-displacement velocity, height) into the
   motor the animator reads (`CharacterRig.drive`), so gaits are fitted to the
   real ground speed and planted feet do not slide. Simulation clip starts
   drive actions: jump (entered at takeoff, air phase stretched to the real
   airtime), slide (`authoring/play.ts`), stumble → hit, combat jab/heavy/
   dodge/block/hit, finish/win → success.
3. Play tuning lives in `PlayMotionRig` (`PLAY_GAIT`: doubled running stride,
   arm swing back past the hip). The Human Motion Lab proofs keep their
   defaults (`GaitTuning`), so `/human-motion/` and its tests are unchanged.

View system (`lib/arena/engine/characters/CharacterView.ts`):
`chooseView` picks the drawn angle that faces the camera: the profile rig for
travel and exchanges across the screen, the front cut-out puppet for
camera-facing beats (`ready` before the start, `finished` after the result).
`CharacterPresentation` keeps both rigs and turns between them with a 0.22 s
paper flip through edge-on (`viewWidths`), so the two drawings are never on
screen together. Three-quarter or back drawings would be further views; they
need new art (see the roadmap).

Matching review routes:

- `/performance/`: isolated use of the same controller, adapter, profiles,
  compiled performance clips, release hands, and side-view-v3 definitions.
- `/?scenario=cornhole-performance`: the same provider in the recorded Arena
  scene.
- normal app **Watch → cornhole**: production entry and final real-match check.
- normal app **Play → cornhole** and the `keyboard-cornhole` /
  `controller-cornhole` scenarios: live fixed-step integration checks.

These are not substitutes: `character-doug` and `character-dan` are legacy
paper previews; `cornhole-recorded` is an earlier weighted-rig comparison;
`/human-motion/` is the research Lab whose animator Play running/fighting
reuse (with Play tuning); Watch basketball, football and beer pong still use
the front-view puppet and separate contracts.

## Asset, profile, and recording identity

- **Shipped motion authority:** the throw is a per-character take
  (`lib/arena/engine/performance/takes/{dan,doug}-underhand.ts`, schema
  `arena-performance-take-v1`, documented in `takes/README.md` including the
  mocap mapping and optional footwork channels), validated by
  `TakeValidation.ts` and converted by `BodyMechanics.underhandMechanics`;
  character differences come from the takes and the validated profiles; and
  `lab/performance/compile.ts` alone emits native curves (baked per native
  frame, with overlap springs, rejected if any frame leaves `NativeLimits`),
  durations, loop counts and semantic marker timing.
  `installShippedPerformanceClips` validates the character profile, compiler
  revision and `side-v3-attachment-r4` asset revision before deliberately
  replacing the skeleton's editor-reference clips. Those embedded clips are
  not an editable production motion source and are never merged into runtime.
- **Side-v3 asset authority:** the skeleton and atlas remain authoritative for
  bind geometry, bones, slots, IK constraints, material registration and source
  artwork. Motion installation must not rewrite those fields.
- Runtime revision: `cornhole-cartoon-take-v1` in
  `lab/performance/compile.ts`.
- Rig safety nets: `KneeReach.softReachDrop` lowers the pelvis before a
  planted leg reaches the two-bone singularity (no knee pops); the adapter
  applies stateless squash pulses at root level only and counter-scales the
  held-object layer so the bag keeps its shape.
- Bag flight: performance releases use `ballisticFlight`
  (`release-ballistic-blend-v1`): the bag leaves at the evaluated hand
  velocity, blends to a ballistic cruise with bounded gravity and lands
  exactly on the recorded touch point and time.
- Play clock: the charge plays the take into a held top of the backswing;
  the release input drives it so the release marker lands on the live
  release step (no speed snap).
- Character profiles:
  `lib/arena/engine/performance/profiles/dan.json` and `doug.json`, validated by
  `PerformanceProfiles.ts`.
- Native assets: `lab/loongbones/assets/cornhole-side-v3/{dan,doug}_{ske,tex}.*`.
  `lab/loongbones/side-rig/definitions.ts` binds their provenance, common
  68-inch stature, right-handed semantics, depth scaling, and hand surfaces.
- Skeleton SHA-256: Dan
  `5c6d58cc12733bff662e54108b4586461bae7b9e7f4de1192e95480bb773d28e`;
  Doug `05e11c8e8965af52318176e491f0c1916c1b77451d19c37e8e9d3aaa9d99dc78`
  (runtime derivative `doug_arm-material-v1_ske.json`, produced by
  `pnpm generate:doug-arm-material`; the authoritative source `doug_ske.json`
  is `35f761239247de3bd49bdd24d528d0bee55a6268d0f5add6520d682e9349a1aa`).
- Texture SHA-256: Dan
  `3ab18b381a7f534c8b4971910952ea71a649a6f60d3e1982f61e5aaa579953fb`;
  Doug `c558fcd634ea998d4c9c97a27135b0003239a9f9f0de1bdae551de69675e5f4d`.
- Provenance: these are Arena-authored layered LoongBones import rigs derived
  from approved likeness/art sources. They are not verified unchanged editor
  round trips. Original sources and returned-export distinctions remain in the
  provenance manifest and linked historical reviews.
- A returned editor export is accepted only after
  `assertPerformanceEditorRoundTrip` compares bind/skin/slot/constraint data,
  every compiled curve, duration and loop count, semantic marker timing, and
  named preparation, release, follow-through and recovery pose samples. Merely
  loading successfully or matching a file identity is not motion acceptance.
- Preferred real-match case: immutable showcase seed `velvet-paw-29`. The
  repository's preserved recording is `docs/showcase-recording.json`
  (SHA-256 `6400b75a501895b950025e94b4941ff3aa71cab730c47cc102dd652d42ebc85f`).
- Annotated `velvet-paw-29` timing axis: **13.193 s first board impact →
  13.473 s saved final target/outcome → saved score reveal →
  perception-delayed character reaction**. The 13.193-to-13.473-second
  separation is the recorded flat bag's 0.28-second board slide, not extra
  airborne time. The saved contact, target, score, score reveal, and all other
  outcome facts were preserved; only presentation derives first impact from
  the directed shot and existing surface-travel rule.

## Review workflows

### Fast candidate review (edit to preview)

```bash
pnpm review:cornhole-fast -- --label <unique-candidate-label>
```

This runs the focused tuning/current-performance browser tests against Vite,
then uses the existing `--lab-only` capture. It does **not** build production.
The package contains both characters in the isolated current renderer, exact
game-clock court frames for preparation, release, follow-through, first impact,
reaction, recovery, the next turn, and Doug's final chest contact, plus native
1× videos. The timeline, profile import/export/reset controls, and production
provider are reused; `doug-release` is the only added named checkpoint.

For a capture without the focused tests, the underlying command remains:

```bash
pnpm review:cornhole-turn -- --lab-only --label <unique-candidate-label>
```

### Acceptance review (fresh production and shared runtime)

```bash
pnpm review:cornhole-acceptance -- --label <unique-acceptance-label>
```

`check:regression` supplies typecheck, deterministic tests, all ordinary browser
tests, a fresh production build, and production isolation. The existing
`--journey-only` capture then exercises the actual **Watch → selection → eight
bags → results → replay** path. It rejects a build whose recorded source
fingerprint differs from the current tree. Use the full underlying capture only
when one package genuinely needs both surfaces:

```bash
pnpm review:cornhole-turn -- --build --label <unique-complete-label>
```

### CI browser and evidence

`.github/workflows/cornhole-visual-review.yml` uses the Chrome already present
on GitHub's Ubuntu runner rather than downloading Playwright Chromium during the
job. Every job exports the resolved path through `ARENA_BROWSER_EXECUTABLE` and
runs `pnpm browser:preflight`. The same checks that `pnpm check:regression`
runs serially on a workstation run there as parallel jobs: `focused` (the fast
candidate review), `checks` (typecheck, deterministic tests, fresh build and
production isolation) and `browser` (the ordinary browser suite in three
Playwright shards, `pnpm test:browser -- --shard=n/3`). The `acceptance` Watch
match job starts only after `checks` and every shard pass, rebuilds at the same
revision and runs `cornhole-turn-review.mjs --journey-only --require-fresh-build`.
The measured serial job took 52 minutes (17 minutes of lab-only capture, 31
minutes of browser suite) before the acceptance journey could even start; the
parallel layout bounds the wall clock by the slowest job plus the journey. Each
job uploads its own `work/qa` evidence (turn-polish packages, browser reports
per shard, production evidence) for human or Codex inspection; the aggregate
`work/qa/regression.json` remains a local `pnpm check:regression` product. Keep the installed Chrome path and version in `review.json`; do not
promote CI screenshots to reviewed baselines automatically. Do not enable
`ARENA_BROWSER_VIDEO` in this job unless Playwright's matching FFmpeg package is
also installed: the turn-review canvas recorder already creates the required
Dan, Doug, and match MP4s without Playwright failure video.

The `--build` flag is now explicit. Previously the package script silently
built even with `--lab-only`: the measured failed baseline attempt took 38.961s,
with the production build consuming about 30s before browser launch failed.
That made the unnecessary build the observed edit-to-preview bottleneck on this
machine. These timings describe this checkout only; they are not a portable
speedup promise. Successful packages record cumulative command milestones in
`review.json` for future comparisons. Regression reports separately retain
per-check acceptance timing.

## Evidence identity and image review

Every new label must be unique; the tool refuses to overwrite an earlier
package. `review.json` records HEAD, dirty-source SHA-256 fingerprint, runtime,
profile/asset/recording hashes, immutable recording hash, viewport, normal
Arena camera, Chromium version/headless mode, and 1× speed. Review servers are
owned by the command rather than silently reused, and acceptance verifies the
fresh build fingerprint. This makes stale server/build reuse an error rather
than ambiguous evidence.

The opt-in image suite registers four current implementation views: Dan and
Doug isolated release, and Dan and Doug release on the real court. Each uses
the engine's paused seek/step clock and matching Playwright environment; CSS
animation disabling is only extra screenshot stabilization. The current four
baselines are intentionally absent, so this focused comparison reports a skip
rather than becoming a permanently failing assertion or pretending that an
older review image is current. Captures produced by
`pnpm test:browser:update` are **candidates** until a person opens all four,
compares matching environments, and deliberately commits them together. A
generated image and a passing technical check are not visual approval, and a
baseline is only a comparison reference.

## Launch and manual review

```bash
pnpm lab
# http://127.0.0.1:3010/performance/
# http://127.0.0.1:3010/?scenario=cornhole-performance&seed=velvet-paw-29

pnpm review:cornhole-fast -- --label candidate-01
# work/qa/turn-polish/candidate-01/{doug.mp4,dan.mp4,game-*.png,...}

pnpm review:cornhole-acceptance -- --label acceptance-01
# work/qa/turn-polish/acceptance-01/{recording.json,match.mp4,results.png,...}
```

Open `review.html`, the full-size PNGs, and the 1× videos. Judge rhythm from
continuous playback—not manual stepping. Timestamped video frames help locate
a moment but do not replace motion review. If video cannot be played, disclose
that limitation rather than calling stepped poses a real-time benchmark. Keep
technical assertions (hashes, markers, scoring, warnings) separate from visual
judgment (weight, continuity, contacts, likeness). The contexts/storage remain
isolated from the regular game.

## Known defects and next task

State after the smoothness/cartoon/profile passes (branch
`claude/character-animation-smoothness-7yopto`):

- Watch cornhole and all of Play (cornhole, running, fighting) show Dan and
  Doug on side-view rigs. Watch basketball, football and beer pong still use
  the front-view puppet: a throw across the court drawn on a figure facing the
  camera cannot look fully real even with the foreshortened elbows and knees.
  Moving them to the side rig needs a seek-safe (stateless or replayable)
  side animator and rig-hand releases like cornhole's; see the roadmap.
- Fighting uses the proof's near-arm jab and heavy; Play's cross, uppercut,
  finisher, special and grapple reuse them, and defeat is a dejected gesture,
  not a knockdown. The far-arm guard stays low (hidden-arm art limit).
- Numeric checks are not visual proof. Review with
  `node scripts/capture-motion-quality.mjs --label <new> [--cases ...]`
  (frame-exact 60 Hz WebM, frame strips and socket metrics under
  `work/qa/motion-quality/`); it covers Watch sports, cornhole, running and
  fighting, including race/fight starts and the finish view turn.

Chromium is available in this environment at `/opt/pw-browsers` (set
`ARENA_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
