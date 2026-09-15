# Cornhole biomechanics — motion polish 2

The Lab side-view characters now use a whole-body throw breakdown instead of the previous shared body envelope. The underlying Phaser 3.90 / DragonBones 5.5 bridge, source drawings, likenesses, proportions, eight visible material slots and 30-joint bind skeleton remain in place. These are authored LoongBones import rigs, not returned editor exports; editor round-trip and production-install gates remain false.

## Root causes observed

- Pelvis, torso, head and opposite arm mostly used scaled copies of the same envelope. Horizontal pelvis motion also determined vertical compression, tying two different physical actions together.
- The torso pitched away from the rightward target during forward transfer. There was no clavicle track, so the shoulder socket hardly advanced with the action.
- Palm compensation ignored animated pelvis/spine/chest ancestors. The first correction then forced the palm too flat and overextended the wrist. Final tracks constrain wrist articulation relative to the forearm; palms-up is expressed by the hand drawing, not a severe bend.
- The user identified tiny, unnatural right hands during this pass. Hand registration used the cut edge of the proximal forearm stub instead of the wrist crease, and scale did not match forearm thickness. The revised registration uses anatomical creases, uniform scales 0.90 for Dan / 0.79 for Doug and deep proximal overlap. Alpha dissolves between different finger drawings were replaced with single opaque exposures.
- Recovery used too little elbow change and shared too much timing with the forward swing.
- More leg motion exposed triangles crossing two anatomical owners. Far arm and leg polygons also painted row-by-row, producing striped overlaps. Separating weights alone did not fix the rendering order.
- The far arm's original hard x cutoff sometimes assigned shorts ink to the hand. Its lower material partition now follows the source transparency gap.
- A sole test sampled mesh zero, which became shirt_back after the previous attachment fix. It sampled no feet. It now selects body explicitly and rejects an empty sole sample.

The existing hand-to-bag position/velocity handoff was working. It was preserved. The new motion supplies its release velocity; immutable recorded outcomes and board contacts still constrain visual flight.

## Motion reference actually reviewed

