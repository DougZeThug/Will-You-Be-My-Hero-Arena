# Character performance rebuild and continuation

## Current pass — readable finish and settled recovery

Runtime: `cornhole-finish-settle-v1`. Normal cornhole Watch now retains a
softened directed finish through the landing and staggers arm relaxation and
body recovery. Existing preparation/release keys, wrist surfaces, chest taps,
native adapter, recording authority and automatic game flow are preserved.
Doug and Dan share the compiler while keeping distinct source-profile timing.

Tune at <http://127.0.0.1:3020/performance/>. Reviewed defaults live in
`lib/arena/engine/performance/profiles/{doug,dan}.json`. Export/reload in the Lab;
promote with `pnpm motion:apply-profile <candidate.json>`, then rebuild for the
normal match. `pnpm review:cornhole-turn` builds and captures both controlled
motion and the real selection-to-results journey in isolated browser contexts.

See [the focused handoff](review/cornhole-turn-settle/README.md) for launch
commands, baseline/checkpoint details, evidence, ownership, verification and
the next bounded audit: visible impact versus the existing LANDING cue.
Earlier passes and their source assets remain below.

## Pass 4 follow-up — connected skin surfaces

The wrist seam was material registration and overlap, rather than a detached
anatomical joint. The grip, open and relaxed drawings included a short forearm
stub rigidly weighted to the palm. During Doug's chest contacts it turned into a
visible hanging cuff. Its cut edge also drew over the continuous forearm.

`lab/performance/HandMaterialRegistration.ts` now registers that proximal skin
to the forearm and bends a short transition into the existing hand. The release
drawing uses a weighted mesh with the same pixels and distal finger shape.
`LoongBonesAdapter.ts` places this overlap beneath the forearm and blends only
the internal forearm cut into the opaque skin beneath it. Whole hand exposures
still switch opaquely; this is not a dissolve between finger drawings.

Bones, limb lengths, original exports, atlas pixels, release/contact sockets,
motion curves and recorded outcomes/times are unchanged. The derived geometry
is checked against the existing 16-bit native export budget. Live Play and other
sports keep their existing providers.

Review `work/qa/body-seams/review.html` for normal-speed full-figure/wrist detail,
matched close-up stills and the updated eight-bag recorded Watch. Full-body
inspection includes the neck, shoulders, elbows, opposite wrist, clothing/leg
joins and feet through preparation, release, chest contacts and recovery.
The browser suite checks opaque near-arm joint pixels, painted cuff placement,
underlap order, existing shoulder/clothing material, anatomy and planted soles.
Far-side bone centers are partly occluded projection landmarks; requiring those
centers to be opaque pixels is not a valid material-continuity test.

Final validation: 138 browser tests passed, with one optional approved-pixel
baseline comparison skipped. All 170,734 simulation/animation checks,
typechecking, the production build and the production isolation smoke passed.
Production Play and Watch loaded without page errors, Lab globals or practice
save writes. Matched poses have zero joint drift and identical event times.
Full evidence is recorded in `work/qa/body-seams/verification.json`.

## Current continuation pass — pass 4

Runtime: `cornhole-pose-pass4`. Pass 3 source and pose captures are preserved in
`work/qa/pass4/baseline/`. Continue using the same recipe, compiler, controller,
native adapter and recorded Watch integration.

- **Stance:** the far-leg IK branch previously bent backward as the pelvis
  lowered, bringing the two knees together. Both knees now bend toward the
  rightward lane. The original foot targets, limb lengths, mesh registration and
  artwork stay intact. This is a runtime constraint correction, not a new export.
- **Transfer:** a modest deeper load precedes the forward pelvis transfer;
  release has enough knee softness to keep the rear support reachable. The
  non-throwing arm provides a small independently timed counterbalance. The
  supported finish retains Pass 3's throwing arm, hand exposure and relaxation.
- **Between turns:** profiles now describe relaxed weight placement, knee
  softness and attention lean. Three short base poses cover opponent preparation,
  flight and a quiet acknowledgment. They use the existing character clock and
  yield to every action-layer preparation, throw and authored reaction. One
  acknowledgment is eligible after the opponent's first revealed hole, with a
  280 ms delay; it is covered when an own action needs priority.
