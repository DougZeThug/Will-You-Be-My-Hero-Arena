# Human Motion V2 — implementation and acceptance review

The shared movement architecture is implemented behind **Arena Lab → Human Motion V2**. Cornhole, running, basketball and fighting use the same motor, planner, graph, native LoongBones adapter, semantic controllers, equipment history and diagnostics. Production Play/Watch, original recordings, source textures and editor exports remain preserved.

This review accepts the infrastructure and mechanical proofs. It does not certify four naturally animated production sports. The existing one-direction artwork cannot visibly face an opposing fighter without another authored view, and athletic poses still need art-direction review beyond passing geometric checks.

## Causes found and corrected

- The recorded adapter resets and samples poses for deterministic seeking. V2 uses persistent native states, started only on graph revisions; the old adapter remains intact.
- Native fade-in pauses its playhead by default. Explicit playback during blending keeps release and visible motion synchronized. Tests compare native and semantic clocks within one animation frame.
- Reset-to-bind channels caused snaps at blend completion. Unkeyed channels now retain lower-layer ownership, and athletic elbow/arm channels are explicit.
- Both feet were held through a moving jump setup. Actions now own contact markers, use a single push-off contact, project landing onto the court and ease touchdown/release corrections. Moving support is planned under the hip within actual leg reach, faster gaits use shorter stance, and returning from an action releases stale landing locks.
- Dan released the basketball after his hand started descending. Release now falls during upward extension. Both launches retain evaluated forward/upward hand velocity with positive downward acceleration.
- The basketball guide hand blends into a native IK target using the actual palm, then eases away after release.
- Repeated attacks could consume input without restarting, and interrupted dodge flags could survive. Cancel-window restarts, reaction interruption and action-owned flags have regression tests.
- Early review sheets compressed the vertical image ratio. Final sheets preserve 1280×760 frames at 640×380, with exact decoded timestamps checked. Encoded frame gaps are rejected.

## Try it without code

Open [Human Motion V2](http://127.0.0.1:3010/human-motion/), choose an event, and press **Play**. Keyboard and two-controller options use the same gameplay path. Review 1×, 0.5× and 0.25×, then pause or step a frame. Skeleton/contact, trails and silhouette controls inspect the actual native rig.

Click **Load measured reference demo** for 125 MediaPipe-analyzed frames from Google's public human-pose demonstration. Enable **Retarget proposal on Dan** and export a timed motion proposal. This is measured source data and proposed skeleton motion, not cornhole mocap or an installed native animation. Seeking reloads the AI baseline, so reload the reference afterward.

Ask Astra to analyze an attached sports video and adapt a specific action. The local development utility exports timestamps, confidence, filtered/normalized landmarks, angles, velocities, accelerations, annotated video and source/model hashes.

## Validation

The full regression passed typecheck, **169,280 pure checks**, **77 browser tests**, production build and production Play/Watch isolation. One optional approved-image baseline suite was skipped. Subsequent V2 edge-case fixes passed **169,290 pure checks**, final typecheck and focused lint, plus **9/9 final V2 browser tests**. Physical controller hardware was not tested; gamepad tests inject two browser-standard devices.

Tests cover native clock alignment, contacts, sampled launch velocity, jumps, combat windows, repeated commands, interrupted dodge, buffered keyboard input, two gamepads, neutral-after-blur, reproducible seek, reference import and unchanged persistence.

Raw evidence remains under ignored `work/qa/human-motion/`. See `regression.log`, `contact-final-browser.log`, `final-pure.log`, `contact-types.log` and `contact-lint.log`. Continuous recordings are in `final-motion/` for cornhole/basketball and `contact-motion/` for the final running/combat logic, each at normal, half and quarter speed. A combat half-speed capture was repeated after an encoded frame gap; the rejected log is retained.

`window.__HERO_MOTION__` exposes detached, bounded motor/graph/native/input/event/attachment snapshots, joint trajectories, contact errors and performance. It cannot set scores or install characters.

## Visual acceptance gates

- **Cornhole:** reviewed side-view artwork and distinct Dan/Doug timing survive the new runtime. Contact error stays below 2 px in the seeded proof. Existing recorded scoring remains unchanged.
- **Running:** separate gait ranges, bent-arm counter-motion, acceleration, jumps and momentum work. The largest reviewed 120 Hz joint step fell from 40.21 px to 16.00 px. The final contact audit caught and corrected stale landing locks that previously reached 80.37 px of drift. Final measured locked-contact errors are 0.96 px for Dan and 0.99 px for Doug; the browser test now enforces less than 2 px. Passing geometry does not establish natural gait: sole articulation and athletic silhouette still need visual authoring before promotion.
- **Basketball:** takeoff, two-hand hold, upward release, flight, landing and recovery work. Guide-hand error measured 6.95 px at full influence; the test limit is 18 px. The existing palm drawings lack individual finger articulation and dedicated basketball follow-through poses.
- **Fighting:** contact rules, attack phases, health, block/dodge, root movement, knockback and buffering work. Doug's mechanical facing is left while his art faces right. Do not call this finished facing animation or mirror his face/logo to hide it. Closed-hand and guard art are missing. Maximum contact error is 3.12 px for Dan and approximately zero for Doug in this short proof; impact/guard foot behavior remains reviewable.
- **Retargeting:** proposals preserve target lengths and timing. Perspective, occlusion, contacts and release need review before native authoring is accepted.

New clips retain `editorRoundTripVerified: false` and `productionInstalled: false`. No artwork redesign was performed. Football and beer pong retain their existing recorded implementations and can adopt the shared path through event-specific authoring.

See [the runtime contract](../../HUMAN-MOTION-V2.md), [reference workflow](../../../motion-reference/README.md) and `validation.json` for source fingerprints and numerical evidence.

Unrecorded desktop Chromium telemetry (12-second basketball run) measured about 56.6 FPS, 18.3 ms p95 frame cadence, 4.45 ms mean update work and 1.68 ms mean render work. These are local CPU/cadence measurements, not a 60 FPS guarantee or GPU timing. The state report includes draw calls, mesh counts and texture estimates.

Reviewed stills: [cornhole](cornhole-normal.png), [measured/proposed skeleton overlay](reference-overlay.png). Continuous footage and silhouettes remain in the reproducible QA folders.

The final court still review also corrected character overlap to follow ground depth, so farther Doug cannot cover Dan's foreground throwing hand. Still images and silhouettes were rechecked after this draw-order adjustment; recorded motion curves/timing are unchanged.
