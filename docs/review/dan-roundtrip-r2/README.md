# Dan's actual LoongBones export in Phaser

The user supplied `dan-editor-r2.zip` on 2026-09-12. Its original ZIP and all three extracted files are preserved under `lab/loongbones/assets/dan-editor-r2/`, with SHA-256 provenance. **The unchanged export runs in Phaser 3.90.0, but the editor round trip is not faithful.** An explicitly derived compatibility copy restores the observed losses and matches the original authored motion within export rounding. Production characters remain unchanged.

Open [the restored Dan review](http://127.0.0.1:3010/loongbones/dan/?sample=restored). The three links compare the original authored rig, the unchanged editor output and the derived restoration through the same scene and native Phaser bridge. Choose an animation, press Play, and use Joints, Silhouette, Mirror or Court scale. The left figure always uses the unchanged approved source image rather than the editor's padded atlas.

## What survived and what changed

| Data | Received result |
|---|---|
| Artwork | Exact RGBA match after reading the 808×1947 region at (1,1) in the new 1024×2048 atlas; zero differing channel values |
| Anatomy and topology | 30 named bones and their hierarchy, 7,758 vertices, 14,482 triangles and all boundary edges preserved |
| Coordinates | Bind transforms, UVs and weights rounded by the editor; maximum UV change <0.000005 and positive-weight change ≤0.000005 |
| Blended skin | All 11,137 positive influences preserved; exporter additionally writes **221,603 zero-weight entries** |
| Foot constraints | Both named chains/targets survive, but omitted `bendPositive` defaults to true, reversing `plant_L` from its authored false direction |
| Idle looping | `playTimes` omitted, so `neutral` and `idle_breathe` stop after one cycle in DragonBones rather than looping |
| Motion curves | Cubic easing discarded; split translation/rotation/scale tracks use linear `tweenEasing: 0` |
| Release | Event name and time **43/60 seconds** survive; its `throwing_hand` bone association is omitted |

The original returned file stays untouched and visible. `editorRoundTripVerified` stays false because that label must not conceal these changes. `assetIdentityVerified` separately reports successful checks of exact fixture hashes. A parsed file or a working editor Preview does not establish lossless interchange.

## Explicit compatibility restoration

`scripts/audit-dan-editor-export.mjs` checks the returned names, hierarchy, bind transforms, topology, key values and event times against the exact authored input. It produces `dan-arena-restored_ske.json` as a separate file. It restores the missing left-knee direction, two idle-loop settings, 261 per-track easing entries and the release-bone association. It removes exactly-zero influences while retaining every nonzero exported weight and its original rounding. It does not redraw, rescale body parts, normalize weights, replace key values, or modify received files.

The script is deliberately limited to this known round trip. Unexpected edited transforms, key values, topology, explicit loop/IK settings or editor easing fail for review instead of silently overwriting artist edits. It is not a general claim that arbitrary LoongBones features can be repaired or all future editor versions behave identically.

## Runtime and visual evidence

`comparison.json` records nine full-mesh checkpoints, including rest, weight shift, throw anticipation, release, recovery and reactions. The unchanged export differs from the authored reference by up to **77.10 source pixels** at the weight-shift checkpoint and **67.15 pixels** during throw anticipation. The derived restoration differs by at most **0.01581 source pixels** at those checkpoints; bone locations differ by less than **0.000125 screen pixels**. The browser regression additionally samples all seven clips through 3.3 seconds, checking bones, distributed vertices, completion and marker parity against the authored reference.

Foot planting tests inspect rendered sole vertices, not just target markers. Release checks cover hand attachment, the frame-43 event crossing, one release per throw, deterministic replay and mirrored flight. The event is dispatched at the next bounded 120 Hz runtime evaluation after the authored boundary; no separate throw timer substitutes for it. A modified but valid JSON file loses the verified identity and fails visibly before scene construction.

Normal-speed canvas video was captured for both the raw export and restoration, with decoded frames inspected around weight shift, elbow bend, anticipation, release and recovery. See the reproducible captures at `work/qa/dan-editor-motion/dan-motion.webm` and `work/qa/dan-restored-motion/dan-motion.webm`. `raw-motion.json` and `restored-motion.json` preserve state, presented-frame times and separate unrecorded timing samples. Both had no browser errors; this headless desktop sample measured p95 **16.69 ms** for both. Removing zero influences reduces the evaluated influence count; this capture does **not** demonstrate a measured frame-rate improvement.

Reviewed stills: [neutral](restored-neutral.png), [raw weight shift](editor-weight_shift.png), [restored weight shift](restored-weight_shift.png), [release](release.png), [silhouette and joints](silhouette.png), [mirror](mirror.png), [court scale](court.png). The larger arm bend still compresses existing elbow shading and the palm remains the original drawn view. This is a bounded foundation rig, not an approved complete sports-animation set. Hidden art, alternate hands, full locomotion, broad athletic actions and Play/Watch integration remain separate authoring gates.

## Reproduce and continue

Agent commands, run from the repository: `node scripts/audit-dan-editor-export.mjs`, `node scripts/compare-dan-roundtrip.mjs`, `node scripts/capture-dan-rig.mjs --editor`, `node scripts/capture-dan-rig.mjs --restored`, `node scripts/browser-tests.mjs --grep "Dan editor round trip"`, then `node scripts/regression.mjs`. The user only needs to open the Lab and select a clip.

The final aggregate regression passed type checking, 161,408 simulation/animation checks across 2,000 seeded contests, **43 browser tests**, production build and Play/Watch isolation. One opt-in visual-baseline comparison was skipped; no pixel baselines were rewritten. `regression.json` and `browser-results.json` preserve the results. New gameplay, art generation, editor uploads, paid services and deployment are outside this pass. The LoongBones project itself still contains its imported clip settings; the compatibility restoration is applied to the separate local export copy, not silently written back into the editor.
