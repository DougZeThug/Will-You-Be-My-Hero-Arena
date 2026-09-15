# Actual LoongBones export review — 2026-09-12

**Passed: the supplied editor example runs inside Arena's exact Phaser 3.90.0 version.** This establishes the textured bone-animation and free-form mesh deformation path. It does not certify a weighted Dan rig, authored release markers, or every LoongBones feature.

## Open it without code

Ask Astra: **“Open my verified LoongBones export.”** The [local proof](http://127.0.0.1:3010/loongbones/?sample=editor) loads the files automatically. Press **Play** and select `stand`, `walk`, `turn face` or `atc`. Pause, +1 frame, Reset, Mirror and Toggle bones are available. The yellow object on the right is the separate weighted-mesh/hand-release fixture; it is not part of the supplied character.

## Evidence and scope

The user supplied `arena-editor-test.zip` from the [saved editor project](https://www.loongbones.app/editor/?workId=NfiK5sO1). The observed editor was **1.2.3**, exporting **DragonBones 5.5**, Current Armature `ubbie`, one texture atlas, scale 1, unchanged armature scale, no background, Data + Texture + ZIP. The original ZIP and all three extracted files are preserved byte-for-byte, with SHA-256 hashes in [provenance.json](../../../lab/loongbones/assets/editor-export-20260912/provenance.json).

This is the editor's built-in Mesh Example: 16 bones, 17 slots, ten possible image displays, eight unweighted mesh displays, a 1024×1024 atlas and four original animations at 24 FPS. Displays are switched or hidden by clips, so display count exceeds slot count. The export includes FFD vertex offsets but **no blended skin weights and no authored release markers**. The separate yellow fixture verifies those runtime capabilities without pretending they came from this editor export.

Verified status requires all three actual file hashes. A changed valid JSON still imports, but loses that status. Importing does not upload files or install a production character.

## Defects exposed and fixed

1. **Images rendered behind meshes.** Initial image quads were added without their authored slot depth. The eyes and mouth disappeared behind the head mesh; foreground arm ordering was also wrong. The bridge now initializes depth and visibility for all newly added displays. Tests compare rendered slot ordering to the export and verify visible facial features.
2. **Paused first frame showed the setup pose.** DragonBones' world clock deliberately skips a zero-delta update. A reset or fresh import therefore had not evaluated its initial authored animation pose until playback advanced. The bridge now explicitly evaluates the armature at zero time before fitting and presenting it. This correctly hides the unused apple and alternate arms at the beginning of `stand`, without an artificial time offset.

The export was not rewritten, simplified or stripped to obtain a pass. Changes are confined to the experimental Lab bridge, proof controls/diagnostics, tests, capture tooling and documentation. No production art, gameplay rules, character profiles, dependencies or input mapping changed in this pass. The broader working tree already contains substantial earlier uncommitted work and is not represented as this turn's diff.

## Validation

- All eight LoongBones browser tests passed: four original runtime/weighted/event tests and four new editor-export tests.
- Every original clip was swept at 60 samples per second through its full duration and loop boundary. Geometry remained finite and bounded; reset/replay restored the same state.
- The actual `stand` body mesh was sampled at its exported FFD keyframe. Inverting its evaluated slot matrix recovers the original vertices plus exported deformation offsets, within 0.001 source units. This tests deformation independently of bone motion.
- Blending, mirrored bone positions, pause/resume, local import and exact-file provenance checks passed.
- [Full regression](regression.json): TypeScript, 161,408 pure checks / 2,000 seeded contests, **35 browser tests**, production build, and production Play/Watch isolation passed. The normal suite intentionally skips its opt-in pixel comparison; the separate `--visual` comparison also passed (one test, existing approved reference images). No baselines were updated.
- The production smoke test found no Lab API in the built application, no browser errors, and no practice save writes. Build warnings about chunk size/dynamic imports remain; they did not fail the build and were not changed here.

## Motion and visual review

[Page screenshot](proof-page.png), [idle frame](idle-frame.png), [turn/gesture frame](turn-frame.png), and [capture/state report](state.json). The normal-speed [WebM recording](../../../work/qa/loongbones-editor-export/native-motion.webm) remains in ignored QA output and can be regenerated with `node scripts/capture-loongbones-proof.mjs --editor-export`.

Capture conditions: Chromium desktop, viewport 1440×1200, normal playback, one-second encoder pre-roll, then `stand` → `walk` → `turn face` → `atc` with runtime blending. Nine frames were decoded from the captured video, not reconstructed as unrelated screenshots. Five were inspected across idle, walk, front-turn/gesture, anticipation and action follow-through. Facial and foreground layers are visible and the cartoon example's parts remain connected in those sampled poses. This is not an anatomy approval for Dan or an assertion that every possible frame has been visually certified.

The separate three-second unrecorded sample reported **181 frames, p95 16.72 ms, 19 game objects and seven textures**, with no page errors. These describe this desktop run, not a physical-device guarantee.

## What remains for Dan

The runtime choice now has a genuine editor-export proof. Next comes separating the approved Dan illustration into usable layers with hidden joint coverage, authoring anatomical bones and blended weights, and adding meaningful animation events. Then test natural shoulder/chest deformation, elbow/wrist/hip/knee motion, foot planting, silhouette, mirroring, locomotion and court-scale appearance. Preserve the approved full-body proportions; the current static source preview is not a finished rig.

No LoongBones VIP subscription was purchased. The observed AI animation feature required VIP; this pass uses the example's existing authored clips. Production migration remains gated on the actual Dan asset and animation evidence.
