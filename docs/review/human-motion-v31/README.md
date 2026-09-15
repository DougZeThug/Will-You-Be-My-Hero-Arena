# Human Motion V3.1

This continues the existing V2 motor/planner/native LoongBones runtime in the four-event Human Motion Lab. It does not install a new engine, replace the characters, change recorded match rules, or migrate the proof into production Play/Watch.

## Actual defect and correction

The [before-change audit](AUDIT.md) traced Doug's broad right arm to an ill-conditioned three-point source registration. Its principal stretches were 1.1883 and 0.9420: the source was widened while being shortened. The sleeve concealed the breadth in idle and exposed it when the arm came forward. Ten evaluated poses had anatomical bone scales of 1, without repeated animated inflation. Removing the sleeves left the broad arm visible.

`LimbRegistration` now fits upper arm and forearm using segment rotation and uniform anatomical length ratio, with an elbow blend. `ArmMaterialRegistration` applies that derived fit to Doug's private runtime mesh before inverse-bind parsing. Source pixels, source/editor exports, UVs, joint locations, hand registrations and character stature remain intact. The existing cuff cap still overlaps inside the sleeve. This is a geometry correction, not a claim that the editor export itself changed.

Joint-oriented opaque cross-sections away from the elbow changed from 105.94 to 83.99 rig units in the upper arm and 86.10 to 70.47 in the forearm. The opposite upper arm is hidden/fused with the clothing; whole-shirt width is not a valid comparison. The isolated source arm, actual native skin weights, moving silhouette and setup-relative width checks are the reliable evidence here.

## Movement changes

| Area | Change | Preserved authority |
|---|---|---|
| Cornhole | Corrected arm registration; distinct chest-contact holds and second-tap response; duplicate gesture key removed | Existing measured throw, hand release, fixed-gravity bag and contact result |
| Running | Contact-counted start stages; acceleration lean and delayed chest response; reduced high-knee lift; planted stance and articulated airborne ankle; braking/final-plant/settle | Actual motor velocity, measured stride fit, native foot markers, world-space foot locks |
| Basketball | Narrower shooting stance; deeper pelvis/knee load, distributed spine/clavicle sequence, forward shooting pocket, faster authored extension, ground-anchored review camera | Native takeoff marker, real motor jump, sampled hand velocity, vertical gravity, descending rim collision, landing compression |
| Combat | Guard, attack, dodge and hit recovery share a guard baseline; curled-grip hand exposure; neutral/attack/grapple/collision ranges distinguished; facing persists during retreat | Semantic controls, body sweep/proximity, bounded motor root motion, active hitbox markers |
| Opposite view | Rear-garment material variants for running/fighting; original face, limbs, source alpha and original front print retained | Native right-arm semantics and unit bone scales |

`KineticChains` centralizes the response chain and per-technique delay/amplitude configuration already used by `OrganicMotion`; it does not duplicate the motion solver. The Lab state now reports each event's chain. Shared `CharacterMotionSignature` and motion-profile traits continue to affect gait, setup, body response, follow-through and gestures. Doug retains his looser rhythm and stronger gestures; Dan remains more compact.

No new animation or physics engine was added. Existing Phaser 3.90, LoongBones/DragonBones bridge, motor, constraints, inertial transitions, effectors and equipment remain in place. Existing NumPy tools already provide filtering and derivatives; SciPy and One Euro filtering were not necessary for this offline pass.

## Use without writing code

