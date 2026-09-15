# Dan weighted foundation — 2026-09-12

**Latest export result:** the user supplied Dan's LoongBones ZIP. Its unchanged files run in Phaser, but interchange loses easing, idle looping and left-knee direction. The [export audit](../dan-roundtrip-r2/README.md) documents a separately labeled compatibility restoration, pixel-identical art, motion parity checks and current limitations. This original foundation report remains historical evidence.

**Subsequent editor check:** the user imported the first pack. It rendered in LoongBones Preview but the editor's mesh tools failed because mesh outline metadata was missing. [The diagnosis and revision 2 correction](../dan-editor-import-r1/README.md) record the exact cause and next step. The current downloadable pack contains the correction; runtime geometry and animations are unchanged. The old editor import is saved as `dan_import_r1`. This report's motion evidence describes the local rig, not a completed editor round trip.

Dan's approved full-body drawing now has an active anatomical skeleton and blended skin weights in the exact Phaser 3.90.0 runtime. This is a **local authoring foundation**, not a finished sports character or a verified LoongBones editor export. The regular Arena still uses its existing characters.

## Use it without writing code

Open [Dan's weighted rig review](http://127.0.0.1:3010/loongbones/dan/), or ask Astra: **“Open Dan's weighted rig.”** The left figure is the unchanged source; the right figure is animated. Press Play and choose a clip. Joints, Silhouette, Mirror and Court scale are diagnostic views. Reset restores the selected clip; +1 frame advances a paused frame.

The [import ZIP](../../../lab/loongbones/assets/dan-weighted-v1/dan-rig-import.zip) contains Dan's skeleton, atlas, texture and a plain-language README. These are Astra-authored DragonBones 5.5 files. They have **not** yet been imported into LoongBones, saved there, and re-exported.

In the currently open **LoongBones 1.2.3** editor:

1. Extract the ZIP.
2. Drag `dan_tex.png` and `dan_tex.json` into the Library on the right.
3. Then drag `dan_ske.json` into the Library. The observed Import dialog says assets must precede skeleton data.
4. Open the new `dan_weighted_v1` armature and tell Astra **“Dan is imported; continue the rig review.”** Preserve the existing `ubbie` example.

The editor exposes drag-to-Library import and no usable file picker in the inspected UI. The available browser control supports file pickers but cannot drag operating-system files into this page. This is the remaining manual handoff, not an animation subscription requirement. No paid AI service was used. If import fails, retain the exact error; do not strip weights, constraints or markers to obtain a superficial pass.

## Construction and protected art

- The approved source is `lab/assets/dan-source/full-body-v2.png`, 808×1947, selected by the user after rejecting the earlier lanky assembly. Texture preparation applies the existing magenta-key transparency rule. RGB artwork, proportions, face, hairstyle, logo, shorts and flip-flops are preserved. There is no generated repaint or independent resizing of limbs.
- Thirty bones include pelvis → spine → chest → neck/head, paired clavicle → upper arm → forearm → hand chains, paired hip → knee → ankle chains, hand sockets, heel/toe landmarks and two independent foot targets. Joint locations are defined in original source pixels, then converted to parent-local transforms. Shirt edges do not define shoulder pivots.
- The skin contains **7,758 vertices, 14,482 triangles and 3,029 blended vertices**. Weights are normalized against the actual bone hierarchy. The connected shoulder surface blends toward the upper arm; transparent arm/torso gaps have separate mesh vertices so a moving hand cannot pull the shirt or shorts along with it.
- Two two-bone IK constraints preserve the ankles while the pelvis moves. Feet retain their authored orientations; heel/toe sockets and actual foot-surface vertices are tested. The different projected foot heights preserve the original three-quarter stance. No unmeasured center-of-mass or weight-percentage claim is made.
- Seven authored clips: `neutral`, `idle_breathe`, `look_target`, `arm_check`, `throw_low`, `quiet_nod`, `weight_shift`. Cubic easing, anatomical pivots and runtime track blending connect the bounded movements. These are data-authored curves evaluated by DragonBones, not webpage sprite swaps.
- `throw_low` has actual `grab`, `release`, `recovery` and `animationComplete` frame events. Release is authored at 43/60 seconds. A Phaser diagnostic bag follows the evaluated throwing-hand socket, then detaches once. It is a socket/trajectory check, not a replacement for cornhole rules or equipment.

## Defects found during this pass

Initial nearest-region weighting let hand/arm bones capture nearby shirt and shorts pixels, causing long shards. Anatomical mesh regions now keep those surfaces separate across transparent gaps. A further shirt-edge snag appeared in decoded throw frames; the torso-side influence now fades out before the waist instead of stopping abruptly. The entire shoulder-to-arm transition remains connected. Review zoom and mirror also preserve the released bag's rig-relative trajectory.

Neutral geometry matches the approved source coordinates without a silhouette reconstruction or new proportions. During the bounded arm/throw checks the outline stays connected and the shirt edge remains with the torso. The existing elbow shading compresses during a bend and the hand retains its drawn palm orientation; these remain limits of a single-view skin, not a claim of complete natural athletic animation.

## Validation and evidence

The four dedicated browser tests verify:

- Approved bind coordinates within 0.02 source pixels; correct joint parents; valid normalized weights and genuine multi-bone influence; source/export hashes and a downloadable ZIP.
- Planted heel/toe sockets and actual sole vertices while pelvis/knees move, within 0.01 displayed units.
- Hand attachment, one authored release event, observed within one 120 Hz evaluation step, deterministic replay, and mirrored in-flight placement.
- All seven clips over 180 samples each, finite bounded geometry, silhouette/mirror/court views, real-time pause, no page errors and unchanged browser storage.

The normal-speed [motion capture](../../../work/qa/dan-weighted-motion/dan-motion.webm) plays breathing, planted weight shift, arm bend, low throw and quiet nod. Eleven frames were decoded from the recording for inspection; this is not a set of unrelated reconstructed stills. [Capture state](state.json) records playback tracks, evaluated bones, release events, decoded presentation times and a separate unrecorded performance sample. The final desktop sample measured 181 frames, p95 16.69 ms, one mesh, 14,482 triangles and four textures. This does not establish mobile or physical-controller performance.

Reviewed stills: [neutral](neutral.png), [arm/release](release.png), [weight shift](weight-shift.png), [silhouette and joints](silhouette.png), [mirrored silhouette](mirrored.png), [court scale](court.png). Automated geometric checks do not certify every frame's anatomy.

The [full regression report](regression.json) passed: TypeScript, **161,408 pure checks across 2,000 seeded contests**, **39 browser tests**, production build and Play/Watch isolation. The regular suite skipped its one opt-in visual comparison; the separate visual-baseline run also passed, without updating baselines. Production reported no page errors, Lab globals or practice save writes. Existing large-chunk and dynamic-import build warnings remain.

This change is confined to the Lab rig, generated import assets, QA tools/tests and guidance; it does not change scoring, persistence, input bindings, production art or the shared native bridge. The existing broadly dirty working tree predates this task and is preserved.

## Remaining gates

1. Import this exact pack into LoongBones; verify visible Dan, weights, the two IK constraints and all seven clips. Save the armature and export DragonBones 5.5 Data + Texture + ZIP. Preserve the returned files separately with new hashes and actual editor provenance.
2. Compare that genuine editor round trip inside Phaser: bind silhouette, foot planting, shoulder/elbow/wrist motion, weights and once-only release. Never turn on `editorRoundTripVerified` based solely on a successful parser call.
3. Author hidden shoulder/torso/hip coverage and alternate hand views before crossing arms, large torso turns, deep bends or locomotion. The current single-view surface cannot reveal artwork that does not exist. Walking, running, full throws, chest taps and celebrations are not complete here.
4. Only after motion review passes, integrate the semantic animator behind the existing character boundary, preserving live markers and immutable Watch recordings. `productionInstalled` stays false until then.

## Reproduce and continue (for Astra)

With the Lab running on 3010:

```powershell
node scripts/build-dan-rig.mjs
& ./scripts/package-dan-rig.ps1
node scripts/browser-tests.mjs tests/browser/dan-weighted.spec.ts
node scripts/capture-dan-rig.mjs
node scripts/regression.mjs
```

Authoring modules are `lab/loongbones/dan-rig/anatomy.ts`, `skin.ts`, `clips.ts` and `build.ts`. Change those sources and rebuild/package together; do not hand-edit generated mesh arrays. Packaging writes exact SHA-256 provenance for the source and three interchange assets.

`window.__HERO_DAN_RIG__` exposes copied state plus reset/clip/play/pause/step/view controls. No mutable runtime object or persistence command is exposed. The API and assets remain outside the production build; production smoke checks all three Lab globals are absent.
