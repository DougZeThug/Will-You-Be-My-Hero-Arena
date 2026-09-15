# Board-facing cornhole / palm artwork review

The main internal `cornhole-recorded` Lab now uses newly authored side-view Dan and Doug. Existing cards, arena, equipment, UI and simulation outcomes are retained. This is a Lab migration; the production application and other event rigs are unchanged.

## Equal stature and court depth

Dan and Doug are both **5′8″**, confirmed by the user. Their authored bodies retain the same nominal 371px standing-height calibration in isolated review. The main court previously drew the back player at foreground scale, making Doug appear physically larger despite the equal calibration. The injected Lab rig now receives its occupied lane and applies the same 0.70 back-lane perspective as the cornhole board. Dan remains at foreground scale; Doug is approximately 260px tall in the back lane. This is a placement correction, not a change to either source body's anatomy.

The scale is applied inside the rig to keep evaluated feet, hands and release velocity together. Contact-shadow dimensions follow it; ground origins remain at their existing court positions. The correction follows the lane rather than Doug's identity. Character metadata records 68 inches for both, and the browser regression measures their evaluated head-to-ground ratio. Current comparison: [equal-height court view](equal-height.png). Before/after checkpoints, state and decoded throw footage are retained under `work/qa/equal-height/`.

## What caused the old mechanics to read incorrectly

The previous artwork faced the viewer. Rotating its arm in the image plane could not turn the chest, hips, palms or shoes toward the target. A single painted hand also could not change from cupped grip to open release. Those were source-view limitations, not problems another easing library could solve.

New near-profile drawings provide the missing view and surfaces. Each rig has a full torso behind the near arm, a continuous weighted upper-arm/forearm surface, sleeve occlusion, and three separately registered hand surfaces. The near anatomical right arm retains the legacy `L` bone suffix; `throwing_hand` belongs to `hand_L`. Both toe vectors point screen right. Faces, outfits and footwear remain recognizable; cards are not redrawn or mirrored.

## Sleeve attachment correction

Attachment revision 1 fixes an actual material-boundary defect. The old front-sleeve rectangle included torso pixels below the printed cuff, painting a 4–11px cloth-colored strip over the arm in the 625px-tall inspection view. The arm was also clipped too far below its joint. The updated mesh clips the front layer to each character's cuff contour and retains a tapered arm overlap beneath it. Skin now begins within 1px of the registered cuff in the five matched before/after samples. The hidden overlap was checked for protrusion behind the sleeve during backswing.

This changes mesh assembly, not the source illustrations, anatomical landmarks, motion tracks, release markers or the equal-height court calibration. The texture atlas is assembled from the same sources. Regenerated skeleton hashes and editor import ZIPs include the correction and retain the unverified editor-round-trip label.

