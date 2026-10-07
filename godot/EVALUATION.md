# Godot experiment: evaluation charter

**Status: DRAFT, awaiting owner approval.** Thresholds below are registered *before*
any Godot art or slice result exists. After approval, a threshold changes only in its
own commit with the reason in the message, and the file history must show no threshold
edit made after results for that threshold were known.

Owner approval: `____________________` (name/date, written in a commit or PR comment)

## Question and motive

The owner's aim is a **Steam/desktop** game whose player animation is clean, after a
long run of limb, sleeve, shoulder and release problems on the web stack. The
experiment asks one thing:

> With characters, equipment and court **regenerated for Godot**, can a Godot client
> play the existing Watch recordings with clean, grounded, seek-safe character
> animation, and is authoring that animation materially faster than on the frozen
> Phaser build?

It is a **combined art + engine** result and is reported as such. It does not try to
separate the two. It also says nothing about the web build.

## Decisions already made (owner)

- Primary target is Steam/desktop; Godot work lives in `godot/` in this repository.
- Regenerate characters, equipment and court; characters via AI image generation plus
  cleanup. Original collectible cards, likenesses and the approved printed-sunset
  direction are the references; the art request is explicit (see root `AGENTS.md`).
- The Phaser build is frozen at commit `095da1c`, tag `phaser-legacy-095da1c` (bug fixes
  only), and is the oracle for recordings, scoring, timing and world constants.
  **Tag status:** the tag was created locally, but pushing it from the cloud session failed
  ("remote end hung up", four retries, no proxy relay failure recorded, while the branch
  push worked), so it is not on the remote. The commit hash is authoritative; create the
  tag on GitHub (`git tag phaser-legacy-095da1c 095da1c && git push origin phaser-legacy-095da1c`
  from a machine that can push tags) if you want the named marker.
- The TypeScript simulation stays authoritative. Godot plays exported recordings; the
  rules port is decided only after Gate 1 passes.

## Baseline (Step 0, recorded 2026-09-29)

Legacy commit `095da1c`, tag `phaser-legacy-095da1c`, measured in a throwaway worktree
under Node 22.22.2 (repo pins Node 24.x; pnpm printed an engine warning, nothing failed):

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ok, 14 s |
| `pnpm typecheck` | pass, 13 s |
| `pnpm test` | exit 0, **181,095 checks**, 36 s (the committed `docs/test-results.json` said 179,077, so it was stale by 2,018; the run rewrites that tracked file, hence the throwaway worktree) |
| `pnpm build` | exit 0, 28 s (Vite chunk and dynamic-import warnings only) |

Regression floor for every later step: `pnpm test` reports **at least 181,095 checks**
on a clean checkout, or the drop is explained.

Godot toolchain: see [PROBES.md](PROBES.md). Godot 4.7.2-stable, GUT 9.7.1, capture via
Xvfb + Mesa llvmpipe all verified working from a cold container.

## Registered thresholds

### Art acceptance (Step 2 Doug pilot, Step 5 Dan)
Measured by the mask-based rig-QA gate (`godot/art/`, defined in Step 1) over the fixed
pose battery, for both characters:

- **Zero** gate failures across the whole battery (connected coverage, enclosed
  see-through area, joint overlap, hand-over-sleeve, hem/thigh follow, far-arm reach,
  planted-foot drift, hand-to-bag distance before release).
- At most **2 manual paint-over repairs** per character part sheet.
- Owner signs off likeness **and the printed-sunset style** on 3 stills per character,
  each rendered at play size on the current court beside the legacy side-v3 rig at the
  same camera and scale, plus the continuous frames from 10 before to 20 after the
  release marker at normal speed.
- **Hand swap at release**, checked on every frame from 10 before to 20 after the release
  marker: the palm socket moves at most **1 px** relative to the evaluated hand bone
  across the grip-to-open drawing swap, no frame shows both hand drawings, and no frame
  shows the hand detached from the forearm.