- **Attention:** the event's lane-space path and the opponent's board provide an
  approximate shared-play target. Small head/neck pitch and posture express
  attention within the one authored viewing direction. This is not eye tracking
  or a new facing-angle drawing.
- **Contact checks:** ankle, heel and toe checks remain. Opaque painted sole
  vertices are now sampled too. Both projected knee bend directions are checked
  throughout a complete throw; no limb-length or foot tolerance was relaxed.
  The native-clock diagnostic now compares loop phases across the duration/zero
  boundary correctly, while retaining the same drift threshold.

Review `work/qa/pass4/review.html` for six-pose before/after sheets and silhouettes,
a brief inactive-player comparison, and an uninterrupted normal-speed recording
with the game filling the video. The two production captures use the exact same
immutable eight-bag recording stored in `match-recording.json` (Dan 3–Doug 5),
through ordinary Watch controls in isolated QA storage. This new matched pair
supplements the preserved Pass 3 review movie. Original exports and the corrective
Pass 3 hand drawings are unchanged. No new artwork or editor round-trip was needed.

Final aggregate validation passed: TypeScript, 170,734 deterministic checks,
137 browser tests, the production build and clean-browser Play/Watch isolation.
The opt-in approved-pixel comparison is the single skipped browser test; the new
pose sheets and continuous captures were reviewed directly. The 33-second match
includes the final two chest contacts and return to rest. Media decoding/playback
and the preserved Pass 3 hand-asset hashes also passed. Full results are in
`work/qa/pass4/verification.json`.

Limits remain fixed facial art, one authored body view and discrete hand
exposures. Live Play and other sports retain their existing animation.

Main Pass 4 files:

- `lib/arena/engine/performance/BodyMechanics.ts` and
  `lab/performance/compile.ts`: coordinated support poses and waiting clips.
- `lib/arena/engine/performance/PerformanceProfiles.ts`, `PerformanceTypes.ts`
  and `CharacterPerformanceController.ts`: character-specific rest/attention and
  existing base-layer observation, subordinate to committed actions.
- `lab/performance/LoongBonesAdapter.ts`: knee branch, painted sole diagnostics
  and loop-phase comparison.
- `lib/arena/engine/events/cornhole/CornholePerformancePlayback.ts` and
  `lib/arena/engine/scenes/ArenaScene.ts`: deterministic opponent context on the
  existing recorded clock.
- `tests/character-performance.test.mjs`,
  `tests/browser/character-performance.spec.ts`,
  `tests/browser/cornhole-performance-game.spec.ts` and
  `scripts/production-smoke.mjs`: lifecycle, anatomy, contact, waiting priority,
  seek and built-player coverage.

## Pass 3 continuation (historical)

Runtime: `cornhole-pose-pass3`. The current pass-2 AFTER implementation was
captured before editing and is preserved under `work/qa/pass3/baseline/`, together
with its source snapshot. The older sections below describe earlier passes.

### Visible changes

- The forward swing uses less elbow curl and a lower release pose. Doug retains
  his compact finish; Dan retains his slower tempo and higher follow-through.
  Existing torso transfer, support posture, limb lengths and foot constraints
  remain. This pass does not increase the whole body's motion amplitudes.
- One corrective release-hand drawing per character replaces the broad open-palm
  presentation around release. It appears 70 ms before detachment and continues
  through the first 320 ms afterward. Grip, chest-contact palm and relaxed hand
  remain separate opaque exposures. The new images are registered to the existing
  wrist; Doug's corrected 684-vertex arm registration is unchanged.
- The held bag draws in front of the torso and beneath the fingers. It retains
  that order until clear of the moving hand, including after direct seeking.
  Position, size and orientation remain continuous when detaching and changing
  layers. Its thinner release view eases toward the board plane before contact;
  the existing front-lip mask and persistent board bags remain.
- The arm progressively relaxes during flight while forward support and attention
  remain. Response clips now use their authored durations instead of an extra
  fixed 0.6-second beat. Doug approaches the first tap sooner, withdraws between
  both contacts, and relaxes out of the gesture. Dan has a readable downward nod
  followed by recovery, without deforming the fixed face artwork.