Open [Human Motion V3.1](http://127.0.0.1:3010/human-motion/?event=cornhole). Choose the event, Dan or Doug, and a review action. Choose **Play**, **Pause**, a speed, **+1 frame**, or scrub the timeline. Close character framing stays grounded so airborne motion remains visible.

For the arm, select Doug, enable **Bone names**, **Mesh outlines**, **Right-arm weights**, and open **Rig integrity**. Choose **Right arm only** or **Without sleeve layers** to inspect the same evaluated pose. Weight colors come from the parsed native vertex influences. Length, scale, width and warnings come from actual evaluated bones/mesh vertices. Body/T-shirt/overshirt cannot honestly be split into separate body-only layers because that material is fused in the source.

Use **Silhouette**, **Balance / foot locks**, **Velocity**, **Equipment anchors** and **Body collision** for motion/contact review. Force **Chest tap**, **Bag flip** or **Fist pump** through the review action selector. These isolated gesture tests do not award points or manufacture a successful shot.

Open **Human reference / character** and select a source. Each event defaults to its own reference. **Load selected reference curves** loads measured positions/velocity/acceleration for the curve panel and optional authoring proposal. Cornhole keeps its explicit measured hold-shortening mapping. Other comparisons are labeled phase/cycle alignment, not frame-exact mocap. Switching the source never retargets the live rig automatically.

## Reference provenance and limits

The local [reference manifest](../../../motion-reference/v31/manifest.json) records file/model hashes, camera crop, interval, confidence coverage and normalized velocity statistics. Six additional measured tracks cover basketball gather and rise, jab/cross, slip, football upper body and a celebration. Prior measured cornhole and running tracks remain unchanged.

- [Cornhole demonstration](https://www.youtube.com/watch?v=MQFTtLG3Vxo&t=330s): near-side throw mechanics; far-side occlusions remain omitted.
- [Lateral running](https://www.youtube.com/watch?v=j8P_GLzV_3U): near-side gait. Far-side half-phase is authored, and edited slow-motion timing is not calibrated real speed.
- [Shot Mechanics shooting breakdown](https://www.youtube.com/watch?v=nDMDOZW6rPs): coach gather plus a broadcast load/rise segment. The visible-side leg is useful; occluded right-leg confidence is poor and landing is not observable.
- [Tony Jeffries jab/cross](https://www.youtube.com/watch?v=vyTaKpylOcU): guard, hip turn and front-leg support; instructional holds are not competitive timing.
- [Tony Jeffries head slip](https://www.youtube.com/watch?v=3lawJ1dO0Mk): the correct supported-slip segment; deliberately wrong earlier demonstrations are excluded.
- [Archive football mechanics](https://www.youtube.com/watch?v=-ZE7a4MpvQw): qualitative upper-body sequence only. Feet are cropped, the camera pans, another person overlaps and some pose estimates are unreliable. Do not retarget it automatically or infer ground forces/release speed.
- [Celebration broadcast](https://www.youtube.com/watch?v=N_HmZMB8NPs): brief chest/upward gesture. Crowd occlusion limits tracking. Only motion is studied, not the athlete's identity or meaning of the gesture.

Reference confidence is evidence, not certainty: an overlapping person can produce a confident but wrong landmark. Review the actual frames. No measured finger motion, calibrated COM/forces or complete basketball landing capture is claimed.

To regenerate, ask Astra to run `scripts/motion-reference/prepare-v31.py --extract` with the existing `work/motion-venv` Python after restoring the original local media listed in the script. The command reproduces extraction, compact tracks, quality reports and H.264 review clips. It does not fetch media, publish it, or add it to the shipped game. Without local video the panel reports the missing reference; measured JSON remains available.

## Validation and remaining limits

The 153.2-second MP4 is at `outputs/Arena-Human-Motion-V3.1-Review.mp4` in the parent workspace. All 4,596 frames decoded; the full timeline was reviewed through 307 chronological observations and the individual motion takes. See [visual findings](VISUAL-REVIEW.md) and [validation evidence](validation.json).

Typecheck, 170,642 logic checks across 2,000 seeded contests, the production build and production isolation passed. Browser coverage finished with 114 passing tests and one optional image-baseline comparison skipped. The full run initially had one obsolete button-label expectation; after updating that test to the new event-specific reference loader, its targeted rerun passed. No runtime code changed after the full suite; the original regression result and resolution are both retained in the evidence.

The 31 final continuous captures reported no browser errors. A separate unrecorded desktop/headless audit measured about 59.94 fps and a 16.9 ms 95th-percentile frame time across all four events. These measurements are not a hardware guarantee. Native limb scales stayed at one; actual planted sole drift was below 0.00003 world pixels in the deterministic gait tests, including direction reversal. Basketball handoff direction/velocity remained continuous, with real 60.5/42.35-pixel near/far jumps and landing compression. All six protected original skeleton/atlas hashes remain unchanged.

`scripts/capture-motion-v31.mjs` recreates the review matrix; `scripts/performance-human-motion.mjs --out=work/qa/v31-review/performance.json` measures unrecorded realtime separately.

The current combat hand is the existing curled-grip drawing, not a new fully articulated fist. Jab/heavy retain the current near-right-arm punch vocabulary; the left arm supplies restrained counterbalance. Continuous silhouette QA rejected the raised far-arm guard: the source contains an occluded, narrow edge of that arm, which becomes a thin exposed strip when raised. The final take keeps that upper arm beside the ribs with a small forearm bend instead of stretching or inventing its hidden surface. A full two-arm guard needs a properly authored hidden-arm layer. A complete orthodox lead-jab/rear-cross library and independently rigged loose clothing are also future authoring work. The new rear-garment view solves the reversed-print presentation without claiming a complete 360-degree directional character pack. These are still Lab authoring proofs, not newly verified LoongBones editor round trips.

Left-facing running also received a world-to-local sign correction for gait lean and organic support/counterbalance. Both characters are tested through a direction reversal using actual planted sole vertices, not only ankle targets.
