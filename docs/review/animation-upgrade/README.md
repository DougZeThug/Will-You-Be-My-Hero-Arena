# Arena animation upgrade

This review implements the defects identified in the supplied 94.059-second Arena recording. Open `index.html` for actual before/after captures, or `/human-motion/` in Arena Lab for the interactive implementation. The original project artwork and returned editor exports remain preserved.

## What changed

| Area | Confirmed cause / repair |
| --- | --- |
| Thin far arm | The body atlas supplied a narrow, partly hidden far-arm edge, with mixed torso/limb weights. It was being exposed by overhead IK. A complete isolated arm drawing is now registered to the far shoulder/elbow/wrist and rendered behind the torso. Its proximal cap extends underneath the shoulder. A small chest-bound underlay from the existing shirt drawing closes the separate sleeve/torso seam revealed by the final overhead silhouette. Both arms now have actual mesh-width diagnostics. |
| Basketball | A post-processing pass moved arm key times without moving the release marker. One authored timeline now owns gather, takeoff, extension, release, finger exposure, sustained overhead finish and recovery. Release occurs during moving elbow extension. Flight retains sampled hand velocity and fixed gravity. |
| Hand drawings | Added a true fist, cupped support hand and chest-contact palm alongside existing relaxed, bag-grip and open-release drawings. Wrist-crease registration, discrete opaque exposures, and explicit ownership prevent ghost fingers and stale attachments after transitions. |
| Running | Removed the forward bias/limited amplitude in shoulder retargeting; increased opposing shoulder motion and allowed the trailing elbow to unfold. Existing measured gait timing, world foot locks, stride fitting and toe recovery remain in use. |
| Cornhole | Widened the projected stance and increased pelvis transfer/loading with independently delayed torso channels. Doug has a more expressive transfer than Dan. No scoring or historical recording changes. |
| Chest tap | A chest-relative target with a separate native IK target drives two short contact envelopes. Each approach releases into a rebound; chest response follows contact. Interruption clears contact state. |
| Bag flip | Preserves the existing airborne rotation. A cupped receiving hand and delayed forearm absorption clarify the catch. Interrupted cosmetic tosses now clear their flight instead of remaining frozen after their catch marker is cancelled. |
| Combat | Complete far-arm material permits a two-hand guard. Closed fists distinguish strikes; the receiver recoils promptly with delayed head response. Existing reach/hitbox rules remain authoritative. |

## Runtime architecture

The installed engine remains Phaser 3.90.0. LoongBones/DragonBones 5.5-format exports run through DragonBones runtime 5.7.000, pinned at revision `64b6c69ae35777c2404be68c9192e2c56906079e`, and Arena's native Phaser mesh adapter. LoongBones editor 1.2.3 is the existing interchange target. No engine replacement, new state-machine dependency, paid mocap service, or invented editor API was added.

`MotionSession` retains a fixed 120 Hz proof simulation. Within each step it ends pose evaluation precisely at semantic markers. The order is controller intent, motor/graph, authored pose and overlays, constraints, final sockets, marker consumers and prop physics. Newly released projectiles do not receive the time interval that preceded release. Positive-time native advancement has one owner; additional zero-time evaluations solve constraints without advancing animation time.

`AnimationGraph` gives events an action revision and cycle/marker identity. Repeated actions get new identities. Backward stepping is rejected; seeking resets/replays a fresh isolated session. Manual stepping accumulates fractional durations instead of rounding every small request upward. Tests compare 30, 60, 120 and 240 Hz schedules and dropped-frame schedules.

The existing `MotionPlanner`, `FootLock`, `AttachmentManager`, `OrganicMotion`, measured reference files, inertial recovery and game input adapters are reused. Secondary motion remains bounded and can be disabled; reduced-motion preference disables the organic layer.

The workshop now supports an in-page timeline scrub, a selectable loop interval, neutral background, separate scene/clip clocks, saved playback settings, and optional event sounds from Arena's existing cue bank. Looping and backward seeking reconstruct the isolated scene before replaying it. Manual stepping is silent. These are procedural review tones, not a newly recorded sound library. Detailed measurement panels refresh at 2 Hz during playback while the clock and game continue updating normally; paused inspection remains exact. Hidden trails no longer require copying their whole history on each rendered frame.

## Editable assets

`lab/human-motion/assets/upgrade-v1/{dan,doug}/` contains generated editor import material: skeleton, one packed PNG/atlas, and semantic authoring metadata. The hand exposure schedule is compiled into native slot timelines. `scripts/export-animation-upgrade.mjs` reproduces these files from the actual runtime authoring modules.