`tests/browser/sleeve-contact.spec.ts` probes actual rendered pixels below the evaluated cuff at rest, backswing, release, follow-through and recovery for all five throws on both characters (50 samples). The test detects a shirt/background band even when meshes remain alpha-connected. Full-body screenshots and decoded video frames additionally check the sleeve silhouette. Evidence is in `work/qa/sleeve-attachment/`; reviewed details are [Dan at release](sleeve-dan-release.png) and [Doug's backswing](sleeve-doug-backswing.png).

[Sleeve validation](sleeve-validation.json) records the paired pixel audit, 60 passing browser tests, pure checks, build and production isolation. The initial aggregate caught a missing test-only JSON type annotation; its corrected standalone typecheck passed. The initial report remains intact rather than being relabeled as a clean first run.

## Sleeve opening follow-up · attachment revision 3

The earlier lower-edge test missed a second occlusion defect. Dan's gray painted sleeve interior and Doug's dark underside were still in the front cloth mesh. They covered the inserted upper arm, so the sleeve looked closed even though skin touched its lower edge. Lowering the joint or increasing overlap could not fix that layer order.

The front cloth now excludes each source drawing's empty opening. The body/back cuff remains behind the continuous arm; the front cloth overlaps it above the opening. Convex material cutouts produce disjoint mesh polygons with source-mapped UVs and recalculated skin weights. No raster repaint, skeletal landmark, animation track, release time or height calibration changed. Both import ZIPs were rebuilt; editor verification and production installation remain false.

The pixel regression now checks four interior locations plus the lower edge at five phases in all five throws for each player: **50 poses and 200 interior probes**. A separate contour test checks area conservation for enclosed, crossing, overlapping and covering cutouts. The full regression passes: typecheck, 169,248 pure checks, 64 browser tests (one optional visual baseline test skipped), production build and production isolation.

Reviewed comparisons: [Dan before](opening-dan-before.png), [Dan after](opening-dan-after.png), [Doug before](opening-doug-before.png), [Doug after](opening-doug-after.png), and [the court during Doug's throw](opening-court.png). Three fresh recordings cover both isolated characters and the main match; 45 decoded frames and detailed state remain under `work/qa/sleeve-opening/`. [Opening validation](opening-validation.json) records the current checks. This supersedes the earlier claim that lower-cuff contact alone proved a correct sleeve join; earlier review evidence remains preserved.

## Shirt-back continuity · attachment revision 4

The forward swing was removing real torso volume. The previous skin-weight field assigned the back panel below the sleeve to `upper_arm_L`, with a falloff extending down to source row 525. Moving the arm therefore pulled the shirt's back toward the hand. A continuous cuff did not prevent this separate defect.

Torso and back fabric now use chest/spine weights. The moving sleeve has its own back and front surfaces; the stationary sleeve copy, including its ink edge, is cut out of the body mesh. A registered underlay reuses the original side-panel fabric beneath the sleeve. Its rear contour follows the source silhouette, avoiding both the missing panel and an added square edge. The rig now has eight mesh layers. No source image, face, outfit, body landmark, bone animation, release marker or height calibration changed. Both import ZIPs include attachment revision 4, with editor and production gates still false.

`shirt-back.spec.ts` checks torso-weight ownership and rendered back coverage in a silhouette pass at 50 poses, across both characters and all five throws. Expected coverage comes from the chest/neck frame, independently of the cloth deformation. The existing interior/lower-cuff checks still pass. In matched normal-color captures, six 3×3 probes found 36 background pixels through Dan's back and 45 through Doug's back at 1.08 seconds before the fix; both now have zero. This is a targeted occupancy measurement, not a claim that all anatomy is perfect.

Compare [Dan before](back-dan-before.png) / [after](back-dan-after.png) and [Doug before](back-doug-before.png) / [after](back-doug-after.png). Full stills, paired state, three recordings and decoded frames are under `work/qa/shirt-back/`. [Back-panel validation](back-validation.json) records actual checks, including any corrected test failures. The earlier sleeve-opening evidence is retained above; checking a cuff alone is insufficient to validate the whole shirt.

## Motion and game-animation references

- [THPRD cornhole coaching guide](https://www.thprd.org/pdfs2/document4394.pdf): fingers support the bag underneath, thumb rests above, opposite foot leads, weight transfers through the forward swing, release happens above the waist, and the arm continues after release. The new throws use that sequence. These are authored interpretations, not motion capture or exact reproductions of a named athlete.
- [Unity blend-tree guidance](https://docs.unity3d.com/Manual/class-BlendTree.html): related motions should align their action/contact phases before blending. Idle entry and throw recovery share a compatible pose, rather than independently restarting the arm and projectile.
- [Epic IK guidance](https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-setups?application_version=4.27): authored movement can be supplemented with foot constraints. Two-bone leg IK preserves foot targets while pelvis translation transfers weight; the two knee branches are deliberately different.
- [Epic motion-warping guidance](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine): target alignment belongs to bounded action windows. Here the source view faces the fixed board lane; this pass does not install Unreal or claim full motion warping.

The existing Phaser 3.90 / pinned DragonBones runtime supplies interpolation, skinning, IK and slot opacity. No additional animation library was needed. Sparse monotone cubic tracks preserve velocity through the release marker. Dan has a compact, measured swing; Doug has a deeper backswing and faster drive. Flat, slide, blocker, roll and airmail aliases remain reusable semantic requests. The bag stays on its evaluated palm socket, inherits its direction/velocity, and follows the existing trajectory to the immutable result.

The wrist follows the forearm during the backswing rather than holding the palm artificially horizontal. It presents the palm upward near release. Grip → open spans four authored frames around release. The current polish holds open fingers through follow-through and delays the two-frame transition to relaxed fingers until the hand is below shoulder height. This is three-pose illustrated finger work, **not individual finger bones**.

## Motion polish · 2026-09-13

This section records the first polish pass. The subsequent [whole-body biomechanics and hand-registration review](../cornhole-biomechanics/README.md) is current: it replaces the shared body envelope, revises timing, keeps torso cloth separate and uses larger crease-registered hands with opaque exposures. Earlier blend/cloth behavior below is historical.

The whole-match audit found no large existing state-boundary jump: the larger visual problems were a straight, high follow-through, relaxed fingers appearing while the arm was still raised, and the narrow underarm skin-weight falloff pinching the shirt. This pass preserves the director, release times, throw durations and results; it changes the authored performances and cloth weights.

- The upper arm now slows into a lower follow-through while the elbow bends slightly afterward. Dan uses a more compact finish; Doug retains his deeper backswing and quicker drive. A small trailing return settles the wrist and elbow without another clock.
- Open fingers remain visible through the apex. Relaxation occurs below the shoulder, with at most two blended frames instead of the earlier six-frame recovery exposure.
- The cuff contour and hidden arm overlap remain intact. The underarm weight transition now spreads into the rib cage instead of stopping in a 53px band, reducing the sharp cloth notch. No source artwork, texture atlas or anatomical landmark changed.
- Dan's restrained reaction includes a chest/neck settling motion; Doug's successful reaction lifts and lowers his palm. Their resting breath, target glance and weight-shift clips have distinct timing. These are bounded performances supported by the current art, not a claim of authored fist-pump, chest-tap or dance artwork for every semantic fallback.

The authored sources are split into `clips.ts`, `hand-surfaces.ts` and `ambient-clips.ts`. Rebuilding regenerates checked skeletons and both editor import ZIPs. Provenance records `motionPolishRevision: 1` and `attachmentRevision: 2`; editor and production acceptance remain false.

`animation-polish.spec.ts` checks all ten throw variants for open follow-through, low hand relaxation, bounded blended exposure and continuous hand coverage. It also checks distinct reaction paths and repeatable reverse seeks. The existing 50 rendered cuff probes and release/foot-plant tests remain required. `scripts/audit-character-continuity.mjs` samples the entire main sequence at 60Hz: 24 clip changes, maximum hand displacement at a clip change 1.085px, maximum head displacement 1.240px. The recording hash remains `f873f99b` and final scores remain `[5,3]` before and after.

Continuous captures of both character reviews and the actual court are retained under `work/qa/animation-polish/`; adjacent decoded frames cover backswing, release, flat/airmail follow-through and return. Curated views: [Dan follow-through](polish-dan-follow.png), [Doug palm reaction](polish-doug-reaction.png), [court release](polish-court-release.png). See [polish validation](polish-validation.json) for final checks. The planted stance and existing three hand surfaces remain the scope; this is not a new stepping approach or individually articulated finger rig.

Final checks: 169,248 pure checks, 63 browser checks passed across the full run and one targeted retest, typecheck, production build and Play/Watch isolation. One opt-in pixel-baseline test was skipped. The initial aggregate caught a one-unit floating-point opacity difference after reload (`0.4999000000000024` vs `0.49990000000000245`). The corrected test compares opacity to 14 decimal places while keeping every other character field exact; its retest and final typecheck passed. Original failed reports remain in the evidence directory rather than being rewritten as a clean first run.

## Art and export provenance

Source and generated atlas files live in `lab/loongbones/assets/cornhole-side-v3/`. The manifest hashes every installed export and both source sheets. The built-in image-generation tool created the view and alternate hands. True-alpha attempts produced baked checkerboards and were rejected. Accepted sources use an explicit magenta key; the established editor-atlas preparation derives usable transparency.

A follow-up generation removed dark wrist cut-cap lines. It also changed body shading outside that edit. Consequently only its isolated arm/hand region is packed into the atlas; the earlier accepted body is preserved. Atlas assembly does not repaint faces, logos or clothing.

The authored JSON uses DragonBones 5.5 with editor topology (`edges`, `userEdges`, dimensions), 30 bones, eight mesh slots and semantic release events. Coarser topology preserves the high-resolution texture while keeping native geometry/weight offsets within the format's 16-bit range. The authoring build rejects exports exceeding that budget. This addresses a real initial multi-mesh overflow found during visual QA.

`editorRoundTripVerified` and `productionInstalled` remain false. These files are new authored exports; they are not mislabeled as Dan's earlier returned editor bytes. The old sources, `dan-editor-r2`, `doug-weighted-v1` and `cornhole-motion-v2` are preserved.

## Review and use

Open the main Lab and choose **Cornhole · side-view Dan + Doug**. Press **Play**, or select `release`, `doug-release`, `doug-follow` and `recovery` to inspect exact moments. The current Dan/Doug review links provide clip selection, skeleton, silhouette, mirror and court-scale views. The left comparison is the **neutral assembly**, not an unmodified full-body source drawing.

Current individual reviews: `/loongbones/doug/?character=dan` and `/loongbones/doug/?character=doug`. Append `&version=2` for the preserved prior rig. `/loongbones/dan/` remains the original authoring/editor-return comparison.

Each review offers its LoongBones import ZIP. Import into a separate armature and return the exported ZIP in Codex for exact round-trip comparison. No code editing is required.

## Validation and practical limits

The browser suite checks both facing foot vectors, hand alpha sequencing, wrist/palm registration, bounded layered geometry, moving release, planted soles, same-object projectile handoff, deterministic reload, corrupt-export rejection and unchanged results. Screenshots cover silhouettes, mirrored poses and actual court scale. Continuous recordings are decoded at multiple neighboring times across backswing, release, follow-through and recovery.

See `validation.json` for the actual final checks and artifact paths. Temporary recordings and detailed state are under `work/qa/cornhole-side-v3/`. Curated screenshots accompany this review. Automated geometry checks supplement visual inspection; they do not certify biological realism.

Remaining authoring scope: full individual fingers, additional camera views, overhand sports, locomotion and an editor round-trip. Current clips retain a planted staggered stance; they do not add a stepping approach. Small blends are still visible when frozen between two different hand silhouettes.
