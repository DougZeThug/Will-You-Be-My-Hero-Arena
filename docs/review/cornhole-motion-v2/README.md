# Cornhole motion revision 2 — audit and validation

Status: current internal `cornhole-recorded` Lab and its weighted motion review. Production Watch/Play and other sports retain their prior rigs. Editor round-trip verification of these newly authored clips remains pending.

## Diagnosed causes

1. **Incorrect anatomical hand.** Imported `L/R` names denote image sides. Both front-facing people had the bag attached to image-right, their anatomical left hand. The dedicated `throwing_hand` socket now follows `hand_L`; off-hand association is swapped. Faces, logos and artwork are not mirrored.
2. **Zero-velocity release key.** Foundation clips used the same ease-in/out on every bone and a stopping key at release. New sparse monotone cubic tracks preserve shared key velocities. `bagRelease` sits inside forward motion, with `release` retained as the engine compatibility marker.
3. **Compressed windup and stretched follow-through.** The old match retimed each clip before/after release independently, compressing a full setup into about 430 ms. New Lab fixtures allocate time from exported clip metadata, include a 120 ms entry blend and play the native throw timeline continuously. Historical recordings and scored targets are unchanged.
4. **Arm-only action.** Throws now overlap pelvis shift, spine/chest counterbalance, clavicle motion, arm swing, soft elbow/wrist action and off-arm balance. Head rotation counterbalances the torso. Existing foot IK keeps the soles planted. Dan's projected swing is more compact; Doug has a deeper backswing and longer reach.
5. **Unrelated projectile start.** The Phaser bag already existed before release, but its flight ignored hand velocity and held tilt. It now inherits evaluated position, tilt and velocity from the same right-hand anchor. The existing object ID and instance continue through release.
6. **Material/occlusion errors.** A mesh triangle sharing shoulder weights is not necessarily arm material. Source-calibrated material ordering places skin over the shirt. Narrow clothing/hand weight boundaries are split locally; Dan has a fabric underlap sampled from adjacent original shorts texels. Doug's cream fingertip edge needed complete face ownership instead of moving only one vertex. These are derived geometry changes; PNG source files remain unchanged.
7. **Chest-pinned inner biceps.** Enlarged decoded video frames exposed a second Dan defect: his original lateral chest blend continued into bare upper-arm skin, and duplicate grid vertices had different ownership around the elbow. Arm cross-sections now have coherent upper-arm/forearm weights below the sleeve, with the shoulder blend ending within the sleeve. Fine fingertip outlines follow whole hand faces. An asset-level regression checks that exposed arm skin cannot retain chest weights.

## Motion and flight

Five shared motion families have character-specific timings and amplitudes: `cornhole_throw_flat_R_*`, `slide`, `airmail`, `roll` and `blocker`. Other semantic shot requests map to the nearest appropriate family, not to fictitious unique clips. Flat and slide remain restrained; airmail raises the release; roll adds bounded wrist/flight rotation. Authored release metadata is extracted into the provenance manifest when building the export, rather than hardcoding release frames in gameplay.

Recorded flight evaluates a constant-acceleration equation from measured hand velocity. Acceleration is solved against the recorded contact and time. The horizontal component accommodates the compressed screen-space court: this is explicitly **outcome-constrained visual physics**, not a new real-world physics or scoring simulation. It uses no path tween or arbitrary Bezier. This keeps release position/velocity continuous and recorded outcomes deterministic.

At board touch the bag compresses slightly, loses speed, slides with friction and settles. Roll preserves its impact orientation. Hole outcomes have a short downward depth/alpha transition. Existing recorded bag interactions remain authoritative; advanced cloth/bag collision simulation was not added. Impact cues and effects use first board touch, while score changes follow the completed board outcome.

## Reproduction

- Main match: `http://127.0.0.1:3010/?scenario=cornhole-recorded`, seed `arena-lab:cornhole-recorded:v1`.
- Weighted review: `/loongbones/doug/`, with `?character=dan` for Dan.
- Compare `pre-release`, `release`, `flight`, `landing`, `recovery` and Doug's matching checkpoints. Use real Play for rhythm; manual stepping is for measurements.
- Authoring: `lab/loongbones/cornhole-motion/`; derived assets and exact-file hashes: `lab/loongbones/assets/cornhole-motion-v2/`.
- `node scripts/build-cornhole-motion.mjs` rebuilds from the preserved source rigs. `scripts/package-cornhole-motion.ps1` creates editor import ZIPs.
- `scripts/audit-cornhole-motion.mjs` captures court and isolated poses/state. `scripts/capture-cornhole-motion.mjs` records real playback for both people and decodes actual frames. The existing sport capture script records the main match.
- Tests: `tests/browser/cornhole-motion.spec.ts`, `dan-main-lab.spec.ts`, `doug-weighted.spec.ts`, plus the existing sports/input/editor suites.

## Evidence and remaining limits

Temporary recordings, decoded frames and state are under `work/qa/cornhole-motion-v2/`. The videos are real Phaser canvas playback, not a slideshow. Decoded timestamps are recorded alongside requested sample times. Screenshot/geometry checks complement visual review; they do not independently prove natural anatomy.

Preserved single-view palms/fingers cannot reveal an undrawn palm or articulate individual fingers. Close-up shirt/arm intersections and missing hidden artwork remain a limit of this source. No new facial expressions, cloth rig, footstep style or 3D rotation is claimed. New motion exports must be checked after LoongBones import/export because Dan's earlier editor round trip lost easing, loops and marker associations.

## Validation — 2026-09-12

- Full aggregate regression passed: TypeScript, 169,248 simulation/animation assertions across 2,000 seeded contests, 54 browser tests, production build and production isolation. The opt-in pixel-baseline comparison was skipped; baselines were not updated.
- After the final Dan skin-ownership correction, TypeScript and all eight focused cornhole/weighted-rig tests passed again. These include the new upper-arm ownership guard, five throws per player, continuous hand velocity at release, the same bag object before/after release, planted sole vertices, replay, asset hash rejection and unchanged recorded scores.
- Real canvas videos cover idle, weight shift, flat throw, airmail and reaction for both players. Fifteen decoded frames per character complement exact-clock screenshots and 120 Hz numerical sampling. Requested and decoded timestamps are retained; selected video frames are visual evidence, not a claim that every frame was manually inspected.
- The main Lab was reset and played using its actual UI. One post-playback observation showed approximately 59.9 FPS and 21.3 ms frame p95, four meshes and a 69.2 MB texture estimate. That rolling sample includes the completed idle state; it is not a whole-match benchmark or a hardware guarantee.
- The final main-match video was also recaptured after the skin correction: fifteen decoded samples, maximum requested/decoded-time discrepancy 39 ms, and no browser errors. Release, immediate flight and Doug's follow-through were visually checked at actual court scale.
- Both editor ZIPs were reopened and all three contained runtime files matched their SHA-256 manifests. Source artwork, original editor exports and original foundation files remain preserved. These new ZIPs still need an actual LoongBones import/export comparison.

Regression review found no scoring, persistence or production-runtime migration. The new release-velocity path is optional and used by the injected Lab rigs; existing paper rigs and other events retain their prior presentation path. Continuous playback, exact-clock geometry and source-weight checks caught different classes of defect, so all three remain required.

Reviewed evidence: [Dan follow-through](dan-follow.png), [Doug follow-through](doug-follow.png), [Dan court release](court-dan-release.png), [Doug court release](court-doug-release.png), and [capture metadata](validation.json). Real playback files remain in ignored `work/qa/cornhole-motion-v2/dan.webm` and `doug.webm`.
