# LoongBones compatibility gate

Status: **the user's actual LoongBones 1.2.3 exports run in Phaser 3.90.0.** The initial example proof below remains a separate fixture. The main cornhole **Lab** now renders Dan's restored returned weighted export and Doug's locally authored weighted foundation. Production, other sports and live Play retain the established rigs. Match rules, cards, UI and equipment are unchanged by this migration.

Current integration: [Doug weighted review and editor workflow](review/doug-weighted/README.md). The per-game rig provider selects real native weighted meshes, samples their authored release markers on the immutable recording timeline and exposes provenance in `characters[].rigDetails`. Main-Lab playback uses deterministic absolute clip sampling; the older compatibility demo below uses persistent real-time tracks. Doug is not a returned editor export and must not inherit Dan's verified-export label.

The user has no Spine license and requested LoongBones, with a working export in the exact current Phaser version as the prerequisite to committing to it. This replaces the previous Spine tooling preference, not the anatomy quality requirements.

## Open the proof without coding

Ask Astra: **“Open my verified LoongBones export.”** The [local editor-export proof](http://127.0.0.1:3010/loongbones/?sample=editor) loads the preserved files automatically. Alternatively, open the proof from Arena Lab and click **Load verified editor export**. Press Play, then choose `stand`, `walk`, `turn face` or `atc` from the clip menu.

Use Play, choose a character animation, test hand release, test mesh deformation, pause, step and mirror. The orange test bag follows the evaluated hand until the authored `release` event. Its subsequent trajectory belongs to Phaser. The yellow mesh is deliberately a diagnostic fixture, not new Arena art.

The local file chooser accepts a skeleton JSON, atlas JSON and PNG together. Files are read inside the browser and are not uploaded. It currently tests the first armature in a single-page export and fits it into the sample area. A file's format or name does not prove which editor authored it. The verified status requires SHA-256 matches for all three original supplied files; other imports remain unverified, including valid edited copies.

The user signed in on 2026-09-12. Astra created and saved [Arena Compatibility Test](https://www.loongbones.app/editor/?workId=NfiK5sO1) in the actual **1.2.3** editor. The editor offers DragonBones **5.5** export. Manual arm keyframes worked, but AI animation generation reported a VIP subscription requirement. After the initial download-delivery problem, the user supplied `arena-editor-test.zip`. Its original ZIP and three unchanged assets are preserved in `lab/loongbones/assets/editor-export-20260912/`, with hashes and export provenance. See [the completed editor-export review](review/loongbones-editor-export/README.md); [the earlier session](review/loongbones-editor-session/README.md) records the original blockage. No subscription was purchased and Dan's artwork was not uploaded.

## What is implemented

| Item | Concrete implementation |
|---|---|
| Exact engine | Existing `phaser@3.90.0`, native WebGL mesh objects in one Phaser scene |
| Animation evaluator | Official MIT DragonBones core `5.7.000`, pinned to commit `64b6c69ae35777c2404be68c9192e2c56906079e` |
| Rendering bridge | Lab-only `NativeFactory`, `NativeSlot`, `NativeMesh`; evaluated matrices and weighted/FFD vertices go directly to Phaser |
| Authored reference | Unmodified official `mecha_1406` DragonBones 5.5 export, 17 bones, 13 image slots, eight animations and IK constraints |
| Actual editor export | User-supplied LoongBones `ubbie` example: 16 bones, 17 slots, eight unweighted mesh displays with FFD, four original clips, 1024×1024 atlas |
| Mesh fixture | Arena-authored three-bone weighted strip, 16 vertices, FFD clip and authored frame event |
| Animation transitions | Persistent runtime tracks with `fadeIn`; no per-render reset of animation tracks |
| Attachments | Bone matrix → armature root world matrix → Phaser object placement; reflection included |
| Release | Actual DragonBones frame event at 20/60 seconds; bounded 120 Hz evaluation then Phaser projectile motion |
| Inspection | `window.__HERO_LOONGBONES_PROOF__`: bounded state copies, animation tracks, bone matrices, vertices, hand/bag state, event log and frame timing |
| Controls | Manual stepping, reset/replay, pause/play, clip selection, bones, mirror and local export loading |
| Isolation | No production imports, no persistence writes, no change to input/AI/controller architecture; regression checks exclude the proof global from production |

The fixture's event is authored in data; it is **not** a fresh event exported from LoongBones. The official mecha character is an older DragonBones export. The `ubbie` character is the actual newly supplied editor export, containing both images and unweighted mesh deformation. Keeping these distinctions visible prevents tested features from being attributed to the wrong source.

## Why a bridge is necessary

The [official Phaser adapter](https://github.com/DragonBones/DragonBonesJS/tree/64b6c69ae35777c2404be68c9192e2c56906079e/Phaser) has old Phaser API assumptions. Its README still says meshes are unsupported, while its current source includes weighted mesh evaluation. Installing that old plugin unchanged is not evidence of Phaser 3.90 compatibility.

This proof keeps the upstream parser, animation state, blending, IK and event engine. The new adapter supplies current Phaser mesh presentation and uses the complete bone/slot matrices, including skew, instead of converting them into disconnected CSS/DOM rotations. No extra Pixi renderer or per-frame canvas texture uploads are used. The small grid texture is generated once for the test fixture.

Upstream code and sample provenance are in `lab/loongbones/vendor/provenance.json`, including sample hashes and the MIT license. `scripts/prepare-loongbones-proof.mjs` reproduces the pinned core build and samples using the existing TypeScript compiler. On this Windows host Node uses `--use-system-ca` for verified HTTPS; TLS verification is not disabled.

## Scope and unresolved gates

1. **Fresh editor round-trip — passed within its tested scope:** the user supplied the actual example export from the authenticated 1.2.3 session. All four original clips run with the exported textures and FFD in Phaser 3.90.0. The comparison exposed two bridge bugs, now fixed: initial image slots lacked their authored layer order, hiding facial features behind the head mesh; paused resets showed setup geometry because the runtime world clock skips zero-delta evaluation. The original export was not modified. Fresh-editor blended weights and release markers remain additional gates because this example contains neither.
2. **Production-quality weighted character:** demonstrate connected shoulder/chest, wrist, pelvis and knee deformation on corrected Dan artwork, plus foot planting, silhouette/mirror and court-scale review. The yellow fixture proves skinning math, not natural human anatomy.
3. **Authoring workflow:** verify what Astra can actually automate in the current editor. Its [AI Assistant documentation](https://www.loongbones.app/doc/editor/ui-ai) describes natural-language authoring. The [1.2.0 release notes](https://www.loongbones.app/releaseNote) specifically said image meshing, auto-binding and auto-weighting were not yet supported by that AI agent. Do not promise complete automatic rigging from a card based on marketing text.
4. **Feature compatibility:** this narrow adapter accepts DragonBones 5.5/5.6 JSON, normal bones, image/mesh/bounding-box displays, weighted skinning, FFD and basic IK. It rejects other data versions and nested armatures/special displays. New LoongBones physics/path/transform/mask features and multi-page texture export need independent fixtures and implementation. **Do not silently downgrade or strip an export to make it pass.**
5. **Play/Watch integration:** after the above pass, inject one semantic animator behind the existing character/controller boundary. Live markers must drive the existing gameplay event path once. Historical Watch times and outcomes remain immutable and seeking must suppress old events. The current proof is not this integration.

Export instructions and version selection are documented by [LoongBones](https://www.loongbones.app/doc/editor/export-db-data). Prefer the tested format explicitly when available. If the current editor cannot export it without losing required capabilities, stop the migration and report the incompatibility.

## Validation and evidence

`tests/browser/loongbones.spec.ts` tests the exact engine/runtime, rendered authored animation, simultaneous blend tracks and completed blending, mirror transforms, two-bone weighted vertex math, FFD independent of bone motion, hand attachment, once-only release, deterministic replay, pause, bounded frame diagnostics, local file import, and unsupported-version failure preserving the previous character.

`tests/browser/editor-export.spec.ts` verifies the unchanged supplied export, first-pose display visibility and layer ordering, actual FFD keyframe offsets against rendered vertices, every frame of all four clips, deterministic replay, blending, mirror transforms, realtime pause and hash-based provenance. A modified valid file must not retain the verified-export label.

`scripts/capture-loongbones-proof.mjs` captures real-time WebM, decoded presented frames, screenshot and state, plus a separate unrecorded desktop frame sample. Its default writes to ignored `work/qa/loongbones-proof/`; `--editor-export` captures the four supplied clips into `work/qa/loongbones-editor-export/`. Curated results are in [the original fixture review](review/loongbones-proof/README.md) and [the editor-export review](review/loongbones-editor-export/README.md). Automated correctness and frame timing do not certify natural character motion.

Agent commands: `pnpm typecheck`, `pnpm test:browser --grep "LoongBones proof|Editor export"`, `node scripts/capture-loongbones-proof.mjs --editor-export`, then `pnpm check:regression`. No package upgrade or Phaser replacement is required.

## Dan source preparation retained

**Actual Dan export received and tested:** the supplied `dan-editor-r2.zip` runs unchanged in Phaser 3.90.0 with blended weights and the release event, but the round trip loses the left-knee bend direction, idle looping, easing curves and the release event's bone association. The approved drawing is pixel-identical. A separately labeled compatibility copy restores the checked source settings and removes only zero-weight entries; it matches authored motion within 0.016 source pixels at the full-mesh checkpoints. [Open the comparison](http://127.0.0.1:3010/loongbones/dan/?sample=restored) or read [the export audit](review/dan-roundtrip-r2/README.md). This establishes usable playback with explicit compatibility handling, not lossless editor interchange or production integration. The earlier import history below is retained for diagnosis.

**Editor import update:** Dan's first pack failed in the authoring workspace on missing mesh outline metadata. [The confirmed diagnosis](review/dan-editor-import-r1/README.md) led to revision 2, which adds boundary edges and dimensions without changing runtime geometry, weights or motion. The user has now imported that correction: mesh selection works, all seven clips select/advance, both planted-leg IK properties are present, and the arm bend and low throw render in Preview. See [the corrected editor review](review/dan-editor-r2/README.md). The original editor copy remains `dan_import_r1`. The actual returned ZIP still needs Phaser verification; the editor Export action did not deliver a file through the available browser channel.

**Local rig foundation:** [Dan's weighted review](http://127.0.0.1:3010/loongbones/dan/) preserves the approved source on the left and evaluates 30 anatomical bones, blended weights, two foot IK constraints and seven authored clips on the right. The low throw detaches a Phaser test bag at an actual `release` frame event. The original Astra-authored interchange, returned LoongBones export and explicit compatibility copy remain separate choices. None is a production replacement. The older source-fit view described below intentionally remains static.

The current source is `lab/assets/dan-source/full-body-v2.png`, a background-cleaned version of the full-body illustration the user selected on 2026-09-12. The earlier assembly of `body-v1.png` and old atlas parts was rejected as too lanky and is superseded. The selected reference and generation provenance are preserved alongside the asset. Arena Lab → **Dan · revised full-body source** now displays the complete chosen drawing with uniform scaling. Its head/body ratio, torso volume, arm reach and three-quarter stance are not independently reshaped. Anatomical source-pixel registrations, silhouettes, mirror and sunset-court views remain available.

This source is not installed in Play/Watch, is not a LoongBones export, and does not animate. The Lab disables Play in this view; `rigQA.sourceFit.fitting` reports uniform scale and no deformation. The dots register anatomy on the approved illustration; they are not an active skeleton. The current game rig and older skeleton proposals remain separate choices. Continue with authored editor weights, deformation tests and motion after the export gate above. Preserve this reference's proportions during source separation and rigging; do not send it through the old A-pose registrations.

## Current right-handed motion revision

The main cornhole Lab and `/loongbones/doug/` review now use motion-v2 derivatives. The review has a character selector for Dan and Doug. Both use anatomical right-hand throws; their imported L/R bone suffixes still mean image sides. These new clips, material boundaries and original-fabric underlap are authored changes beyond Dan's returned export. Doug's editor round trip remains pending. [Full motion audit and limits](review/cornhole-motion-v2/README.md).
