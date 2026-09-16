# Cornhole turn: readable finish and settled handoff

## Baseline and scope

Starting checkout: `codex/character-performance`, HEAD
`324c9604333454d75935943c4c67d3955475e8f3`, with 48 modified/untracked
files preserved byte-for-byte in `work/qa/turn-polish/baseline/source/`.
`checkpoint.json` records hashes, branch and status; `tracked.patch` records the
tracked delta. The current dirty checkout, not HEAD, is the visual baseline.

Installed: Phaser 3.90.0, TypeScript 5.9.3, Playwright 1.62.1, Vite 8.0.13.
The existing `NativeFactory`/`NativeMesh` adapter uses pinned DragonBones
5.7.000 and DragonBones 5.5/5.6 data. Existing LoongBones 1.2.3 export provenance
is preserved; this task does not depend on a new editor export or feature.

Baseline user journey: clean browser context → Watch → setup with existing
Dan/Doug selection → Replayable showcase seed → Start → pause/resume → all
eight bags → results (Dan 3, Doug 7). Seed `velvet-paw-29`; full immutable
recording saved. No blocking regression or console error was observed.
Viewport 1440×1080, native game canvas 1280×720, normal camera/quality, 1×.
Controlled real-scene case uses `cornhole-performance`, same seed, and the
existing isolated Performance Lab checks both characters on a board outcome.

Focused review: Doug's second turn, approximately 10.55–15.0 match seconds;
release 12.2230614s, board outcome, then Dan preparing. Overlap is intentional.

| Visible issue | Baseline evidence | Responsible layer / correction |
|---|---|---|
| The arm loses the directed finish before the bag resolves | Around 13.1–13.8s; normal-speed video frame sequence and actual-court screenshots | Authored underhand tail and watch pose: retain a softened follow-through through flight |
| Arm and body recovery read as separate resets | Around 14.1–14.6s; fast recentering after the arm is already down | Authored recovery: staged arm relaxation and pelvic return, with no end-of-recovery upward bounce |

The joined wrists, planted shoes, original art, release poses, chest taps,
waiting-player priority and scoring are working and must remain intact.
This is one finish/recovery improvement, not a new animation architecture.

## Ownership

Phaser drives the existing `PlaybackClock`; `ArenaScene` synchronizes each
`CornholePerformancePlayback`. The controller advances the existing graph in
bounded 120 Hz intervals and dispatches release after sampling the hand.
`compilePerformance` authors native clips, the adapter evaluates skinning and
bounded constraints, and scene placement owns lane root transforms. Recorded
release/contact/outcome times remain simulation facts. No competing clock or
new transform writer is needed.

## Implemented: `cornhole-finish-settle-v1`

The existing pose compiler and native adapter remain the production path.
`BodyMechanics.ts` retains the directed finish only after the existing peak;
the watch and response clips soften it before recovery. Recovery releases the
arm first, then returns the pelvis without the previous small upward overshoot.
`Choreography.ts` now uses that authored recovery duration instead of a shorter
hardcoded segment. Preparation, release, bag physics and scoring are unchanged.

The shared source profiles are
`lib/arena/engine/performance/profiles/{doug,dan}.json`. Doug retains 0.58 of
the authored finish angle and recovers over 0.74 seconds; Dan uses 0.52 and
0.86 seconds. Other character-specific values remain intact. Both profiles use
one compiler, with no copied character-specific motion branches.

### Launch and tune

From the project root, in separate PowerShell terminals:

```powershell
node node_modules/vite/bin/vite.js --config lab/vite.config.ts --port 3020
pnpm build
$env:PORT='3022'
node scripts/serve.mjs
```

- Tuning: <http://127.0.0.1:3020/performance/>
- Actual built game: <http://127.0.0.1:3022/>
- Controlled real court: <http://127.0.0.1:3020/?scenario=cornhole-performance&seed=velvet-paw-29>

The five controls adjust throw tempo, backswing, weight shift, retained finish
and recovery time. Existing replay, pause, 1×/slow speed, stepping, timeline,
phase/time and contact diagnostics remain available. A changed value rebuilds
the inspected instant and pauses there. Reset restores the source defaults.
Changing character or importing JSON refreshes the controls. Page teardown
disposes the added controls and file listener.

Use **Export candidate**, then **Reload candidate JSON** to compare a saved
take. To promote a reviewed file into the normal match:

```powershell
pnpm motion:apply-profile path/to/doug-candidate.json
pnpm build
```

The local command validates all fields and writes only the named Doug/Dan
source JSON. The same validator is used by the Lab and production defaults.
The browser cannot write source files. Candidate edits are not stored in
localStorage. Export/reload/promotion were exercised with both reviewed source
profiles; UI tests also verify a non-default value survives export/reload and
that an invalid file leaves the current rig intact.

### Reproduce the review package

```powershell
pnpm review:cornhole-turn
```

This builds, uses or starts local servers, runs isolated browser contexts, and
writes `work/qa/turn-polish/candidate/`. It checks both characters, captures
preparation through recovery at controlled timestamps, records actual 1×
playback, runs the real Watch selection-to-results journey, exercises viewing
controls and replay, and checks three complete replays for accumulated scene
objects/listeners. It decodes saved MP4 frames into contact sheets and writes
`review.html`, `review.json`, source/profile checkpoints and event data. It
closes recording streams and contexts before returning. The command never
changes the user's save or promotes a profile. Use `--label another-case` to
keep an additional package. `ARENA_LAB_URL` / `ARENA_APP_URL` override ports.

