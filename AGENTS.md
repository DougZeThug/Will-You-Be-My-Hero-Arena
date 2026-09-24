# Arena engineering router

This repository is **Will You Be My Hero? Arena**, a React application with a
reusable Phaser 2D game engine. Work from the repository root (the directory
containing this file and `package.json`). Inspect `git status` and the relevant
imports before editing; preserve unrelated local work. Follow
[`docs/GIT-WORKFLOW.md`](docs/GIT-WORKFLOW.md) for checkpoints or worktrees and
[`docs/AI-DEVELOPMENT-WORKFLOW.md`](docs/AI-DEVELOPMENT-WORKFLOW.md) for Lab and
test usage.

## Route work to the current runtime

For recorded-cornhole character performance, start with
[`docs/ANIMATION-HANDOFF.md`](docs/ANIMATION-HANDOFF.md). The normal Watch entry
is `components/arena/ArenaStage.tsx`; cornhole dynamically injects
`lab/performance/provider.ts`, which composes
`CharacterPerformanceController` with `lab/performance/LoongBonesAdapter.ts`
and the side-view-v3 assets. The matching review surfaces are `/performance/`
and the `cornhole-performance` Lab scenario. Use these paths for routine Dan or
Doug recorded-cornhole animation work.

Play **running and fighting** for Dan and Doug run on the side-view rig
through `lab/human-motion/provider.ts` → `PlayMotionRig` (the Human Motion
native animator driven from the live simulation's body). Which drawn angle
faces the camera (profile rig or front cut-out, with a paper-flip turn) is
chosen by `lib/arena/engine/characters/CharacterView.ts`. See the handoff
section on both before changing them.

Do **not** route that work to:

- `character-doug` or `character-dan`: legacy connected-paper clip previews.
- `cornhole-recorded`: the earlier weighted-rig comparison, not the normal
  Watch performance installation.
- Human Motion V2/V3 scenes: experimental multi-event research, not Watch.
  Play tuning belongs in `PlayMotionRig`; keep the Lab proofs' defaults.
- other recorded Watch sports: separate providers/contracts that must not be
  migrated incidentally (planned next in
  [`docs/ANIMATION-ROADMAP.md`](docs/ANIMATION-ROADMAP.md)).

Historical constraints, asset provenance, and completed-pass evidence remain
in [`docs/CHARACTER-PERFORMANCE.md`](docs/CHARACTER-PERFORMANCE.md) and its
linked review documents. Consult the specific document relevant to the code
being changed; do not treat every historical review as required reading.

## Architecture and gameplay boundaries

- React owns menus, accessible HUD, persistence, and results. Phaser owns the
  competition canvas, character rendering, equipment, cameras, and effects.
- **Watch** replays immutable pre-simulated recordings through `ArenaGame` and
  `BattleDirector`. **Play** runs fixed-step interactive practice through
  `LiveArenaGame` and `ArenaSession`. Pause, seek, speed, replay, resize, or a
  visual change must not resimulate a winner or award points again.
- The semantic input path is device → intent → controller → event action map →
  entity/components → event rules → animation markers → presentation. Physical
  codes stay in adapters; event rules own mechanics and scoring.
- Keep simulation and geometry testable without Phaser or browser globals. Add
  sports through `EventRegistry`; do not add global sport switches.
- Live practice and Lab never change club points, entry allowances, saved
  matches, or installed characters. Preserve deterministic seeds, versioned
  historical recordings, authoritative contact scoring, and idempotent awards.
- Run browser tests in isolated contexts/origins. Never clear or seed the
  user's regular browser storage. Keep Lab globals out of the production app.

## Art, motion, and provenance invariants

- Preserve the approved printed-sunset backyard-sports direction, original
  collectible cards, likenesses, clothing, and source files unless the user
  explicitly requests art changes. Dan and Doug are both 5'8"; apply lane depth
  uniformly to rig, feet, sockets, shadows, and release velocity.
- Keep feet grounded, soft court shadows, correct equipment registration, and
  the horizontal cornhole layout. Grounded means supporting feet never slide or
  sink; real sport footwork (jumps, steps, strides) is expected. Objects remain
  attached to the evaluated hand until the semantic release marker.
- Approved style: between NBA Jam and a Saturday-morning cartoon, leaning
  cartoon, on real sport mechanics. Squash and stretch is stateless and applied
  only at the root/actor scale (never bones, limb lengths or face art) and
  returns exactly to rest. Watch effects are presentation-only; hit-stop is
  Play-only and holds the clock without dropping input.
- Draw each character from the angle that faces the camera (profile for
  travel and exchanges across the screen, front for camera-facing beats).
  Side-view rigs mirror the simulation; they never own position or results.
- Preserve connected anatomy, opaque hand exposures, sleeve/torso material
  ownership, palm and foot registration, bounded IK, and semantic markers.
  Passing numeric checks is not proof of natural motion; inspect the rendered
  action at normal speed and around release/contact/recovery.
- Current cornhole side-view rigs are Arena-authored LoongBones import assets,
  not verified unchanged editor round trips. Preserve hashes and provenance;
  do not claim unseen poses, measured motion, production-wide installation, or
  editor verification. Spine is historical and must not be activated.
- Keep original exports and artwork byte-preserved. Derived bind, geometry, or
  hand-registration fixes must remain explicitly identified as derived.

Detailed durable constraints live in
[`docs/CHARACTER-PERFORMANCE.md`](docs/CHARACTER-PERFORMANCE.md),
[`docs/review/cornhole-side-v3/README.md`](docs/review/cornhole-side-v3/README.md),
and [`docs/LOONGBONES-COMPATIBILITY.md`](docs/LOONGBONES-COMPATIBILITY.md).
Human Motion work follows its own linked review contracts.

## Working and validation policy

Routine bounded local source edits, profile edits, isolated captures, and
disposable-fixture tests are authorized within the boundaries above; do not ask
for repeated approval. Do not publish, deploy, rewrite history, delete user
data, change protected art, or broaden a runtime migration without an explicit
request.

Use the smallest relevant checks while iterating. Documentation-only routing
changes do not require the full runtime suite. Runtime changes should normally
run `pnpm typecheck`, `pnpm test`, `pnpm build`, relevant browser scenarios, and
`pnpm check:regression` when its aggregate scope is warranted. Report checks
not run and why. Visual or animation changes require a real browser review and
continuous-motion evidence; do not update pixel baselines merely to silence a
failure. Store disposable evidence under ignored `work/qa/` and curated,
intentional evidence under `docs/review/`.

## Code map

| Area | Source |
|---|---|
| React / player bridges | `components/arena/`, `app/` |
| Watch / Live cores | `lib/arena/engine/core/` |
| Current cornhole performance | `lib/arena/engine/performance/`, `lab/performance/` |
| Play running/fighting side rig, views | `lab/human-motion/PlayMotionRig.ts`, `lib/arena/engine/characters/CharacterView.ts` |
| Event rules | `lib/arena/engine/events/` |
| Input/controllers | `lib/arena/engine/input/`, `lib/arena/engine/controllers/` |
| Character systems | `lib/arena/engine/characters/` |
| Lab scenarios | `lab/scenarios.ts`, `lab/LabRuntime.ts` |
| Tests | `tests/`, `tests/browser/` |
| Repeatable workflows | `.agents/skills/` |
