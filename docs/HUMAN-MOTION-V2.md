# Human Motion Runtime V2

The [organic performance pass](ORGANIC-PERFORMANCE.md) extends this runtime with sequential body response, support balance, velocity-aware settling, action review takes and evaluated motion curves. It preserves the opt-in migration boundary below.

This is an opt-in **Arena Lab migration**, available at `http://127.0.0.1:3010/human-motion/`. It runs the actual Phaser 3.90 renderer, the pinned DragonBones 5.5 runtime used by LoongBones, and the approved side-v3 Dan/Doug meshes and textures. It does not install new art, change saved recordings, or award club points. Its `NativeAnimator` + `MotionPlanner` now also drive production Play running and fighting through `PlayMotionRig`; see [`ANIMATION-HANDOFF.md`](ANIMATION-HANDOFF.md) for the current routing.

The [V3 contact and locomotion pass](review/human-motion-v3/README.md) further adds measured gait retargeting, stride matching, named equipment interactions, actual landing absorption and body-space collision. Its review surface still uses this V2 architecture.

## What changed

The earlier recorded adapter intentionally resets and samples an absolute pose for every seek/render. That is useful for immutable recordings, but it is not a live movement system. Live paper animation separately estimates locomotion from velocity. The weighted rigs had fixed foot targets, one-event release sampling, and no shared motor/phase contract.

V2 adds a shared path:

```text
existing keyboard / gamepad / virtual device / AI
→ existing InputManager and PlayerController
→ event action map
→ event mechanic + MotionActor
→ CharacterMotor + MotionPlanner
→ AnimationGraph
→ persistent native animation states
→ foot / hand / gaze corrections
→ evaluated attachment + event physics
```

Pure movement, graph, profile, skeleton, equipment and analysis code lives in `lib/arena/engine/`. The experimental native adapter and proof modules live under `lab/human-motion/`. No production entrypoint imports the experimental renderer or MediaPipe. Existing input remapping, combo recognition and buffering are reused.

## Responsibilities and time

- `CharacterMotor` owns position, planar velocity, acceleration/deceleration, facing intent, grounded state, vertical motion and impulses. It sweeps every authored displacement through an injected collision policy. Displacement rejected by collision is measured. Starting an animation never zeros momentum.
- `MotionPlanner` selects human phases and a motion graph from action data. It chooses separate walk/jog/run/sprint ranges and uses stride distance/duration and render scale to choose a feasible gait, bound playback rate and adjust effector travel. V3 permits 0.5–1.18 for short walking steps and 0.86–1.18 for athletic gaits. Gait transitions carry cycle phase. Facing changes only after slowing to a plant-speed threshold; the one-view artwork cannot yet show a complete turn.
- `AnimationGraph` owns monotonic phase time, priorities, cancel windows, layers and exactly-once semantic marker crossings. Action, reaction, personality and base states remain distinct. Reactions interrupt from the current native pose through a fade.
- `NativeAnimator` starts a native state only when the graph revision changes. It uses native fades/groups/layers and bone masks. It advances on the same bounded 120 Hz clock as the motor; there is no render-frame reset or independent timer. DragonBones defaults to pausing a playhead during fade-in; V2 explicitly starts it so markers and visible action do not drift.
- Native IK is evaluated after motor movement. Foot plants capture world-space ankle targets. Foot release decays the remaining correction instead of removing it in one frame. Basketball's second-hand constraint ramps in/out and uses an offset target for the actual palm. Head aim and damped acceleration settling remain small offsets over authored animation.
- `AttachmentManager` retains a bounded recent hand history. Release estimates velocity, acceleration, direction and angular velocity from evaluated world anchors. The event retains authority over projectile mechanics and scores.

Native weight adjustment is isolated in one adapter around DragonBones 5.5's `_constraints`/`_weight` API. These are internal fields, so compatibility tests are required before upgrading the pinned vendor. Native bones, masks, fades, IK and marker support were audited in the installed declarations/source. No unsupported native cloth, finger rig or additive skin feature is claimed.

## Four proofs

| Proof | What is exercised | Boundary |
|---|---|---|
| Cornhole | Dan/Doug's authored full-body throws, planted feet, right-hand velocity, selectable flat/slide/roll/airmail, attachment and score reaction | New target-practice proof; immutable recorded cornhole still uses its reviewed adapter |
| Running | Continuous motor movement, distinct gait ranges, stamina, acceleration, jumps over obstacles, collision reaction, finish | Short fixed court for motion evaluation, not a new player-facing race |
| Basketball | Load, takeoff, native two-hand IK, airborne release, flight, landing and recovery | Live motion proof; the existing recorded basketball rules are unchanged |
| Fighting | Two controlled entities, movement, separation, jab/heavy/dodge/block, startup/active/recovery, hit windows, knockback and buffered commands | Mechanical contact proof; the current atlas lacks an opposite-facing view and proper fist variants |

