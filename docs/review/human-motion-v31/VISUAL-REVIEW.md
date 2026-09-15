# Continuous motion review

The V3.1 MP4 is 153.2 seconds, 1,280 × 760, 30 fps H.264. All 4,596 frames decoded successfully. The complete timeline was inspected sequentially through 307 half-second observations across 26 contact sheets, alongside the individual take sheets at their actual gameplay checkpoints. The MP4 is made from continuous browser recordings, not interpolated stills.

## Observations

- Doug's near/right arm retains a consistent silhouette through the backswing, release and follow-through. The shirt back remains present; the corrected sleeve/arm overlap survives the forward swing. No anatomical scale changes were used.
- Running shows acceleration lean, alternating contact, reduced knee lift and a final settling stance. Quarter-speed review exposes the planted/support relationship; actual sole vertices are checked separately. The start/stop remains a brief athletic proof, not a complete obstacle-course animation set.
- Basketball shows loading before extension, visible world-space flight of the feet, a separate ball release, and knee/pelvis compression after contact. The camera stays referenced to the floor during the jump. The guided-hand material is still limited by the existing illustrated source.
- Opposite-facing combat keeps the original near-arm semantics and readable front/rear clothing treatment. Bodies stay separate while attack hands intentionally enter the opposing guard. Movement remains a compact contact/range proof, not a finished boxing performance.
- The first raised far-arm guard was rejected: it exposed a thin source-edge strip. Final combat recordings use a restrained far-arm counterbalance. A full two-arm guard and lead-jab/rear-cross sequence require authored hidden-arm surfaces and proper fist exposures. This is not solved by widening a bone or hiding the defect with effects.
- Chest tap contains an approach, contact hold, second response and independent release. Bag flip is an equipment-independent prop action; it does not manufacture a score. The current fist-pump clip still uses the available hand drawing, not individual finger animation.
- Doug's four silhouette takes preserve the common build and movement character. Cornhole and running silhouettes are included in the MP4; basketball and final combat silhouette recordings remain in the full capture matrix.

## Evidence and reproduction

- Before: `work/qa/v31-before/video-00.jpg` through `video-17.jpg` and the explicit `arm-original/` folder.
- Final captures: `work/qa/v31-review/{dan,doug,combat,silhouette,chestTap,bagFlip,fistPump}/`.
- Whole-video inspection: `work/qa/v31-review/full-review/video-00.jpg` through `video-25.jpg`.
- Each capture's JSON records event, playback rate, simulation/wall timestamps, decoded frame observations, final state and browser errors.
- `scripts/capture-motion-v31.mjs` recreates all takes; `--combat-only` replaces the combat subset. `playlist.json` records the MP4 sequence. `scripts/motion-reference/review-video.py` recreates chronological review sheets.

Numerical integrity/contact checks supplement these observations. They do not prove lifelike movement, hidden-surface completeness or a verified editor round trip. The current proof remains opt-in under `/human-motion/`.
