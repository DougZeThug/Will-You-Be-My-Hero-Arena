# Full-body performance and contact pass

This pass extends the existing **local Human Motion Lab** at `/human-motion/`. It preserves Phaser 3.90.0, the pinned DragonBones 5.7.000 bridge, LoongBones-compatible 5.5 assets, the motor/planner/graph, artwork, and production Play/Watch behavior. No new runtime dependency was needed.

## Confirmed causes and changes

| Cause | Implemented change |
|---|---|
| Cornhole chest/spine channels were largely scaled copies of one measured torso signal. | Preserve the measured signal as a smaller contribution, restore independent authored pelvis/spine/chest breakdowns, and give the opposite arm a distinct counterbalance path. Release timing and socket ownership remain unchanged. |
| Cornhole used the opposite knee-solver branch, folding the far leg into the near leg's silhouette. | Use the anatomical forward-knee branch already used by the other activities. The corrected support is visible without changing source proportions. |
| Every contact suppressed foot rotation. | A bounded heel/sole/forefoot policy rotates about the registered support pivot and solves the ankle around it. It preserves support while allowing toe-off; it does not stretch bones. |
| Running had shallow recovery and arms held mostly in front. | Stronger swing-leg heel recovery, loading and toe-off, independently authored elbow/shoulder phases, chest counter-rotation, and compact Dan versus looser Doug timing. Existing cadence/travel matching remains authoritative. |
| Basketball rose too rigidly and the guide hand stayed alongside the finish. | Independently curved knee/hip loading, toe-off/airborne foot attitude, earlier guide-hand separation, and preserved shooting-hand finish and landing absorption. |
| Combat shared a global modulo decision clock and lost its guard while moving. | Per-actor seeded, recovery-aware semantic AI decisions, guarded locomotion variants, approach/withdrawal around existing collision/reach rules, and root recovery that returns toward useful range. |
| Blocked and unblocked contacts used the same visible hit pose. | Once-only hit/block/miss records select distinct block absorption. Existing damage (jab 8; blocked jab 2), interruption, hitbox and stamina authority remain in gameplay. A block still interrupts the current action; only its reaction artwork/pose differs. |
| Major translation tracks used linear segments. | Reuse the existing monotone scalar sampler to bake independent X/Y native translation curves. This adds no second clock or interpolator to the live animation path. |

The new modules are `lib/arena/engine/motion/FootContactRoll.ts` and `CombatIntentRhythm.ts`. Most work is in existing `lab/human-motion/authoring/` modules, `NativeAnimator.ts`, and `events/CombatProof.ts`. `MotionPlanner` accepts a configured locomotion-variant map; global input remains event-independent.

## Review without writing code

Open the local Human Motion Lab. Select **Cornhole**, **Running**, **Basketball**, or **Fighting** and choose Dan or Doug. Use the existing take selector, Play/Pause, scrubber, speed and silhouette controls. Fighting adds **combat-hit**, **combat-block**, and **combat-miss** review takes for either attacker. These feed ordinary movement/attack/block inputs through the controller; they do not inject damage or outcomes.

`Arena-Animation-Performance-Review.mp4` in the parent `outputs` directory shows matched fresh-checkout before/after footage, full Arena after footage at 1×, and close review at 0.25×. Combat shows both actors together. The footage contains only actual rendered frames, no generated/interpolated motion, and no audio capture.

## Editable assets and provenance

The separately named generated pack is `lab/human-motion/assets/performance-v2/`, also packaged as `Arena-LoongBones-Performance-v2.zip` in the parent `outputs` directory. It contains each actor's skeleton, packed texture atlas and authoring metadata. Original character files and earlier packs are preserved. The source art is unchanged; the combined atlas copies existing character and hand drawings.

These are **Arena-authored derivatives**, not returned LoongBones editor exports. The JSON contains the authored native clips and hand exposures. Arena's dynamic world-space foot contacts, motor travel, runtime blending and procedural corrections still belong to Arena; an editor preview alone cannot reproduce all those world constraints.

Both packs were imported through the real local `/loongbones/` file input and rendered with finite weighted geometry. External LoongBones 1.2.3 was opened in the signed-in workspace, but its Import action did not expose a file chooser to the browser tool and no file input remained in the page. No editor import/export was fabricated. **`editorRoundTripVerified: false` and `productionInstalled: false` remain intentional.**

The remaining editor gate is: import into a separate editor work, save/export the changed skeleton plus atlas, then compare hierarchy, weights, curves, loop flags, hand exposures and release/contact markers through the existing round-trip verifier. Do not overwrite the preserved earlier editor work merely to test these derivatives.