| Time after result confirmation | Pass 2 | Pass 3 |
| --- | ---: | ---: |
| Doug: gesture starts | 0.82 s | 0.41 s |
| Doug: first chest contact | 1.32 s | 0.78 s |
| Dan: nod starts | 0.94 s | 0.52 s |

### Artwork and evidence

`lab/performance/assets/` preserves the two complete ImageGen outputs and the
runtime crops. `node scripts/author-release-hands.mjs` reproduces the crops;
`ReleaseHands.ts` records wrist registration and uniform artwork scale. Original
character exports were not overwritten. Re-running the crop script reproduced
both runtime PNGs byte-for-byte. No editor round-trip was performed.

Review `work/qa/pass3/review.html`: separate labeled Doug/Dan before/after videos,
close release clips, short result/reaction/recovery clips and actual production
Watch footage. Both comparison takes use `performance-lab:1`, the same recorded
hole outcome, camera and scale. Videos run at 1×. Small head/tail holds align
release; the measured offsets are disclosed in the clips and
`comparison-alignment.json`. Alignment is estimated from media and simulation
timestamps; neither take is time-warped. Final release and reaction sheets are in
`work/qa/pass3/revised/`.

### Verification

- Final TypeScript, targeted lint, production build and clean-browser Play/Watch
  smoke passed. Built Watch reports `cornhole-pose-pass3`; 21 inspected built
  files contain no Lab debug globals. Live Play retains its existing animation.
  The full production Watch capture completed all eight throws through ordinary
  Exhibition controls, Dan 3–Doug 6, with no page errors.
- Full browser run: 135 passed, one optional pixel-baseline test skipped, one
  strict projectile-coordinate failure. The new snapshot's unnecessary float32
  conversion lost 0.000009 px on an unparented projectile. Full-precision values
  were restored, with the existing strict assertion unchanged. All 10 affected
  release, anatomy, exposure, seek and repeated-match checks then passed. The
  initial run also caught a type annotation in the new test; final typecheck is
  clean. Raw initial and final reports are preserved under `work/qa/pass3/`.
  `verification.json` combines the full run and the successful final rechecks;
  the initial aggregate report remains unchanged for audit.
- 170,729 simulation/animation checks passed. The actual compiled performance
  clips also passed 100 seeded matches / 800 throws using the timing probe,
  without committed-action overlap, missing releases or recording mutation.
- Both final 1× captures have 16.7 ms local frame p95, no page errors and no rig
  warnings. Normal-speed comparisons and close release/reaction frames were
  visually reviewed. Numerical checks supplement that review.
- Saved release/contact times, results, scores, attempt order and persistence
  formats are unchanged. The recorded playback coordinator is byte-identical to
  the pass-2 baseline. No other sport or live animation was upgraded.

Limits: fixed facial art, one authored body view and discrete hand drawings remain.
The correction does not provide independent finger animation or eye tracking.

## Pass 2 continuation (historical)

The continuation uses the existing controller, graph, native adapter and pose
compiler. The visible restraint came from small pelvis/spine amplitudes and
underhand channels returning to zero before watch. Partial watch/reaction clips
then allowed native defaults to restore a resting silhouette. Neither an idle
overwrite nor a second tween writer caused it.

The shared recipe now includes coordinated loading, knee softness, torso drive,
counterbalance and a retained forward support posture. Watch, response, gesture
and recovery compile whole-body poses through the same path. Doug's two short
chest-relative contacts have a withdrawal between them; only hole results trigger
his signature gesture. Dan keeps a smaller load, slower tempo, higher follow-through
and restrained nod. Source art and rig lengths are preserved.

Recorded cornhole Watch now installs the same runtime through the existing
`CharacterRigProvider` boundary. `ArenaScene` presents immutable attempts using
`CornholePerformancePlayback`; preparation is timed backward from each saved
release. Continuous playback retains native states, and explicit seeking silently
reconstructs them. Live Play and other sports keep their existing adapters.
The new provider is production content; the Lab scene and debug globals are not.
Runtime identifier: `cornhole-pose-pass2`.

Held bags draw beneath the hand and inherit lane scale at detachment. The existing
recorded-flight presenter retains contact and scoring facts. Hole entries descend
behind a registered front-lip mask rather than fading above the board; board bags
remain visible. No simulation, score, recording or persistence schema changed.