The first baseline is preserved under `work/qa/turn-polish/baseline/`.
`baseline-built/` adds the matching built-game stall/replay check before the
candidate build. Its source checkpoint is the later working checkout; its
explicit runtime marker identifies the old build. Use the original baseline
checkpoint for original source/profile hashes. `cycle-1/` is the first focused
visual review, before the final built-game check. Do not overwrite these when
collecting a future candidate.

## Review evidence and limits

Baseline and candidate images include complete characters in the actual court
and diagnostic close-ups from the same runtime/assets. The before/after sheets
use matched simulation times, camera, root scale and outcome. The new finish
remains visible through landing at normal gameplay size; both characters keep
their distinct proportions and reaction styles. The chest taps and connected
hand surfaces are retained.

For the isolated board take at release + 1.1 seconds, wrist distance forward
of the throwing shoulder changes from 46.3 to 76.6 render-world pixels for Doug
and 55.9 to 85.0 for Dan. These are diagnostics in the canonical 1280×760 Lab
space, not quality scores. Every sampled joint before release is unchanged;
release, contact and result event times are identical. The sampled recovery
span changes from 0.48 to 0.73 seconds for Doug and 0.47 to 0.87 for Dan. The
small upward pelvis overshoot (1.54 / 0.91 pixels) is removed. Pelvis position
is not a measured center of mass. Planted-sole checks apply to the established
planted take, not to actions that legitimately lift or pivot a foot.

The interactive browser viewing surface is unavailable in this session.
Saved 1× videos are decoded into frame sequences and those images are opened
for visual review; this is not a claim of watching the video. Manually stepped
pose captures are labeled separately from real-time recordings. Headless
Chrome timing and long-frame observations do not certify physical-device
performance. The final built candidate package is separate from `cycle-1/`.

### Automated validation

- Typechecking and all 170,734 simulation/animation checks passed.
- The broad browser run passed 139 checks and skipped one optional approved
  pixel-baseline check. One new assertion incorrectly expected the entire
  release history after a direct seek to the end. The existing seek contract
  reconstructs only the current action. The test now advances three complete
  replays, verifies four releases per character and compares object/listener
  counts. Both tests in that file passed on rerun, bringing the distinct passed
  browser checks to 140. No runtime change was needed for this correction.
- The production build and production-isolation smoke passed. Lab/debug globals
  are absent from the normal game. Shared-code regression coverage includes
  the existing basketball recorded scenario, release continuity and personality
  reaction; football/pong and live-event checks also passed.
- Targeted lint and a final typecheck passed after the replay-test correction.
  The original aggregate report and failing-test log are retained alongside the
  successful rerun; the history is not rewritten as a clean aggregate run.

The exact `pnpm review:cornhole-turn` command passed, including its fresh build.
The normal UI journey reaches Dan 3–Doug 7, supports pause/resume and speed
cycling, then replays without changing the recorded facts or award ledger.
All recorded facts match the baseline after normalizing the random match UUID,
creation timestamp and derived integrity hash. Source skeleton/atlas hashes,
camera and equipment registration match. Three complete controlled replays
each end with two characters, two cards, eight projectiles, 48 display objects
and one controller listener per character.

The final pose sheets, actual-court still and decoded frames from all three
candidate videos were opened and inspected, along with the normal results
screen. The directed finish and staggered return are visible on both
characters; the existing chest tap remains in the full match. The media files
are finalized 1× recordings. No page exceptions or asset errors occurred;
the existing missing favicon produces a 404 on each server origin.

The comparable built Watch runs recorded one frame over 50ms in the baseline
(334.9ms) and two in the candidate (52.9ms and 331.9ms). This narrow headless
stall observation does not show a new sustained slowdown, but is not a full
frame-time distribution or a device-performance guarantee. The existing Lab
Phaser-delta diagnostic reports a candidate p95 of 18.01ms for both characters.
No performance optimization was justified by this pass.

Open the combined package at
<http://127.0.0.1:3020/@fs/C:/Users/Doug/Documents/Codex/.pnpm-store/v11/arena-performance/work/qa/turn-polish/review.html>.
The new full-match clip is `candidate/match.mp4`; Doug's focused turn is around
10.5–15 seconds. Before/after images are `doug-before-after.png`,
`dan-before-after.png` and `court-before-after.png` in that package directory.

`work/qa/turn-polish/verification.json` combines the final capture, immutable
recording comparison, source-asset hashes, diagnostics and exact test reports.
`checkpoint/` contains task-owned before/after sources and a reviewable diff.
A standalone commit was not made: the core edited runtime files were already
untracked user work, so committing this pass would absorb that earlier
foundation. All pre-existing non-task files remain byte-for-byte unchanged.

## Next bounded task

Audit the visible bag-impact and LANDING cue alignment. The sampled controller
contact for Doug's second turn occurs around 13.20 seconds, while the saved
legacy phase contact is 13.473 seconds. Inspect that roughly 0.27-second gap in
the recorded match before changing anything; preserve authoritative scoring
times. This is a follow-up audit, not a confirmed visual defect fixed here.