[CJ Marquez, Cornhole Dojo Episode 19](https://www.youtube.com/watch?v=i1OqktIH0Uw&t=1486s), the near right-handed player in red shoes at 24:28–24:55, was inspected through the browser with pause and frame stepping. Observations:

| Video timestamp | Visible relationship | Adaptation |
|---|---|---|
| 24:28.4–24:30.4 | Bag settles forward; elbow is soft; head looks down the lane | Brief preparation and supported grip |
| 24:32.4–24:41.4 | Extended aim hold; quiet head, small hand adjustments | Compressed setup beat, preserving brisk Arena pacing |
| 24:46.4 | Knees soften and torso inclines as the arm descends | Independent vertical loading and distributed torso pitch |
| 24:47.4 | Arm reaches back while the forward step begins | Pelvis reverses before the upper arm |
| 24:48.2 | Body continues toward target with arm still behind | Forward drive precedes arm acceleration |
| 24:48.8 | Front foot supports transfer as arm passes beneath shoulder | Soft elbow and increasing forward hand speed |
| 24:49.4 | Hand passes forward around waist level; weight is committed | Release near maximum socket speed |
| 24:50.2 | Arm reaches forward/up; rear leg unloads | Shoulder/chest continue beyond release |
| 24:51.4–24:55.2 | Elbow folds, arm lowers and stance recovers | Recovery uses a different elbow path and later hip settling |

This observed throw includes a large step and rear-foot lift. The current characters preserve their approved planted stances; the transfer and overlap were adapted at restrained amplitudes. This is **motion reference, not traced anatomical coordinates, force-plate data or a claimed identical reproduction**. Perspective and the edited slow-motion timebase do not provide reliable real-world joint speeds.

[Will's self-recorded slow-motion flat bag demonstration](https://www.youtube.com/watch?v=8gBsg_-539g) was also inspected at 0:00, 0:05, 0:10 and 0:15 for grip rotation and release. Its cropped rear view is not the body-pose authority. [Eric Tscherne and Jodi Lim's flat-bag demonstration](https://www.youtube.com/watch?v=ByJCiGvIwKw) supplies additional hand-technique context.

## Implementation

`lab/loongbones/side-rig/throw-performance.ts` contains independent Dan and Doug performance channels and 17 semantic landmarks. Flat, slide, blocker, airmail and roll differ in setup time, body loading, arm reach, palm presentation and follow-through. Airmail has a higher release; slide/blocker stay lower; roll changes hand setup. These remain visual techniques over already-determined outcomes.

`clips.ts` exports native curves and markers. The neck and head counter the complete torso rotation; palm orientation includes chest and clavicle ancestors. Independent smooth pelvis X/Y curves are baked into the format's single vector timeline. This is authoring conversion, not another runtime clock or a render-FPS workaround.

`body-materials.ts` partitions original source geometry, and the optional material feature in the mesh authoring helper groups whole surfaces for correct occlusion. It does not redraw or repaint character art. Sleeve/front/back cloth assembly is preserved.

## Review without writing code

1. Open [Dan's throw review](http://127.0.0.1:3010/loongbones/doug/?character=dan&clip=cornhole_throw_flat_R_dan).
2. Press **Reset**, choose **0.25×**, **0.5×** or **1×**, then **Play**.
3. Use **Pose landmark** to jump to load, reversal, release, follow-through or recovery. Joints, Silhouette, Mirror and Court scale remain available.
4. Change **Character** to Doug and select his throw clip for comparison.
5. Open **Dan + Doug in Arena** to inspect both at normal court scale with the real bag handoff and scoreboard.

The debug API exposes playbackRate, clip duration and authored landmark times. `seek()` is pose inspection and does not replay release/sound effects. Slow playback changes the same authored clock; manual frame stepping remains exact.

## Validation and remaining limits

Final results are in [validation.json](validation.json). The complete regression run passed typecheck, 169,248 simulation/animation checks, production build and production Play/Watch isolation. Browser results were 67 passed, one optional pixel-baseline skip and two new assertion failures: the initial hand-size test incorrectly required curled fingers to have the reach of extended fingers. The corrected per-pose test passed for both characters on retest, giving 69 unique browser tests passed. Final typecheck also passed. Original failure reports remain preserved.

Reviewed views: [Dan breakdown](dan-breakdown.png), [Doug breakdown](doug-breakdown.png), [Dan silhouette](dan-silhouette.png), [Doug silhouette](doug-silhouette.png), [Dan on court](court-dan-release.png), [Doug on court](court-doug-release.png). Raw checkpoints, state, motion captures and iteration history are under ignored `work/qa/biomechanics/`.

Four real-time character movies contain all three review rates, with 204 decoded pose samples within 0.017 seconds of their requested video timestamps. The court recording contributes another 15 decoded frames. Whole-match 60 Hz sampling covers 24 clip transitions, with maximum transition displacement 1.084px at the hand and 1.227px at the head; recording hash `f873f99b` and final scores `[5,3]` are unchanged. An unrecorded headless Chrome run at 1600×1100 observed 59.945 FPS, 17.3ms p95 and no frames over 33.33ms across 870 frames (timing percentiles use the final 240-frame window). This is a local measurement, not a physical-device guarantee.

Checks include real foot vertices, finite deformations, shoulder/shirt coverage, moving release, release speed relative to the local hand-speed peak, head/chest counter-motion, unequal knee response, opposite-arm movement, forward support projection, distinct recovery, UI speed controls, reverse seek, main-court handoff and unchanged final results. The support projection is explicitly a visual mass proxy, not a measured center of gravity.

Three hand surfaces remain the limit; fingers are not individually rigged. Hidden-side art is still limited, and hair/eyes do not have independent drawings or bones. Large steps, out-of-plane turns and cloth simulation are not claimed here. These improvements remain in the cornhole Lab; other sports and the production player app retain their existing rigs.

Video review uses real-time captures at 1×, 0.5× and 0.25×, with actual clip-clock samples. The QA recording is a cropped 30 FPS stream; the game targets 60 FPS separately. `decode-motion.mjs` reads the VP8/WebM timestamps and uses WebCodecs to decode requested frames exactly. Earlier HTML video seek/presentation attempts dropped frames during readback and were rejected rather than accepted as pose evidence. Reviewed contact sheets preserve aspect ratio. Whole-match release testing now compares the bag and evaluated hand at the same instant instead of demanding the wrist hold one angle between separate checkpoints.