Review: `http://127.0.0.1:3020/performance/` and the actual game scene at
`http://127.0.0.1:3020/?scenario=cornhole-performance`. Evidence is under
`work/qa/continuation/`, including the preserved pre-edit capture and evenly sampled
before/after sheets. The sections below record the original rebuild assessment
and first-pass verification; their opt-in status describes that earlier pass.

Limits remain the fixed facial art, three hand exposures and a single authored
view. Corrected mesh registration and new native motion are runtime derivatives;
an editor round-trip has not been verified. This installation covers recorded
Dan/Doug cornhole, not live Play or additional sports.

### Continuation verification

- `pnpm check:regression`: passed TypeScript, 170,729 simulation/animation checks,
  135 browser tests (one opt-in pixel-baseline test skipped), production build and
  clean-browser Play/Watch smoke. The built Watch canvas reports
  `cornhole-pose-pass2`; 21 built files contain no Lab debug globals.
- Focused browser coverage samples 480 frames per character, exact hand/scale
  release, retained watch posture, board persistence, outcome-specific reactions,
  repeated actions, pause/speed changes, seeking and a complete recorded match.
- An additional timing probe used the actual compiled clips/controller with a
  synthetic socket over 100 seeded matches / 800 throws. It found no committed
  action overlaps, missing releases or recording mutations. Rendered anatomy is
  covered separately by browser checks and visual review.
- Preserved baseline and revised recordings use `performance-lab:1` for both
  characters. Final normal-speed capture: no page errors or rig warnings, local
  frame p95 16.7 ms for each. Half-speed capture also completed without warnings.
- Reviewed the evenly sampled whole-body sheets, individual chest-contact and
  hole-entry frames, extracted before/after video frames, actual game scene and
  built Watch screenshot. Evidence: `work/qa/continuation/normal-speed-comparison.webm`,
  `revised/doug-sheet.png`, `revised/dan-sheet.png`, `revised/doug-chest-contact.png`,
  `revised/bag-contact-and-hole.png`, `revised/capture-report.json` and `regression.log`.

The active worktree is `C:/Users/Doug/Documents/Codex/.pnpm-store/v11/arena-performance`
on `codex/character-performance`, still based on checkpoint `324c960`. Launch the
Lab with `node node_modules/vite/bin/vite.js --config lab/vite.config.ts --port 3020`.
The verified built player is served at `http://127.0.0.1:3022/` using
`$env:PORT='3022'; node scripts/serve.mjs`. Choose **Watch**, then **Set up showdown**
and **Start showdown** for recorded cornhole. Source art, rules, saved data formats,
package manifests and lockfile remain unchanged; the original checkout is clean.

## Starting assessment

Base: `324c960`, clean `main`, captured before this rebuild. Work is isolated on
`codex/character-performance`; the checkpoint and original files are preserved.
Baseline production build passed; the side-v3 Doug throw was inspected in the running Lab.

The application is React + Phaser 3.90. Recorded Watch uses `BattleDirector`,
`CharacterController` and a single playback clock. Live practice uses `ArenaSession`,
semantic input and `AnimationComponent`. These rules, recordings and persistence are
independent of the experimental LoongBones provider and must retain their behavior.

The current weighted cornhole path loads hash-checked side-v3 assets via
`weightedMatchProvider`. `WeightedMatchRig` resets/recreates native states on each
absolute sample; its blends also recreate states. `CharacterController.throw` owns
ritual/throw/reaction timing and can replace an unfinished follow-through on result.
Release is sampled separately and cached from authored marker timing. Effects/audio
come from director crossings, not raw bones; there are no GSAP game tweens to remove.
Leg IK is authored in the rig. The isolated review scene only plays individual clips.

The separate Human Motion experiments already supply reusable `AnimationGraph`,
`AttachmentManager`, semantic skeleton validation, shape-preserving curves, contact
envelopes and limb-registration math. Reuse these foundations. Do not introduce a
second scheduler, a dependency, or a replacement skeletal runtime.

Doug's side rig uses a nearly collinear three-point affine artwork registration.
That can enlarge transverse arm width even with bone scales equal to one. The
Human Motion path already has a segment-uniform registration utility, but the
weighted cornhole path does not apply it. Correct bind registration in the new
adapter, not per-frame arm scale. Preserve source textures and original exports.

