# Reference fidelity and character performance — 2026-09-14

This extends the existing Human Motion V2 Lab at `/human-motion/`. The character drawings, source rigs, mesh weights, court art and production Play/Watch runtimes are preserved. These native animation clips are derived at Lab startup; they are not new returned LoongBones editor exports. Editor round-trip verification and production installation remain separate gates.

## Audit and corrections

The preceding throw already involved root motion, pelvis, distributed spine, translating clavicle, soft elbow, hand exposures, gaze compensation and planted-leg IK. Its remaining forward extension came from the underlying authored curves, which reached maximum extension late and stayed near it before recovery. A shared organic overlay could not correct that source timing. Existing reactions were also selected as basic event success/failure clips rather than a character-owned performance.

The new standard throw uses actual measured shoulder-to-elbow orientation, elbow bend, torso pitch and normalized hip displacement from [Perfect Throwing a Cornhole Bag — demonstration #1](https://www.youtube.com/watch?v=MQFTtLG3Vxo&t=330s). `motion-reference/cornhole/measured.json` preserves 158 MediaPipe/OpenCV samples, timestamps, confidence, normalized positions, velocities and accelerations. The local review excerpt is 5.3 seconds beginning at 330 seconds, cropped to the demonstrator in the left panel. Original-source hash, model hash and processing versions are recorded in the compiled JSON.

The near shoulder, elbow, wrist, hip, knee and ankle exceeded confidence 0.6 in every sampled frame. The far elbow/wrist/knee were occluded and are **not measured motion inputs**. The far arm's counterbalance, hand variants, clavicle translation and foot constraints remain explicitly authored. Pose confidence is not calibrated motion-capture accuracy; the source does not measure fingers, forces or true center of mass.

`compile_cornhole.py` applies aspect-correct angle extraction, a five-frame binomial low-pass, curve reduction, bounded amplitudes and a declared time warp. Source release is annotated at excerpt time 2.26 seconds (approximately ±0.05 seconds). The instructor's extended demonstration hold from 2.72–3.30 seconds is deliberately compressed into six authored frames. This is an editorial adaptation, not an assertion that the source moved that quickly. Media-time derivatives remain available separately from the retimed runtime derivatives.

The resulting data drives native LoongBones-compatible rotation/translation tracks through the current animation graph. Target limb lengths and scales remain unchanged. Torso pitch is distributed through pelvis/lower spine/mid spine/chest with small delays; measured global arm angle is converted through the animated parents. The same evaluated right-hand socket and recent hand history still initialize the actual cornhole projectile. Fixed gravity, board contact and scoring were not modified to force the showcase result.

## Reusable personality

- `CharacterMotionSignature`: character-level rhythm, looseness, body involvement, gesture energy, sweep and recovery traits, separate from gameplay ability. Cornhole authoring, basketball body response and shared organic settling/idle consume these traits. Stance width is reserved at 1; no anatomy is stretched.
- `PerformanceTimeline`: shared PRE_ACTION → ACTION → WATCHING → RESULT → REACTION → RECOVERY orchestration. It accepts semantic facts from an event, waits for perception time and safe transition, and requests shared gestures. It never writes a score.
- `PerformancePersonality` / `GestureMemory`: weighted semantic pools, seeded choices, equipment filtering and bounded recent-use suppression. Doug favors expressive gestures; Dan favors quiet nods and breath resets. Nine semantic choices include an intentional no-gesture option.
- `authoring/gestures.ts`: native reusable bag flip, chest tap, fist pump, nod, head shake, shrug, breath reset and shoulder roll. The chest tap has two actual shirt-contact poses and semantic contact markers. Open/grip/relaxed drawings are existing assets; there is no new finger rig.
- `PropPerformance`: a short non-scoring toss using the currently held bag. Toss and catch are animation markers. It does not increment a scoring release or create a second competition bag.

The forced personality take chooses the bag flip and a chest tap **only after an actual success**. A miss still requests failure behavior. Cornhole and basketball pass their result into the same timeline and use the same `gesture.chestTap` native clip; there is no basketball-specific celebration implementation. Basketball retains its existing target-constrained proof trajectory and is not newly claimed to have cornhole's free-flight solver.

No explicit idle/reset clip is inserted between performance stages. Native blends retain the outgoing posture; athletic recovery, watching and safe cancel markers govern when a gesture can start.

## Review without writing code

Open [Doug's full sequence](http://127.0.0.1:3010/human-motion/?event=cornhole&actor=doug&take=personality&focus=doug), then press **Play**. Choose **0.5×** or **0.25×** for slower review. The sequence is bag flip, throw, watch, scored result, two chest taps, settle.

Use **Arena scale** to review gameplay size. For the baseline, choose a character and **Flat throw**, then **Load take**. Use **Throw breakdown pose**, **Pause**, **+1 frame** or the timeline to inspect the native animation. Silhouette, skeleton, joint trails, balance/foot locks and velocity controls remain available. The diagnostic line shows phase, support estimate, performance/reaction and evaluated hand velocity in world pixels per second.

Expand **Human reference / character — synchronized comparison** to load the measured demonstration beside the actual Phaser render. Play, pause, speed and frame stepping share the runtime clock and its explicit source mapping. Green landmarks are confidence-gated; the red trail is the measured wrist. The rendered panel copies inside Phaser's postrender event to avoid a discarded WebGL buffer. Source video and pose estimation are development-only; no ML library ships in the game.

Open [Doug's basketball sequence](http://127.0.0.1:3010/human-motion/?event=basketball&actor=doug&take=personality&focus=doug) to see the same chest tap after a make. His bag-only ritual is filtered out.

## Reproduction and evidence

- Compile the checked-in measured export with `scripts/motion-reference/compile_cornhole.py`; the raw measurements and processing metadata remain reviewable.
- `scripts/review-performance.mjs`: deterministic gameplay and close-up checkpoints, including both chest contacts.
- `scripts/audit-reference-throw.mjs`: evaluated body paths, angles, release kinematics and foot locks.
- `tests/performance-timeline-tests.mjs`: deterministic gesture memory, equipment filtering, deferred launch, factual result gating, perception timing, safe transitions and cross-event reuse.
- `tests/browser/performance-personality.spec.ts`: actual bag flip/catch, physics score before reaction, two chest-region contacts, shared basketball clip and synchronized comparison with nonblank rendered pixels.
- Existing reference-throw tests continue covering both characters × five shots, actual sole vertices, hand exposure and launch tangent.
- `scripts/capture-human-motion.mjs` records continuous forward gameplay at 1×, 0.5× and 0.25× and decodes game-time checkpoints. `package_personality_review.py` creates the separate H.264 review MP4. Timing captures and detailed state remain under ignored `work/qa/fidelity-personality/`.

See `validation.json` for the final checks and measurements. Numerical checks support visual review; they do not certify human realism. No pixel baselines are silently replaced.

Final validation: **96 browser tests passed**, one optional pixel-baseline comparison skipped, **170,340 simulation/animation checks passed**, plus type checking, production build and production-isolation checks. All six protected rig/atlas/texture hashes match. The compiled motion reproduces from the checked-in measured samples. Doug's sampled time within five degrees of maximum forward upper-arm extension fell from 0.358 to 0.158 seconds; this is a timing diagnostic, not a human-realism score.

The **56.3-second** `outputs/Arena-Reference-and-Personality-Review.mp4` contains seven continuous captures: Arena scale, Doug at normal/half/quarter speed, Dan at normal speed, basketball wide view, and basketball close-up. H.264/yuv420p, 1280×760, 30 fps; full decode passed. Only the recorder's pre-action warm-up is trimmed. A separate unrecorded local Chromium run measured 59.9 fps, 17.7 ms p95 frame time, 9.7 ms p95 update CPU time and 2.2 ms p95 render CPU time.
