# Reference cornhole throw — 2026-09-13

This pass extends Human Motion V2 in the opt-in `/human-motion/` Lab. It does not install a new production rig, alter recorded outcomes, or replace the approved character art. The source LoongBones import packs remain unchanged. New native animation clips are built from separate authoring data when the Lab loads.

## What the audit actually found

The previous take was not an arm-only rig. It already animated pelvis translation/rotation, three spine/chest segments, both clavicles and arms, wrist orientation, head counter-rotation, and planted-leg IK. There were 17 named breakdowns. The recovery already folded and lowered the arm along a different path; reversing it was not the underlying problem.

The actual problems were:

- The motor root never moved. Pelvis displacement was entirely local deformation around a stationary actor.
- Most authored channels used the same key times. Additive delayed movement could not repair the underlying pose relationships.
- The shoulder girdle rotated but had no authored translation within the chest's frame.
- Loading kept the torso too upright; the first revision still failed this comparison and was revised again after viewing the real throw beside Dan.
- The elbow changed most during recovery, while forward drive was comparatively simple.
- A four-sample linear velocity fit described the middle of the sample window, not the release instant. In a decelerating swing it overestimated launch speed.
- V2 precision flight solved acceleration toward a target, including horizontal acceleration, then stopped the bag at a timer. It had no independent board-contact/friction phase.
- The smaller far character was farther from his board in screen space. That inconsistent projection required artificial projectile acceleration.

Actual Dan measurements from continuous 120 Hz evaluated native poses:

| Measurement | Before | Revised reference take |
|---|---:|---:|
| Motor root horizontal travel | 0 px | 10.50 px |
| Pelvis horizontal travel | 18.88 px | 24.33 px |
| Pelvis vertical travel | 3.55 px | 6.96 px |
| Throwing shoulder horizontal travel | 31.88 px | 33.62 px |
| Right knee bend range | 13.71° | 23.95° |
| Left knee bend range | 15.20° | 21.65° |
| Head pitch range | 4.40° | 2.11° |

These are screen-space diagnostics, not calibrated physical measurements or an automatic naturalness score. Ankle drift was effectively numerical zero; separate browser checks now measure the actual sole mesh vertices as well.

## Real reference and its limits