## Intended boundary

Event/rules → semantic performance request/result → character controller → shared
animation graph + choreography + attachment history → animation runtime contract
→ LoongBones adapter → native bones, IK, meshes and opaque hand exposures.

The controller owns action lifecycle, result perception, queues, interruption,
completion, and release. Events own projectiles/contact/results. Presentation
subscribes to performance events. The Lab uses the real adapter, controller,
artwork and recorded projectile presenter. No score/persistence writes are permitted from it.

## Implemented architecture

`lib/arena/engine/performance/` contains the runtime-independent controller,
transition rules, semantic choreography, validated character profiles and shared
underhand body recipe. It reuses the existing `AnimationGraph` and
`AttachmentManager`; no external animation scheduler or new dependency was added.

```ts
const id = character.perform('cornholeThrow', {
  objectId: 'bag-7',
  target: board.anchor,
  onComplete: (outcome) => finishPresentation(outcome),
});
// The event resolves the result; animation never invents a score.
character.confirmResult(id, successful);
```

`perform` returns an action id or `null` when rejected. Actions carry priorities;
an eight-entry bounded queue preserves non-interruptible athletic motion. A
higher-priority action can interrupt notice, settle, watching or recovery. Release,
drive and the signature gesture finish their committed motion. Reentrant completion
callbacks enqueue their next action safely. Reset/destroy cancel pending callbacks,
detach equipment and release native resources. Invalid profiles, clip durations,
marker times and duplicate release markers fail early. Unknown actions are rejected
without disrupting the current action. Missing clips cancel to living idle. Missing
results recover after an eight-second watch timeout without inventing a celebration.

One monotonic clock advances graph states, native blends, attachment samples and
event crossings. Steps split at authored markers, phase edges, segment endings and
result perception. This preserves event times across large and small update steps.
`OBJECT_RELEASED` fires only after evaluating the exact marker pose and sampling its
hand history. The release includes world position, orientation, velocity and angular
velocity. A semantic `equipmentRelease` marker works for any registered object
action; the controller does not test a sport or native clip name to launch it.

`CornholePerformancePlayback` is the opt-in recorded event integration. It requests
the complete action, listens for release, and passes that frame to the existing
`releasedBag` presenter. It supplies the immutable contact result back to the
character. The full athletic take reaches follow-through/recovery before the
controller starts its result-aware reaction. `PerformanceFeedback` subscribes
separately for restrained camera, particles and optional sound. Seeking rebuilds
and replays the local scenario silently; no old sound/effect backlog is emitted.

## LoongBones and anatomy

`lab/performance/LoongBonesAdapter.ts` implements `CharacterAnimationRuntime`.
Native animation states persist across ticks and play during crossfades. Reset is
reserved for explicit reset/disposal. The adapter owns semantic bone mapping, native
constraints, full-ancestor wrist/head compensation, target tracking and discrete hand
exposures. Game/event modules do not access its armature or bones.

Doug's arm uses the existing segment-uniform bind-registration utility. It corrects
684 mesh vertices from source UVs before parsing; textures, skeleton lengths and
original exports remain intact. It does not scale the arm during animation. Tests
sample actual evaluated upper-arm/forearm lengths and transverse mesh-edge widths.
Both characters retain native leg IK and invariant foot transforms. Runtime guards
bound local shoulder, elbow, wrist and torso channels and reject non-finite evaluated
coordinates. Debug measurements report actual limb scales, material widths, foot
anchor drift, graph/native clock agreement and chest-contact error.

Doug's chest tap reuses the existing full-body semantic gesture with two short
contact pulses. A bounded native two-bone IK constraint brings the palm to a moving
chest target, then releases it for rebound and recovery. The gesture includes the
torso, clavicle, head and opposite-arm response. Hand drawings switch opaquely;
they do not dissolve overlapping fingers.

## Shared motion and personality

Both Doug and Dan compile the same `underhandMechanics` recipe. Loading, pelvis
transfer, spine/chest drive, shoulder lead, elbow absorption, palm presentation,
counterbalance and recovery have independently timed curves. The profile changes
tempo, stance, posture, confidence, backswing, release lift, follow-through,
weight transfer, reaction strength, idle energy and result perception.