The new hand source is `lab/human-motion/assets/hands/hand-sheet-v1.png`. It was generated once with built-in ImageGen; its exact prompt is alongside it. The fist UVs are reflected to correct its generated handedness. The original character drawings, clothing, faces and source atlases are unchanged. The packed atlas copies source materials into texture regions; it does not paint a new character.

These are **Arena-authored derived imports**, not returned LoongBones editor exports. `editorRoundTripVerified` and `productionInstalled` remain false. Runtime foot support, chest-contact IK weights and procedural secondary motion are adapters; an editor preview alone will not reproduce those world-space constraints.

Before production promotion, import each pack into LoongBones 1.2.3, verify mesh selection/edges, opaque hand changes, full overhead and guard poses, export again, and compare bone parents, bind matrices, weights, animation durations/curves/loop flags, constraints, slot exposure and semantic release markers. Preserve the returned files separately. The earlier Dan round trip is known to lose easing, loops, knee direction and release-bone association; do not label a restored export as unchanged editor output.

## Validation and scope

The implementation is reviewable in the existing four-event LoongBones workshop. It has not been published or installed over the production Play/Watch character providers. That promotion remains gated by the project's editor-interchange and integration requirements.

The focused checks cover arm width, exactly one visible near-hand drawing, sampled release continuity, an overhead finish after release, gesture cleanup, fractional stepping and deterministic replay. The existing input, simulation, rig, replay and production-isolation checks are also run. Final results and any reruns are recorded in `validation.json` rather than inferred from screenshots.

The browser audit covers 119 distinct passing checks across the full pass and targeted reruns; one opt-in approved-image-baseline check was skipped. The initial pass had ten failures: two reload interruptions during editing, one timeout under concurrent capture load, three missing reference-video fixtures in the isolated copy, two old release-age assumptions, the basketball reference shot, and a roll/contact sampling assumption. The reference videos were restored, the shot was retuned through authored elbow velocity, the handoff test now uses actual projectile age, and a contact counter identifies collisions that enter and leave the board inside one simulation step. All ten passed their reruns. See `browser-validation.json`.

On this Intel Core i5-9500 / 31.79 GiB Windows PC, fresh active-playback observations averaged 56.1–58.4 FPS after the upgrade versus 58.2–59.3 FPS before it. The advisory 60 FPS target is not met consistently; running's p95 interval was 33.3 ms, and occasional longer frames remain. The shared hand PNG is 934,130 bytes and adds about 6.0 MiB of decoded RGBA texture storage. See `performance-summary.json` for each event, raw timing reports, memory estimates, and measurement limits. These are local observations, not a frame-rate guarantee.

Captures are actual renderer frames sampled at known simulation times and encoded at 30 fps. Quarter-speed captures sample the same motion clock four times more densely. They are not generated video, interpolated poses or a real-time FPS benchmark. Use `captures.json` for character/action/rate/frame provenance. Full temporary frames and state traces remain under `work/qa/animation-upgrade/`.

New artwork still uses fixed finger silhouettes. The far arm reuses the complete existing isolated arm surface; it is not a newly measured hidden-side performance. Gait and cornhole adjustments are reference-informed authoring, not newly captured mocap. Exact foot/material and contact measurements should be read from captured diagnostics, not treated as anatomical center-of-mass measurements.

The source-video defect sheet is `source-video-evidence.jpg`. `basketball-pose-strip.jpg` and `motion-pose-strips.jpg` show sampled final poses. The `silhouettes/` folder contains untextured pose checks for both characters. `action-presets.json` supplies reopening links and review times. `arena-editable-motion-v1.zip` contains both editable import packs, provenance, and the exact remaining editor operations.

Reproduction uses the existing Node/Playwright dependencies plus Python with PyAV and Pillow for encoding and contact sheets. Run `scripts/capture-upgrade-sequences.mjs after-final-v2` against the improved workshop on port 3015 and `before` against the preserved baseline on 3017. Then run `scripts/package-upgrade-review.py` and `node scripts/serve-animation-review.mjs`. The local review server on port 3019 supports video byte-range requests; newly encoded movies put metadata at the front for prompt playback. The original repository is checked against the starting SHA-256 inventory before integration; a separate rollback ZIP preserves overwritten files and lists added paths. No source or recorded outcome is discarded.
