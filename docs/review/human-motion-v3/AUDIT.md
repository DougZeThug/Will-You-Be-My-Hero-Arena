# Human Motion V3 — pre-change audit

2026-09-14. Completed before runtime edits. Reused the animation-direction and visual-QA workflows.

## Evidence and scope

Reviewed sequential frames from `../Arena-Reference-and-Personality-Review.mp4` (56.3s) and `../Arena-Motion-Review.mp4` (16.97s). These local deliverables contain cornhole, and the former also basketball; neither is a four-event review. Recorded the actual current `/human-motion/` cornhole, running, basketball and fighting proof through normal semantic inputs. Before captures, frame sheets, state and timing are in `work/qa/v3-before/`. The isolated fighting take is a jab, not evidence of successful contact. Close-contact validation also needs the normal AI/input scenario.

## Findings

| Event | Visible finding | Verified cause and existing working infrastructure |
|---|---|---|
| Cornhole | Whole-body load and release are substantially stronger; palm reaches the chest afterward but tap reads as a passing movement. | Actual measured near-arm/hip curves, progressive spine/clavicle, hand velocity sampling and constant-gravity bag/contact are already present. Keep them. `gestures.ts` immediately reverses at both chest-contact keys, with no contact dwell. Its initial keys target neutral instead of an incoming watch pose. `PerformanceTimeline` already avoids inserting an idle clip, but native blending still crosses toward those neutral keys. |
| Running | Leg motion resembles cycling/skipping under a translated figure; bent arms and pelvis do not establish a convincing stride rhythm. | `locomotion.ts` uses piecewise-linear foot X and one sine arch for swing Y, up to 120 source pixels. Stride metadata (55–101 world pixels) is independent of the foot path and actual render scale. Planner clamps rate .78–1.22 even when the required correction is larger. Gait changes preserve phase but do not reconcile currently planted contacts at the new phase. Phase metadata incorrectly labels the opposite foot's contact as airborne. Existing `FootLock`, motor velocity/acceleration, native leg IK and bounded support compression work and should be extended, not replaced. |
| Basketball | Ball gathers, rises above the head and leaves, but the lower-body load is weak; hand/ball interaction and the recovery dominate the shot. | Lowering ends at frame 24 although takeoff is at .38s. Landing compression is an authored frame-74 dip, independent of motor landing. Release hand velocity is sampled correctly, but flight computes both X and Y acceleration from the desired target, guaranteeing a converging path. `twoHandGrip` is currently only a label: every equipment sample and rendered prop uses the right-hand origin. The native guide-hand constraint exists and can be reused. |
| Fighting | Isolated strike has body participation, but idle is casual rather than ready; both faces/art point right. | There IS collision: `MotionSession` has a 95px X gap if Y separation is under 55px. It is not a reusable body-shape sweep, has a lane threshold discontinuity, and does not expose body volume. Combat desire is 110px and attack range 145px regardless of reach. One right-facing atlas cannot truthfully depict a left-facing right-handed opponent without additional artwork; flipping faces/logos violates preserved art. This is a real asset limitation, not a missing physics package. |

## Shared causes and implementation decisions

- Preserve `CharacterMotor`, `MotionPlanner`, `AnimationGraph`, `InertialPose`, `RecoveryMatcher`, `OrganicMotion`, `AttachmentManager`, `FootLock`, existing controllers and native LoongBones bridge. These already constitute the higher-level runtime; a second wrapper or engine adds no value.
- Add semantic contact history/landing response around current foot locks, and reconcile contacts when a phase-preserving gait changes. Derive gait adaptation from actual speed, stride duration and display scale. Use a measured running reference, retaining confidence and source timestamps; do not call the old static pose-demo a running reference.
- Extend existing equipment sampling to resolve its named anchor, keep release continuity visible, and use constant vertical gravity for basketball. Launch tuning must happen before/during the action; do not hide a bad release using target-homing acceleration.
- Replace the inline gap check with bounded swept body-space collision. Keep body radius, preferred combat distance and attack reach distinct. Current deterministic motor sweeps and Phaser's bundled Matter primitives cover this 2D problem; no Rapier or additional physics runtime is justified.
- Make chest contacts semantic and readable with a short authored dwell and delayed body response. Preserve measured cornhole release and the separately authored recovery.
- Extend existing review overlays and diagnostics with contact state, gait fit, equipment anchors, collision shapes and limb integrity. Metrics are review evidence, not a certificate of human realism.

## Protected boundaries

No atlas/source art, proportions, logos, faces or production Play/Watch migration in this pass. Derived native clips remain Lab-only and not unchanged LoongBones editor exports. Existing provenance gates stay false. Opposite-view fighting art remains an explicit unfinished visual gate.