Doug uses a compact flat release and chest tap after success. Dan has a slower
tempo, higher release, longer follow-through and restrained nod. There is no second
copied throw implementation. Generic gestures and recipes remain separate from
event scoring. A future event can supply additional action recipes through the
controller's optional action registry and a matching runtime clip library; the
semantic release lifecycle is already tested with a separate overhand action id.

## Animation Lab

Run the normal Lab command on a free local port. This worktree's preview uses
`http://127.0.0.1:3020/performance/`. The main Lab links to **Character Performance
Lab · Doug / Dan**. Normal production routes do not import the scene or debug API.

Controls include character, semantic action, successful/missed recorded take,
play, pause, restart, loop, one-frame advance, 0.25×/0.5×/1×/2× speed, state
checkpoints, timeline seeking, close view, skeleton/IK targets, names, attachments,
foot anchors, bounds, silhouette, optional sound, event history and editable profile
JSON. Invalid profile edits preserve the current working take. Defaults reload
without editing files. State, requested action, layers and diagnostic values are
available in the snapshot panel and frozen `window.__HERO_PERFORMANCE__` facade.

The Lab selects an actual hole or miss from a deterministically simulated recording
for the chosen character. It never edits a resolved score to force a gesture.
Snapshots retain seed, attempt id, profile and runtime mode. Temporary reviewed
frames, video and reports live in `work/qa/performance-review/`.

## Retired in the new path / preserved references

The new path replaces per-frame native reset/recreation, separately authored Doug
and Dan throw arrays, raw event-to-clip timing and direct result-to-reaction snaps.
It composes complete performances through the shared controller. Old weighted clip
reviewers, Human Motion experiments and production Play/Watch remain runnable
comparison/migration references. Their classes and original files were not deleted.
The rebuild is opt-in and stays isolated pending review.

## Verification

- TypeScript and focused lint pass. The simulation/animation suite passes
  170,729 checks, including 41 new performance lifecycle/release checks.
- The broad browser run passed 128 tests, skipped one opt-in pixel-baseline test,
  and initially failed five checks: three needed ignored local reference videos
  copied into the fresh worktree; two were interrupted by development reloads.
  All five passed in the stable-source retry (10 tests passed). The final three
  new performance tests passed again after test typing was tightened. The original
  aggregate report is retained with its initial failure status, not rewritten.
- Dense browser sampling covers 480 frames each for Doug and Dan. It verifies
  bounded anatomy, planted feet, chest contact, opaque hand exposure, native/graph
  clock agreement, exact hand-to-projectile release and completion to idle.
- Production build/prerender and clean-browser Play/Watch smoke checks pass.
  Eighteen built files were scanned for Lab API leakage. Practice storage remains
  unchanged. Scoring, assets, manifests and lockfiles have no changes.
- Both full actions were played in real time and recorded through Chrome's canvas
  recorder. There were no page errors or rig warnings; frame p95 was approximately
  18 ms for each character during capture. This is a local desktop observation.
  Close views of windup, release, follow-through, gesture and recovery were reviewed.
- Evidence is in ignored `work/qa/`: `performance-review/review.json`,
  `performance-review/performance-review.webm`, phase PNGs,
  `performance-regression.log`, `performance-retry.log`,
  `performance-browser-final.log` and `production/report.json`.

## Limits and next step

- The new performance controller is integrated into the recorded cornhole vertical
  slice, not installed across production Play/Watch or every sport.
- Recorded bag flight retains the existing acceleration constrained to immutable
  contact. This is recorded presentation, not a new unconstrained physics solver.
- Feet are planted for this slice. The existing locomotion motor and gait library
  remain the foundation for future approach/walk/jog recipes.
- Current drawings offer three hand exposures, one viewing direction and fixed
  facial art. There are no independent finger/eye bones or new hidden surfaces.
- The displayed mass point is a torso/pelvis visual proxy. Foot diagnostics measure
  anatomical anchors, not a force plate or full shoe-contact simulation.
- Generated native motion and corrected bind registration are runtime derivatives;
  they have not been returned through the LoongBones editor.

Highest-value next task: after reviewing this slice, migrate the main recorded
cornhole adapter to this controller with a versioned performance snapshot, preserving
historical recording timings/results and the comparison inspector.