Reference: [CJ Marquez — Cornhole Dojo, episode 19](https://www.youtube.com/watch?v=i1OqktIH0Uw&t=1484s), the near right-handed player from approximately 24:44–24:57. The 13-second local development excerpt is 854×480 at 30 fps. MediaPipe 0.10.32 / OpenCV 4.13 extracted 388 frames over 12.9 seconds, preserving raw coordinates, confidence, missing landmarks, normalized positions, velocity and acceleration. There were no timestamp fallbacks.

The footage is **edited slow motion**. Its velocities are per media second, not actual execution speed. The far arm is partly hidden and another person overlaps the subject; inferred joints are not all reliable ground truth. Pose landmarks do not measure the bag or individual fingers. Release near excerpt time 5.4 seconds is manually observed. Semantic phase correspondences are human annotations, not a mocap export.

The reference steps forward and lifts the rear foot. This Arena reference deliberately adapts its load/drive/release relationships to a **planted throw**, preserving the current stance and footwear. It is reference-informed animation, not a frame-for-frame rotoscope.

Inspection showed: the hips advance while the hand remains behind; the torso loads forward; the hand accelerates through a changing shoulder/elbow path; the arm and chest continue after release; the arm drops and the weight recenters by different routes. Those relationships drove the second authoring iteration.

## Implementation

- `lab/human-motion/authoring/cornhole-curves.ts`: 18 meaningful landmarks, independently timed joint curves, loading, forward drive and separately authored recovery. Dan is compact; Doug has a longer tempo, deeper sweep, more torso involvement and slower settling. Flat, slide, blocker, airmail and roll change body/wrist motion before flight.
- `lab/human-motion/authoring/cornhole.ts`: generates native LoongBones-compatible clips over the existing bind skeleton and weighted meshes. The clavicle's small world-space travel is converted through its parent frame. Neck/head compensation includes all authored spine ancestors. Three registered opaque hand drawings follow the release marker.
- `RootCurve`: shape-preserving continuous root velocity through intermediate breakdowns. Extremes settle; the motor owns world displacement and collision. Existing root clips retain their previous interpolation unless they opt in.
- `OrganicMotion`: the authored reference uses a reduced additive drive gain, retaining quiet breathing, gaze, secondary hand/counter-arm settling and inertial transitions without doubling the kinetic chain.
- `AttachmentManager`: a local quadratic fit samples release-instant velocity from recent actual hand positions. Position, direction, rotation and velocity initialize the same detached object. Charge affects actual animation speed before release.
- `ScreenBagDynamics`: constant downward gravity, registered board plane, inelastic impact, brief compression/bounce, tangential friction, hole drop, edge/ground miss and final settling. No target homing. These are compact 2D visual practice rules; the production recording solver remains separate and unchanged.
- The far Lab starting position is derived from board spacing and its existing 0.7 depth scale. Rig, bag size, launch velocity and gravity share that scale. Board artwork and placement are preserved.
- Reactions wait for the normal recovery/cancel boundary instead of interrupting full-body follow-through at the instant of scoring.

The existing rig has enough primary articulation; adding another skeleton or many helper bones was unnecessary. The drawings, topology and weights were preserved after checking sleeve/back coverage, bend extremes, silhouettes and planted soles. There is still no individual finger rig or independently simulated hair/shirt hem. Clothing follows its existing distributed torso/sleeve weights; do not describe it as new cloth simulation.

## Review without code

Open [the reference throw Lab](http://127.0.0.1:3010/human-motion/?event=cornhole&actor=dan&take=primaryAction&focus=dan).

1. Choose Dan or Doug, a shot, and **Load take**.
2. Select **Dan close view**, **Doug close view**, or **Arena scale**.
3. Choose any of the 18 **Throw breakdown pose** entries to inspect its actual authored point.
4. Use **Play**, **Pause**, **+1 frame**, and **0.25× / 0.5× / 1×**.
5. Toggle silhouette, skeleton, trails, balance/foot locks or velocity. Effects and shake are absent in this review.
6. Expand **Evaluated joint motion curves** to see position, speed and acceleration. **Export motion curves** and **Download state** save evidence.

`window.__HERO_MOTION__` exposes detached snapshots, evaluated curves, semantic clip metadata/landmarks and actual sole vertices. It never exposes a mutable game instance or writes saved results.

## Reproducible evidence

- `scripts/audit-reference-throw.mjs`: complete 120 Hz motion audit for either actor/shot; before and revised captures live under `work/qa/reference-throw/`.
- `scripts/review-reference-throw.mjs`: screenshots of all 18 actual clip landmarks, silhouettes and Arena scale, plus evaluated curves.
- `scripts/motion-reference/extract.py`: existing confidence-gated offline reference analysis. No new browser ML dependency or SciPy was needed.
- `scripts/motion-reference/compare_throw.py`: explicitly annotated source/character phase comparison, preserving source timebase and confidence. Local reference footage is development material, not shipped art.
- `tests/reference-throw-tests.mjs`: accelerated release sampling, continuous root derivatives, unconstrained flight, friction, soft contact, missed launches and idempotent settling.
- `tests/browser/reference-throw.spec.ts`: both characters × five throws, actual soles, hand exposures, launch tangent, root recovery, free flight, settled results and no-code breakdown controls.

The final [validation report](validation.json) records 93 browser tests passed, one optional pixel-baseline comparison skipped, 170,222 simulation/animation checks, type checking, production build and production-isolation checks. Both characters × five throws keep the evaluated sole vertices within 0.000031 screen pixels of their planted positions. All six source rig/atlas/texture hashes match. No pixel baselines were rewritten.

The 42-second `outputs/Arena-Cornhole-Human-Motion-Review.mp4` contains continuous forward recordings: Arena at 1×, then Dan and Doug close views at 1× and 0.25×. It is H.264/yuv420p at 1280×760/30 fps and was decoded end-to-end without errors. Reproduce packaging with `scripts/motion-reference/package_throw_review.py`; the original WebMs, game/wall-clock correspondence and decoded checkpoint evidence remain under `work/qa/reference-throw/review-videos/`.

A separate 12-second unrecorded desktop Chromium run reported 56.5 fps, 18.2 ms p95 frame time, 8.3 ms p95 update CPU work and 2.7 ms p95 render CPU work. These are one local run's bounded-window diagnostics, not a hardware-wide performance guarantee.

A passing numerical suite supports visual review; it does not certify that every pose is indistinguishable from a filmed person. This remains a Lab reference candidate for the user's review, with editor round-trip and production installation gates still false.
