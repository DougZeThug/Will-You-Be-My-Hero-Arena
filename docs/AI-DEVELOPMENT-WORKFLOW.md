# AI-assisted Arena development

Use GPT-6 Astra as the primary engineer. Describe the desired result or attach a screenshot/video; Astra should reproduce it, inspect the implementation, make the bounded change, run checks and show the result. You do not need to write code, edit configuration or operate a terminal.

## Start a task

Open the **Arena repository** in Codex: the folder containing `package.json`, `AGENTS.md`, `app/` and `lib/`. In the original workspace this is `outputs/arena`, not its enclosing conversation folder. This keeps project instructions and repository skills discoverable.

`AGENTS.md` holds durable architectural and visual rules. The six `.agents/skills/` workflows guide specialized reviews. Codex reads repository instructions and discovers repository skills from the current folder toward the repository root. See the official [AGENTS guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and [skills guide](https://learn.chatgpt.com/docs/build-skills).

Start with an observable outcome and what should stay intact:

> Doug's shoulder jumps during release. Reproduce it in Arena Lab, fix the transition, preserve his face/outfit and all scoring, and show before/after motion.

> Run an Arena regression review. Check the four Watch sports, character motion, keyboard and controller input. Fix confirmed regressions and show the evidence.

> Audit performance during a full match on this computer. Find the largest avoidable cost without changing the art direction or weakening animation.

Astra should establish the current Git state and starting behavior before modifying a subsystem. For larger features, use the [checkpoint/worktree workflow](GIT-WORKFLOW.md). A worktree must start with the present Arena source and assets, not the old repository baseline.

## Arena Lab

For the opt-in shared movement architecture, ask **“Open Human Motion V2.”** The Lab's V2 link opens cornhole, running, basketball and fighting proofs using the same motor, planner and native graph. Choose an event and press Play; slow-motion, silhouettes, skeleton/contact overlays and a timeline slider are built in. See [Human Motion V2](HUMAN-MOTION-V2.md) for its migration boundary and current artwork limits. Ask **“Analyze this real sports video as motion reference”** with an attached video; Astra handles the separate MediaPipe/OpenCV utility and loads the result for review. No code or terminal work is required from you.

Ask **“Open Arena Lab.”** Astra runs `pnpm lab` from the repository and opens [http://127.0.0.1:3010](http://127.0.0.1:3010). It is a standalone internal environment sharing the actual Phaser runtimes, characters, equipment and rules. The normal Play/Watch application remains separate.

Choose a named scenario instead of navigating collection/setup flows. **Load / reset** uses the selected seed. Character scenarios also expose character and animation selectors. **Play**, **Pause**, **+1 frame**, **+1 second** and named checkpoint buttons control inspection. **Copy scenario link** preserves the selected scenario/options/checkpoint; **Download state JSON** saves the inspected state. The Lab does not award points, install characters or clear the regular game's browser storage.

The Lab opens paused with a manual clock. Its **Pause** button is a diagnostic freeze: it preserves a partially charged shot for inspection. This differs deliberately from real gameplay pause caused by window blur, visibility loss or controller disconnect, which runs input cleanup and cancels charging. Press **Play** and focus the arena to use actual keyboard or controller input.

| Scenario | What it proves |
|---|---|
| `cornhole-recorded` | Weighted Dan + Doug in recorded cornhole; includes named Doug anticipation/release/follow/recovery checkpoints |
| `cornhole-paper-reference` | Explicit older-paper comparison; no weighted replacement |
| `basketball-recorded` | Recorded shot/release, ball flight, hoop contact and score |
| `football-recorded` | Recorded football release, target contact and score |
| `beer-pong-recorded` | Recorded wrist release, table/cup contact and result |
| `character-doug` | Doug's isolated semantic animation, pose and attachment state |
| `character-dan` | Dan's isolated motion and contrasting personality |
| `keyboard-cornhole` | Real keyboard focus, aim, hold/release and controller path |
| `controller-cornhole` | Browser gamepad mapping, analog values and lifecycle behavior |
| `running-live` | Continuous movement, locomotion and obstacle reference |
| `fighting-live` | Attacks, guard/dodge, hit windows, reactions and buffering |

The `*-recorded` sports are Watch scenarios. Basketball, football and beer pong do not become direct-control events merely by being available in the Lab. Cornhole, running and fighting are the current live references. Live scenarios assign Doug to keyboard/controller slot 0 and Dan to AI; recorded scenarios present Dan first, then Doug.

Weighted character reviews are linked at the top of Lab. [the current weighted motion review](http://127.0.0.1:3010/loongbones/doug/) offers Play, clip selection, skeleton, silhouette, mirror, court scale and his editor import ZIP. [Dan's restored review](http://127.0.0.1:3010/loongbones/dan/?sample=restored) uses his returned export with documented compatibility fixes. Doug's current pack is locally authored, not yet returned from LoongBones. The main cornhole Lab now uses explicit motion-v2 derivatives with right-handed throws. Choose Dan or Doug in the motion review, then select a clip and press Reset / Play. The new import ZIP uses the same derived files. Other sports, live play and the player app retain existing rigs. See [the motion audit](review/cornhole-motion-v2/README.md). Ask Astra: “Review Doug's flat throw, then compare it with Dan in the main Lab.”

Named scenarios pin seed, participants and options. Keep those inputs with a defect report. A changed seed is a new comparison; it should not silently replace a failing reproduction. Recorded/character checkpoints seek to exact sampled times. Live checkpoints reset and replay neutral human input through the real controller path, then restore the assigned keyboard/gamepad device. Held hardware cannot change that baseline. A checkpoint does not restore earlier ad hoc human input; load and replay an explicit sequence to reproduce such a case. Paused checkpoints are for exact comparisons, while real-time playback is needed to judge rhythm and fluidity.

Useful request:

> Load `character-doug`, inspect his celebration and release, then compare with `character-dan`. Show me any shoulder distortion, foot sliding or detached equipment before changing anything.

## Debugging/state API

The Lab exposes the versioned `window.__HERO_ARENA__` interface. This is an internal test contract, absent from the production app. Astra or browser tests can inspect it; the user does not need to use the browser console.

| Method | Purpose |
|---|---|
| `catalog()` | Registered scenarios, available characters and clips/markers |
| `getState()` | Serializable resolved scenario/options, runtime, event, character, animation and input state |
| `getPerformance()` | Bounded frame statistics and relevant rendering/game counters |
| `loadScenario(...)` | Load a registered reproducible scenario |
| `pause()` / `resume()` | Control the scenario clock |
| `step(...)` | Advance controlled simulation/render steps |
| `seekCheckpoint(...)` | Jump to a checkpoint defined by that scenario |
| `input(...)` | Send supported input through the normal semantic controller path |
| `setGamepad(...)` / `restoreGamepad()` | Explicit raw synthetic Gamepad snapshots / restore real browser provider |

Use [the Lab API reference](../lab/README.md) for exact arguments, snapshot fields and clock guarantees. Check readiness after loading; do not rely on arbitrary wall-clock sleeps or reach through private Phaser fields. Input injection is for controlled semantic tests, not a substitute for keyboard events or raw Gamepad API coverage.

The public API is a frozen facade and returns copies for inspection, not live runtime objects. It is not a way to modify an internal score, set arbitrary object properties, bypass a hitbox, clear storage or execute supplied code. Keep additions small, typed and tied to a real diagnostic need.

**Real browser gamepad** is the default. The Input test controls can explicitly choose a synthetic Xbox/PlayStation pad or disconnect; select real hardware again to restore the original provider. Synthetic mode is labelled in state. These options verify software mapping, not physical pairing or haptics.

Useful request:

> Reproduce the missed release in `keyboard-cornhole`. Inspect the input phase, character clip, release marker, projectile position and score transition. Save a state dump and screenshot at the failure.

## Repeatable testing

Astra runs commands from the repository. These are reference commands, not a checklist the user must execute.

| Command | Responsibility |
|---|---|
| `pnpm lab` | Launch the internal Lab at port 3010 |
| `pnpm typecheck` | TypeScript contracts, including tooling |
| `pnpm test` | Deterministic simulation, historical recording/ledger, animation/geometry and live input/mechanics checks |
| `pnpm test:browser` | Playwright scenario loading, browser input, meaningful state assertions and screenshots |
| `pnpm test:browser:visual` | Compare fixed-clock screenshots to reviewed, environment-specific pixel baselines |
| `pnpm test:browser:update` | Deliberately update reviewed visual baselines |
| `pnpm check:regression` | Run the repository's regression checks and report |
| `pnpm build` | Build and prerender the normal production app into `dist/client` |
| `pnpm test:production` | Inspect the existing production build and smoke-test Play/Watch and Lab isolation |

The browser suite uses an isolated context and local test origin. Keep the user's regular game, points, character library and controller remapping untouched. Browser installation or missing runtime prerequisites should be reported accurately; Astra should handle available setup rather than ask the user to paste commands. Browser/channel overrides and optional traces/video are documented in [the browser test guide](../tests/browser/README.md).

`check:regression` runs typecheck, pure tests, normal browser tests, a fresh production build, then the production-isolation smoke test. That final stage scans the exported app for the Lab global, exercises Play/Watch in a clean browser on its own port 3011 and checks that practice does not write saved results. It preserves the regular game on port 3001. Normal browser tests capture evidence and assert semantic state; pixel comparison remains a separate opt-in command. The aggregate report does not replace source-diff review or visual judgment.

For a fix, first reproduce the failing behavior, then exercise the repaired path and nearby boundaries. Examples: before/at/after release; held input across pause; attack startup/active/recovery; replay after a result. Preserve existing historical fixtures and outcome assertions. Do not add assertions that merely restate how the new code was written.

Screenshots complement state tests. A valid score does not prove the ball crossed the illustrated rim; zero detached pixels does not prove a natural shoulder. Inspect full-body and relevant detail views, plus normal-speed motion when motion changed. Keep seed, checkpoint, viewport, reduced-motion setting and browser details consistent across comparisons.

Do not accept a failing screenshot by immediately regenerating baselines. Astra should inspect the difference, decide whether it is a defect or an intended change, and record the reason for any baseline update. Baselines live under `tests/browser/baselines`; the ordinary suite does not silently create or approve them. A new browser/GPU can also change rasterization; that is a comparison condition, not automatic evidence of an art regression.

## Repository skills

These can be requested by ordinary language or by their exact `$skill-name` form. Astra should select the relevant one without requiring the user to memorize names.

| Skill | Example request |
|---|---|
| `$arena-visual-qa` | “Check the court, cards, figures and equipment for visual regressions.” |
| `$arena-animation-direction` | “Make Dan's recovery feel natural while preserving his art.” |
| `$arena-gameplay-testing` | “Test the score and event state transitions for this change.” |
| `$arena-input-qa` | “Check keyboard, gamepad mapping, pause and held-trigger behavior.” |
| `$arena-regression-check` | “Review this change against the working Arena.” |
| `$arena-performance-audit` | “Measure frame timing and find the expensive part.” |

The skills are repository files, so their improvements travel with the project. Update them when a repeated failure exposes a missing check, not with unrelated rules after every task. They do not grant permission to publish, delete user data or expand feature scope.

## Evidence and performance

Temporary screenshots, state dumps, Playwright reports/traces and measurements belong under ignored `work/qa/` within the repository. Curated review summaries and intentional fixtures/baselines belong in version control; use `docs/review/` for concise reviewed evidence. Large captures should remain reproducible from their named scenario instead of being copied into every commit.

A useful report names the scenario, seed, checkpoint, input sequence, expected/observed result, final revision or working-tree context, files tested and evidence paths. Report a failure explicitly rather than hide it behind the number of passing assertions.

For performance, warm up asset loading, keep browser/viewport/scenario conditions fixed, and measure actual running frames. Separate FPS and frame-time distribution from render counters such as draw calls, objects and estimated texture memory. Deterministic stepping and headless screenshots do **not** establish real-time smoothness or device capability. Compare before/after under matching conditions; do not impose a universal FPS promise based on one computer.

Synthetic controller tests establish mapping and software behavior. Physical Xbox/PlayStation/generic controllers still need a real connected-device pass for pairing, prompts, stick feel, disconnect/reconnect and optional haptics. Record that distinction in the result.

## What a finished Astra task should return

The completed task should leave a launchable local result and explain the practical change first. Include checks actually run, any remaining limitation, a usable preview and relevant screenshots/state evidence. For shared-runtime edits, include Play and Watch regression coverage. For art or motion changes, show the result rather than only describing code.

Local verification does not publish the site. Hosting is a separate requested action using the repository's Sites configuration. Current characters remain connected paper rigs; installing a library does not transform them into authored skeletal animations.

Character anatomy work also uses the Lab's **Anatomy / rig inspection** panel: actual current joints, black silhouette, mirror and court scale. Dan's setup/idle skeleton proposals are separate, unfinished authoring views. The API adds `setRigQA(options)` and a serializable `rigQA` snapshot. The user selected LoongBones for evaluation instead of Spine; see [the active compatibility gate](LOONGBONES-COMPATIBILITY.md). **Load verified editor export** opens the user's unchanged LoongBones 1.2.3 example: its textured bones and mesh deformation pass in Phaser 3.90.0, but it has no blended skin weights or release markers. **Dan · weighted rig review** is the newer Astra-authored 30-bone foundation with seven clips, foot IK and an actual release marker. Its [review and import instructions](review/dan-weighted-v1/README.md) distinguish local success from the still-required editor round trip, hidden art and full motion review. The dedicated `__HERO_DAN_RIG__` API remains Lab-only; the approved source-fit view is still static. The [earlier pipeline plan](SPINE-PRODUCTION-PIPELINE.md) retains the anatomy/source quality requirements.

For Dan's returned LoongBones export, use [the three-way rig comparison](http://127.0.0.1:3010/loongbones/dan/?sample=restored) and [the current export audit](review/dan-roundtrip-r2/README.md). The original ZIP is preserved. The editor output is playable but loses easing, idle loops and a knee constraint setting; the explicitly derived Arena restoration passes motion comparison. Future exports must be checked for these losses before integration. Do not label the restored file as unchanged editor output or overwrite edited keys to force parity.

Useful final instruction for a new task:

> Complete the change, launch the result, run relevant automated and browser tests, exercise it in Arena Lab, review regressions, and show me the result with any remaining limitations.

For a motion-reference demonstration, open **Human Motion V2**, click **Load measured reference demo**, and enable **Retarget proposal on Dan**. **Export Dan motion proposal** downloads a timed skeleton proposal. Tell Astra which action to adapt and attach a real video; Astra handles analysis, retarget review, native clip authoring and regression tests. A proposed skeleton is not yet approved character animation.

For performance review, use **Organic performance**, choose **Review character / Review action**, and press **Load take**. Review the raw motion at arena scale and in a close view, then inspect **Evaluated joint motion curves**. Ask Astra to compare weight transfer, release and recovery against an uploaded video. See [the organic workflow](ORGANIC-PERFORMANCE.md). The source-only comparison toggle is diagnostic; it does not install or revert production animations.