- At most **4 skin influences per vertex** (Godot's hard limit, see PROBES.md).
- 8-bit alpha, colour bled into transparent texels.

### Slice parity and invariants (Steps 4 and 5)
- Release happens on the contract's release marker; the bag is attached to the
  evaluated hand socket until then. Event order identical to the recording.
- Event times within **1/60 s** of the recording's `releaseAt`, `contactAt`, `scoreAt`,
  and, for each cornhole attempt with board travel, of its **first board impact**
  (`firstImpactTime`: `contactAt` minus 0.28 s or 0.22 s of surface travel; see
  `lib/arena/engine/events/cornhole/CornholePresentationTiming.ts`). An attempt with
  zero travel (a direct shot, or a miss with no recorded touch more than 2 px from its
  target) has no separate board touch: `firstImpactTime` equals `contactAt` and is not
  checked as an impact. For attempts with board travel the contract exports the
  first-impact time and touch point; the bag first touches the board at that point
  within **1e-6** on script-side float64.
- Bag landing within **1e-6** of the recorded target, computed on script-side float64.
- **20 random seeks per attempt** (including backward) equal forward play within 1e-6.
- Displayed contact, score and running tally equal the recording. No randomness, no
  scoring code and no physics bodies in `godot/scripts` (guarded by a grep test).
- Both characters 5′8″; lane depth applied uniformly to rig, feet, sockets, shadow and
  release velocity. Supporting feet never slide or sink.

### Gate 1 (Step 6)
- **PASS** needs all of: the art gate clean for both characters; the owner prefers the
  Godot throw on **at least 6 of 8** keyframes and normal-speed clips in a same-machine
  side-by-side; time to complete the five canned tweaks is **at most 50%** of the
  recorded Phaser baseline, or the owner chooses the Godot editor loop in a 1-hour
  session; cumulative effort **at most 40 agent-days**. PASS unlocks Gate 2 planning
  only, not the migration.
- **PARTIAL**: art gate passes, but preference or authoring-speed is missed. Keep the
  art and contract, do not expand Godot, decide again after one more iteration.
- **FAIL**: see kill criteria. `godot/` is frozen or deleted; Phaser continues.

## Kill criteria

- **K1** the toolchain cannot be driven or reviewed by an agent in this environment
  (cleared for Step 0, see PROBES.md; re-open if the environment changes).
- **K2** after **3 generation rounds** the gate still fails on hidden-part completion
  (far arm, hem, wrist chain). Fallback is human paint-over or commissioned parts,
  the owner's decision.
- **K3** the contract export cannot be made byte-idempotent.
- **K4** Godot cannot honour the seek-safe, pure-function clock.

## Five canned tweaks (authoring-speed test)

1. Release two frames earlier. 2. Pelvis compression of 10 px at the plant.
3. Grip registration shift of 3 px. 4. Far-arm forward-swing gap fix.
5. Bag-follow camera move.

Each is timed from instruction to reviewed contact sheet. **Open item:** the Phaser-side
baseline timings are not recorded yet. They must be measured (with the repo's own review
tooling and Chromium) before Step 4 starts, and added here before Godot timings exist.

## Not covered by this experiment

Play (live input), the other sports, the React UI and installer, accessibility on
desktop, Steam integration, export builds, real-GPU performance. Gate 2 covers them.

## Result log

| Date | Step | Result |
|---|---|---|
| 2026-09-29 | 0 | Baseline recorded; toolchain probes pass; see PROBES.md. |
| 2026-09-29 | 1 | Art spec, 18-pose battery and rig-QA gate written. Clean test puppet passes all 18 poses; six injected defects each fail on the intended metric (`tools/rig_qa_selftest.sh`). |
| 2026-09-29 | prototype | Exploratory animation and camera prototype, not a gate: Skeleton2D skinned mesh vs Scalable Vector Shapes vs SpriteFrames hybrid on one Doug (scripted placeholder art), plus a Phantom Camera spike. Skinned joints were smoother than SVS at the elbow, shoulder and knee; SVS cost about 28× more script time per pose; Phantom's camera is history-dependent. No adoption decision. See [`PROTOTYPES.md`](PROTOTYPES.md). |
| 2026-10-06 | charter | Pre-approval amendments, before any Godot art or slice result exists: first board impact and touch point added to slice parity (the visible impact is up to 0.28 s before `contactAt`); a per-frame hand-swap check at release and play-size, in-court, side-by-side likeness and style sign-off added to art acceptance. Found by a multi-agent audit. |

### Harness calibration during Step 1 (disclosed)

While validating the gate on the **test puppet** (no real art existed, so nothing here
was tuned to a real result), these changes were made after the first runs. Thresholds
themselves stayed as registered except where noted.

- Bug fix: colours were loaded as `int16`, so the mask distance overflowed to NaN and every
  pose failed with 30-45% under-coverage. Fixed to `int32`.
- Contract: an inset on the chest-top capsule (its rounded end stuck out beside the neck).
- Holes rule changed from "enclosed regions equal an expected count" to "no enclosed
  see-through region inside the expected core". The first rule made the battery encode
  whatever the renderer produced; pockets between the legs are anatomy.
- Adjacency changed to be **joint-aware** (each pair names its shared joint) with an
  occlusion skip, because a hidden joint cannot be judged from one view. `min_px` was
  loosened from 20 to 3 (meaning "touches at all"); detached parts are still caught by the
  component and coverage metrics. This is the one numeric loosening; it is recorded here
  rather than hidden.

### Prototype corrections (disclosed)

While building the `anim_compare` prototype (scripted placeholder art, nothing tuned to a
gate threshold):

- Arm art was first drawn 90 px below the rig's real shoulder (the clavicle hangs off the
  tip of `spine_upper`), so wrists pivoted about the wrong point and hands floated off the
  forearm at `release`. Found from the battery renders and fixed in the art generator.
- My first tear metric counted a hand that reached into the neighbouring column's window.
  It now labels components over the whole frame and assigns each to the nearest column.
- `art/qa/test_puppet.gd` (the rig-QA fixture) now turns `autocalculate` off before
  `add_child` so leaf bones stop emitting engine warnings that GUT counts as errors.
  Behaviour is otherwise unchanged; `tools/rig_qa_selftest.sh` still passes.
- `project.godot` gained a `PhantomCameraManager` autoload for the camera spike. Remove it
  with the prototype if the addon is not adopted.