## Evidence and tolerances

Temporary full-resolution evidence lives under ignored `work/qa/performance-upgrade/`; concise evidence is copied alongside this report. `before/` and `after/` manifests record cameras, actor, event, rate, errors and state samples. `verification/report.json` records import provenance, actual sole vertices, limb lengths, and silhouette captures.

Support checks use **world pixels**. Cornhole compares every sampled rendered sole vertex against the initial planted stance. Rolling contacts separately measure actual material nearest the registered support region and the evaluated ankle versus its intended contact transform. The allowed support-material drift is 2 world pixels; observed maxima across both characters and four activities are below 1.4 pixels. All sampled limb lengths remain unchanged to numerical precision.

The older gait tests assumed every heel vertex remained fixed during toe-off. They now compare all rendered sole material against the intended rigid contact transform, retaining the 2-pixel tolerance. This tests visible deformation/sliding while allowing the deliberately raised heel. The separate nearest-support-material measurement prevents an arbitrary moving transform from masquerading as a planted foot.

Silhouette and close-up review cover both characters' loading, release/contact, recovery and stride. Running now has clearer heel recovery and propulsion; its upper-body style remains a stylized recreational run, not a measured full-body mocap reproduction. Small holes/occlusions and single-view clothing limits remain subjects for continued visual review; numeric tests alone are not a naturalness score.

## Reproduction

Use the normal package checks described in `docs/AI-DEVELOPMENT-WORKFLOW.md`. Additional review commands, run from the Arena root:

```text
node scripts/capture-performance-pass.mjs before
node scripts/capture-performance-pass.mjs after
node scripts/check-performance-assets.mjs
work/motion-venv/Scripts/python.exe scripts/package-performance-review.py
node scripts/performance-human-motion.mjs --out=work/qa/performance-upgrade/live-after.json
```

Capture `before` only before changes; do not overwrite it with the upgraded checkout. Live performance measurement must run without concurrent capture, encoding, build or browser-suite work. The capture's 30-fps output is not a runtime-performance measurement.

Final validation outcomes and frame distributions are recorded in `validation.json` and `performance.json` alongside this report. The initial full regression log is preserved even when a subsequent targeted rerun resolves a failed check.

## Validation and performance result

Type checking, pure tests, build and production-isolation checks passed. The first complete browser run contained failures; focused reruns resolved the obsolete contact assertions and timeout cases. All **127 unique browser checks** passed across the complete run and documented reruns. The separately reviewed six-scenario pixel comparison also passed. This is not a claim that the initial regression command passed unchanged.

Live timing was measured separately from video recording, with diagnostics hidden and one headless browser page at a time. Original baseline samples were about 59 FPS. Because later measurements were slower, a second comparison served the saved pre-change TypeScript from a separate local Vite server without replacing the current checkout:

| Event | Paired baseline FPS | Current FPS | Current p95 frame time |
|---|---:|---:|---:|
| Cornhole | 55.45 | 55.98 | 33.0 ms |
| Running | 54.98 | 50.19 | 33.4 ms |
| Basketball | 55.53 | 53.30 | 33.4 ms |
| Fighting | 57.86 | 58.29 | 17.0 ms |

The environment changed between early and late measurements, but the paired running result still has an approximately **8.7% cadence regression**, and basketball approximately **4.0%**. These remain performance limitations. Both versions have 64 meshes, 14,133 vertices and 23,239 triangles; texture counts and estimated memory are unchanged. A separate CPU sample of both running versions identified the existing weighted-mesh update as the largest hotspot; the new contact-roll calculations were not a major sampled cost. This does not prove a unique cause or justify calling the regression resolved. All four timing captures are retained in `performance.json`; the encoded 30 FPS video is not a runtime benchmark.

The separate pixel test exposed a pre-existing cornhole reference containing the rejected front-facing paper figures. Its 36,146-pixel difference was confined to the previously approved character migration; the court/equipment remained the same. Basketball's old flight checkpoint differed by 5,768 pixels (thrower pose and ball phase), and football's landing checkpoint by 2,163 pixels (thrower settling). These legacy recorded paths do not use the changed Human Motion modules. All three were compared visually and deliberately refreshed to the preserved current checkout behavior. Their old images remain in QA evidence. Beer pong and both character baselines were preserved. The multi-load timeline test has a 120-second budget; the six-scenario visual test has 180 seconds and collects all differences with soft assertions, while still failing on any mismatch. Numerical and pixel tolerances were not relaxed. Run the browser suite without simultaneous capture or encoding work.
