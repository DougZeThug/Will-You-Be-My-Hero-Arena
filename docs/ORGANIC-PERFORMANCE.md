# Organic performance over Human Motion V2

This pass extends the existing opt-in `/human-motion/` Lab. Phaser, the LoongBones native bridge, CharacterMotor, MotionPlanner, AnimationGraph, source rigs, controllers, event rules and projectile integration remain in place. No source illustration, atlas, weighted mesh, identity, stature or production recording was changed.

## Review without code

Open **Human Motion V2**, leave **Organic performance** checked, and press **Play**. Select a character and action, then **Load take** for a repeatable single action. Running includes **Start → run → stop**. **Camera framing** switches between arena scale and either character close-up. Review normal speed, half speed, quarter speed, pause and individual frames. The seek slider replays the same selected diagnostic input take.

Turn off Skeleton and Trails for raw motion review. Turn them on to inspect blue shoulder, green elbow, yellow wrist and red hand paths. Balance/foot-lock and velocity overlays are also independently available. There is no camera shake, blur or particle masking in these proofs.

**Evaluated joint motion curves** plots position, speed or acceleration over a six-second window, with chest rotation in radians. **Export motion curves** saves the actual rendered-joint samples, normalization, character and event context. Load an existing measured reference to compare dashed purple curves after adjusting Reference offset. The bundled measured demo is a different athletic action; it demonstrates the tool, not agreement with a real cornhole throw.

The Organic performance toggle compares the current authored techniques with and without the supplemental performance/inertial layer. It is not an exact historical build comparison: contact safety and atomic hand-release fixes remain enabled in both views.

## Responsibilities

- `OrganicMotion` adds bounded, independently delayed body responses over authored local transforms. Technique metadata supplies direction, loading and intensity; shared character traits supply looseness, posture stability, gesture energy, breathing phase and recovery speed. It does not simulate muscles, solve inverse dynamics, stretch limbs or replace clips with spring-driven puppets.
- `DampedMotion` analytically advances small responses in seconds, avoiding frame-rate-dependent Euler integration. The pelvis, lower/mid spine, chest, clavicle, upper arm, forearm and wrist have distinct delays. These responses retain their state through action changes. Opposite-arm balance, gaze stabilization and coherent low-amplitude breathing have separate convergence times.
- `BodyBalance` measures a screen-space torso/pelvis/head proxy against the support interval and active ankle contacts. Its weights are visual estimates, not force-plate measurements. The model provides limited balance correction; authored loading and forward transfer remain the foundation.
- `SupportAdjustment` keeps a support leg inside its actual two-segment reach as a running character returns to a taller idle. It lowers the pelvis by the minimum bounded amount instead of stretching the shin or relocating the locked foot. The correction decays on release.
- `RecoveryMatcher` selects lowered-arm, elevated-arm or moving convergence policies from the evaluated outgoing hand height, torso pitch, speed and gait phase. These are pose-matched **settling policies**, not fabricated authored recovery clips or a full motion-matching database.
- `InertialPose` adds bounded position/velocity residuals to incoming native blends. Only pelvis translation and selected local angles are adjusted. It never resets a live animation or advances a second clock. Correction clamps prioritize anatomical safety over a universal mathematical guarantee of velocity continuity.
- Semantic `equipmentRelease` commits the opaque open-hand exposure in the same simulation step as detachment. This fixes a native color-timeline floating-point boundary that previously lagged release by one tick. The source grip/open/relaxed drawings and registered wrist remain intact; fingers are not individually rigged or crossfaded into ghost silhouettes.
- Existing motor momentum persists across jump/action/recovery. Landing and combat contact can submit small visual impulses; gameplay knockback and health stay in the motor/event systems. The atlas has no separately authored hair/cloth helpers, so no nonexistent cloth simulation is claimed.

The cornhole, overhead-shot, stride, jump, strike, dodge and hit-response families share these modules. Future football/beer-pong techniques can use the same metadata and attachment contracts; their existing recorded implementations were not silently migrated. Combat's authored extension now coincides with its active marker window and is preceded by pelvis/spine/chest motion.

## Diagnostics and references

`window.__HERO_MOTION__.getState()` includes performance traits, propagation responses, balance estimates, native hand exposure, contact duration, support compression, outgoing-pose recovery policy and bounded transition correction. These are detached Lab-only data. `curves(character)` returns a bounded detailed sample window on demand; the real-time render summary does not repeatedly clone the entire history.

`scripts/motion-reference/compare.py` aligns a real extracted reference and a rendered-character curve export using explicitly supplied release timestamps. It draws position/speed/acceleration comparisons, preserves gaps and records input hashes. `--diagnostic-only` labels demonstrations with unmatched actions. NumPy and OpenCV already cover the needed operations; no SciPy or new browser dependency was added.

The original cornhole timing reference is the timestamped CJ Marquez study in [the biomechanics review](review/cornhole-biomechanics/README.md). There is not yet a calibrated, side-view cornhole landmark track in this repository. Do not call these curves measured cornhole mocap.

The transition design borrows the small-residual principle from [Epic's inertial blending documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/blend-nodes?application_version=4.27) and the analytic damping approach explained by [Daniel Holden](https://theorangeduck.com/page/spring-roll-call). The implementation remains local TypeScript over the pinned runtime.

## Acceptance boundary

See [the organic pass review](review/organic-performance/README.md) for test results and evidence. Mechanical measurements complement close-up, silhouette and continuous-video review; a low contact error cannot establish natural human performance by itself. The existing single-view artwork still limits opposing combat poses, fist/guard shapes, sole articulation and extreme athletic overlap. No editor round trip or production installation is claimed.
