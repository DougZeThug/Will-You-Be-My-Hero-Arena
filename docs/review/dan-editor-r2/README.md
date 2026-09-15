# Dan revision 2 — actual editor import check

**Subsequent result:** the user supplied the ZIP. Its exact files run in Phaser, but easing, idle looping, left-knee direction and release-bone metadata were lost during interchange. A separately labeled compatibility restoration passes comparison tests. See [the completed export audit](../dan-roundtrip-r2/README.md); the handoff below is historical.

On 2026-09-12 the user dragged the corrected skeleton into the existing LoongBones 1.2.3 project, **Arena Compatibility Test**. The active armature is `dan_weighted_v1`; the initial diagnostic import remains `dan_import_r1`. The corrected armature was saved. No source pixels, authored keys or production game code were changed during this check.

## Verified in the editor

- The corrected `body_surface` selects and displays its mesh points and binding list. The previous missing-outline exception no longer blocks this armature's authoring workspace.
- All seven clips select and their timelines advance: `neutral`, `idle_breathe`, `look_target`, `arm_check`, `throw_low`, `quiet_nod`, `weight_shift`. The bounded playback check captured no new console errors. See `playback-checks.json`; its time values show advancement, not full-duration or frame-exact validation.
- The actual Preview shows Dan with the approved proportions and connected deformation during arm bend and low throw. Weight-shift Preview was also inspected. These screenshots are editor evidence, not a continuous video capture or a final anatomy certification.
- The left IK property panel lists `plant_L`, `thigh_L → shin_L`, target `foot_target_L`, weight 1.00. The right lists `plant_R`, `thigh_R → shin_R`, target `foot_target_R`, weight 1.00. The original foot target bones are present. Property-panel snapshots are retained in `left-ik.txt` and `right-ik.txt`.

## Export boundary still pending

The export dialog was configured for **Current Armature**, **Dragonbones Json 5.5**, texture atlas, output scale 1, unchanged armature scale, Data + Texture + ZIP, project name **dan-editor-r2**. The Export action closed the dialog, but no download event arrived within 15 seconds, no named ZIP appeared in Downloads, and the observed page-asset inventory contained no named export. This is a download-delivery limitation; it is not evidence that the export bytes are valid or invalid.

The next required artifact is the actual LoongBones-generated ZIP. The user can click Export in the configured dialog and attach the ZIP in Codex, as with the earlier successful `arena-editor-test.zip` handoff. Do not substitute our original import JSON and describe it as editor output.

After receiving that ZIP, preserve its original bytes and hashes, load its Dan armature in the existing Phaser 3.90.0 bridge, and compare the weighted mesh, both IK constraints, clip motion, hand socket and the `release` marker at 43/60 seconds. Check whether the editor changes clip loop behavior or timeline curves. `editorRoundTripVerified` and `productionInstalled` remain false.

## Regression scope

This session changed editor selection/save state and review documentation only. It did not change Arena runtime, rig geometry, textures, clips or gameplay. The immediately preceding revision-2 regression passed type checking, simulation/animation tests, 39 browser tests, production build and production isolation; [that report](../dan-editor-import-r1/regression.json) remains the applicable local validation. It was not rerun to misrepresent it as a test of unavailable editor output.

## Evidence

- [Arm-bend Preview](arm-check-preview.png)
- [Throw Preview](neutral-after-throw-preview.png) — filename retained from capture; the visible arm is in the throw sequence, not a neutral-pose claim.
- [Weight-shift Preview](weight-shift-preview.png)
- [Export settings](export-settings.png)
- `neutral-timeline.png`, `idle_breathe-timeline.png`, `look_target-timeline.png`, `quiet_nod-timeline.png`: selected timeline evidence, not full-body pose approval.

Editor viewport: 1294×912. Preview zoom is for inspection only; it does not change the character's source dimensions or export scale. No new LoongBones AI request or paid service was used.
