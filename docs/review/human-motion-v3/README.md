# Human Motion Runtime V3

This pass extends the existing V2 opt-in Lab at `/human-motion/`. It does not replace the engine, redesign the characters or migrate production Play/Watch. See [the pre-change audit](AUDIT.md). The source atlas and rig files remain preserved; the Lab privately derives animation and corrected shoe material ownership at startup. Editor round-trip and production-installation gates remain false.

## Reusable changes

- `MotionContacts` tracks foot, hand, equipment, chest and body interactions. Physical motor landing generates a speed-dependent absorption response; it no longer waits for an unrelated frame in the basketball clip. `FootLock` remains the authority for planted world targets.
- `StrideMatcher` compares actual motor speed with authored cycle travel and duration. It chooses a gait, changes playback within bounded rates and adjusts effector travel without scaling anatomy. Gait changes retain phase and reconcile support markers at that phase.
- The new gait authoring uses a [real measured running cycle](../../../motion-reference/running/README.md). Near-side angles, phase and heel recovery are adapted to each character's original limb lengths. Both knees use the forward-facing IK branch in locomotion/combat. Character rhythm, body lean, looseness and stride traits affect the shared locomotion family.
- `AttachmentManager` now resolves `rightHand`, `leftHand` and `twoHandGrip`, records grab/transfer/release, and preserves its multi-sample release derivative. Basketball rendering uses the same sampled two-hand anchor as gameplay; native guide-hand IK stabilizes that grip and releases independently.
- Basketball authors gather → load → rise → takeoff → release → follow-through. Motor gravity owns flight and landing. The ball uses fixed vertical gravity, a swept descending rim crossing, contact bounce and real misses. Far-lane character, jump, flight and court distance use the same perspective ratio. There is no target-directed horizontal acceleration.
- `CharacterProximity` sweeps simple court-plane body ellipses. Physical body size, desired combat range and attack reach are separate. Normal movement and authored lunges go through the same motor sweep. Combat has a reusable neutral stance and marker-gated hits.
- Doug's existing chest tap has a short contact dwell, two named contact markers, a small body response and independent withdrawal. The existing `PerformanceTimeline`, native transitions, inertial residuals and pose-based recovery policy remain in use; no forced idle is inserted between watching and reacting.
- Limb-length diagnostics, contact records, equipment anchors, root/projectile velocity and body-collision overlays extend the existing review tools. Jerk caused at an explicit landing/hit is counted as impact context, rather than automatically called a bad animation. Other severe discontinuities remain review warnings.

## Actual mesh correction

Running exposed an existing source-material mistake: the vertical x=493 leg partition assigned the tips of the near flip-flop/sneaker to the far foot. When the feet separated, those tips moved independently. `FootMaterialRepair` corrects whole-face ownership with independent seam vertices in the private Lab mesh. Bind positions, UVs, texture pixels and limb lengths are unchanged. This is a documented derived mesh, not unchanged LoongBones editor output. Both the actual shoe silhouette and its sole vertices are reviewed, not just ankle dots.

## Physics choice

The automated V3 checks exercise Phaser 3.90's already bundled Matter primitives for body/obstacle contact and an applied impulse. They work for this scope. The existing deterministic motor and swept projectile solvers remain the gameplay authorities so a second physics clock is unnecessary. No Rapier, paid editor, Spine, SciPy or extra runtime dependency was added. NumPy already supplies the required development filtering.

## Review without code

Open [Human Motion Review](http://127.0.0.1:3010/human-motion/?event=running&actor=dan&take=run-stop). Choose an event, character and action, then **Load take** and **Play**. The character focus selector provides close and Arena views. Use **Pause**, **+1 frame**, the timeline and **0.25× / 0.5× / 1×** to inspect movement.

Use **Body collision**, **Equipment anchors**, **Balance / foot locks**, **Velocity**, **Skeleton**, **Trails** and **Silhouette** as needed. The contact line reports current support, landing absorption, stride fit and maximum limb-length error. **Download state** and **Export motion curves** save machine-readable evidence. These are diagnostic tools, not player UI.

For Doug's reaction, choose [Cornhole / Personality sequence](http://127.0.0.1:3010/human-motion/?event=cornhole&actor=doug&take=personality). It still requires a real scored result. To request future work, say: “Review the latest running at quarter speed, fix any foot drift, and send a new MP4.”

## Scope and quality limits

The one-direction side-view atlas cannot show a right-handed fighter facing the opposite direction without new artwork or mirroring protected identity/logos. Logical facing, spacing and attacks work, but the right-side fighter's visual facing remains an explicit asset gate. No opposite-view art was fabricated in this pass.

Running, basketball and combat remain mechanical/animation proofs rather than finished production sports. The measured gait is retargeted and bounded, not unedited motion capture. Current hand exposures are three authored drawings, not individually articulated fingers. Metrics and screenshots support human review; they do not certify human realism.

## Validation and review

The final regression passed TypeScript, 170,625 simulation/animation checks (including 2,000 seeded contests), 101 browser tests, the production build and production isolation. One optional whole-image baseline test was skipped; no baseline was changed. Existing sleeve, shirt-back, hand/release, controller and recorded-sport checks passed alongside the five new V3 browser cases.

Both athletes completed the measured-gait start/run/stop test. Established full-weight foot locks kept evaluated sole vertices within 0.001 world pixels, without changing limb lengths. This excludes the intentional touchdown blend and does not claim anatomically perfect foot roll. Basketball passed sampled launch/first-step continuity, guide-hand alignment, fixed gravity, actual scoring and physical landing/absorption. Opposing movement, lunges and recovery/withdrawal preserved the configured 98-pixel combined body radius.

All six protected source rig/atlas hashes match their provenance files. The running reference compiler reproduced the checked-in compact curves. Continuous normal/quarter-speed captures include both characters, a close basketball take, Doug's two chest contacts, actual combat AI contact and additional black-silhouette cornhole/running passes. The review uses actual forward runtime frames, not interpolated screenshots.

| Event | Observed FPS | Frame p95 | Update CPU p95 | Render CPU p95 |
|---|---:|---:|---:|---:|
| Cornhole | 59.95 | 17.7 ms | 13.1 ms | 2.6 ms |
| Running | 59.94 | 17.5 ms | 12.7 ms | 2.0 ms |
| Basketball | 59.94 | 17.4 ms | 12.8 ms | 2.1 ms |
| Fighting | 59.95 | 17.8 ms | 11.7 ms | 2.2 ms |

These are isolated headless Chrome observations on the development machine, with no recorder, concurrent test suite or manual stepping. Each sample uses the last bounded 240-frame window. Running was sampled at 4.2 seconds while moving; the other events ran for 12 seconds. Startup slow-frame counts remain in the evidence. These are CPU estimates and do not guarantee mobile/device performance. Earlier captures taken alongside the regression are excluded from this performance table.

See [the complete validation record](validation.json) and [the continuous MP4 review](../../../../Arena-Human-Motion-V3-Review.mp4). Recreate the review with `scripts/capture-human-motion.mjs` and `scripts/motion-reference/package_v3_review.py`; use `scripts/performance-human-motion.mjs` separately for timing. Intermediate failed capture data is excluded from the final media.

The remaining visual work is explicit: opposite-facing combat art, more articulated toe/heel roll and more than three hand drawings. The current pass is ready for human review in the Lab; it is not a claim that every sport now meets the final photoreferenced performance standard.