The precision proofs preserve sampled launch velocity and solve the remaining visual acceleration against a target derived from aim/power. This is a compressed-court visual model, not unconstrained physical ballistics. Misses change the target; scores come from contact tolerance. The existing recorded sports use their existing authoritative rules.

## Character and source conventions

`SIDE_RIG_BONES` maps anatomical semantics to imported bone names. The near anatomical **right** throwing chain uses legacy `L` suffixes. Handedness is explicit in profiles. Never flip faces or logos to “fix” handedness. The validator names every absent semantic bone.

Dan and Doug retain 68-inch stature before uniform court perspective. Their profiles differ in acceleration, deceleration, cadence, stride scale, gaze range, idle and reaction choices. Existing cornhole performances remain independently timed. New athletic clips are authored derivatives using the same source mesh; they are not measured mocap or returned editor exports.

`editorRoundTripVerified` and `productionInstalled` remain false. The original exports, side-v3 files and approved artwork remain intact. There are still three hand exposures, not finger bones. The far arm and legs are drawn into a shared body source; extreme overlaps require additional source coverage before production-quality athletic animation is credible. These limitations must not be hidden by broader shoulders, mirrored logos or invented mesh seams.

## Lab controls and API

Open **Arena Lab → Human Motion V2**. Choose an event, press **Play**, and watch AI/AI; or choose keyboard/controller control. Click the court for keyboard focus. Pause preserves the current diagnostic frame; actual window blur clears inputs and requires neutral hardware before resuming. The seek slider resets and replays the AI baseline to the selected time. It does not claim to reconstruct earlier human input.

Review at 1×, 0.5× or 0.25×. Toggle skeleton/contact markers, hand trails and silhouette. The overlay includes joint positions, velocity vectors and a labelled visual mass proxy. Contact warnings measure ankle drift; a zero drift metric is not proof of correct sole artwork or anatomy.

`window.__HERO_MOTION__` is a frozen Lab-only facade. `getState()` returns copied motor/graph/native/input/event/attachment/analysis data; reading it never polls AI or advances a clock. `getPerformance()` uses the existing frame/render telemetry. Bounded `step()`, semantic `input()`, `view()`, `setRate()` and reference/retarget methods support tests. No score setter, mutable rig, persistence clearing or arbitrary evaluation is exposed.

Load a reference JSON from the offline utility to view detected landmarks on the same timeline. The retarget helper returns a proposal with target bone lengths preserved. See `motion-reference/README.md` for extraction, provenance, uncertainty and dependency setup.

## Future migration

1. Add or improve authored clips and semantic markers for one character/event.
2. Verify socket, gait, contact, transition and actual silhouette behavior in the V2 Lab.
3. Add any required opposite-facing art/hand exposures while preserving identity.
4. Pass editor interchange and runtime geometry gates for the exact files.
5. Adapt an existing live event through the shared motor/graph boundary without rewriting input, scoring or persistence.
6. Compare old/new recorded playback separately before changing Watch; preserve historical recordings and result hashes.

Do not declare all four sports visually finished merely because mechanics tests pass. The V2 proofs establish the migration path and expose remaining art/animation work; production rollout remains a separate acceptance step.

## Review workflow and final fixes

Click **Load measured reference demo**, then **Retarget proposal on Dan**. **Export Dan motion proposal** downloads a complete timed intermediate track using reference angles and target bone lengths. Speed scales timestamps and semantic markers together; source gaps remain null. This does not install a native animation. The seek slider reloads the AI baseline; reload the reference afterward and use Reference offset to align it.

Unkeyed native channels retain lower-layer ownership instead of resetting to the bind pose at fade completion. Actions own their contact markers. A 75 ms touchdown correction is reported separately from fully planted contact; its subsequent drift remains measured and visible. Profiles supply cadence, idle and reaction choices. Repeated attacks restart inside cancel windows, hit reactions gate interruptions, and an interrupted dodge cannot retain immunity. Paused scenes avoid rebuilding diagnostic geometry every display frame.

See [the V2 review](review/human-motion-v2/README.md) for actual validation, decoded video evidence and remaining visual gates.

The final moving-contact pass places support inside the measured leg-reach envelope and clears stale landing locks before resuming a gait. The four-second running regression enforces less than 2 px drift for both characters; source-art silhouette review remains a separate acceptance gate.
