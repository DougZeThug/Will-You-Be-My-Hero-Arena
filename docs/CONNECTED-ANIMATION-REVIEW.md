# Joined shoulder repair — September 11

The previous repair still looked wrong at the shoulders. Its continuous arms met a separate torso with outlined armholes, producing doubled sleeve edges and shoulder-pad shapes. Some interpolated wrist paths also crossed through the shoulder and drove the elbow into an unnatural fold. A zero-gap test did not catch those visual problems.

## What changed

- Rebuilt Dan and Doug's chest, shoulders, sleeves and arms as one joined illustrated surface. Retained their original heads and full legs, clothing identity, cards, arena, equipment and UI.
- Registered shoulder, elbow, palm and neck landmarks directly to each source image. Reworked mesh weights so the shirt stays on the chest while its sleeves follow the arms.
- Changed hand transitions to shoulder-relative arcs and corrected the projected elbow plane. Chest taps keep elbows down; overhead movement turns them outward without a branch flip.
- Adjusted the shorts-to-leg overlap and retained planted soles, contact shadows and warm tint.
- Preserved character-specific gesture tracks, deterministic playback, recorded results and exact palm release. Installed the joined-surface contract and visual-review requirements into the reusable card-to-character workflow.

## Evidence and checks

Revisited the supplied recording and earlier review frames. Made multiple full 60 fps candidate captures, rejected distorted chest-tap/overhead frames, corrected visible leg gaps, and repeated the review. The final enlarged capture contains 1,920 lossless frames at 1800×1080, with both characters in every frame: idle, entrance, celebration, miss, cornhole, football, pong and basketball.

Encoded a 32-second 60 fps video and a 64-second half-speed video. Decoded the normal-speed video back into all 1,920 frames, located the largest frame changes, and inspected dense transition sheets and full-resolution shoulder frames. The final alpha scan found no extra detached regions at its threshold: alpha >= 200, half-resolution, additional connected component >= 25 pixels. The largest incidental extra region was one pixel. The scan uses whole-frame connectivity; splitting at the midpoint falsely labels a wide-reaching hand as detached.

The rebuilt arena completed the 3–5 showcase exhibition and replay with 4 bags per player, zero awarded exhibition points and the existing 3 club points intact. Inspected the updated figures in the actual court and at 0.5× playback. One browser performance snapshot reported 58 fps, 17.3 ms mean interval, 20 draw calls, 292 ms asset load and 68.2 MB estimated texture memory.

TypeScript and the production build pass. The automated suite passes 51,865 checks across 2,000 seeded contests, including source-to-shoulder registration, both players' bounded elbows, adjacent-sample continuity, all-sport palm release and matching release velocity, deterministic seeking, immutable contest data and invalid joined-pack rejection. The portable packer passes 16 checks, including legacy compatibility, nine-image round trips and malformed registration rejection.

## Review files

- `shoulder-repair-complete-60fps.mp4`: final enlarged motion, normal speed.
- `shoulder-repair-complete-half-speed.mp4`: the same motion at half speed.
- `shoulder-repair-pass1-*` and the older `character-motion-*`: historical candidates, superseded by this repair.
- `shoulder-repair-final-*`: current motion in an earlier, smaller review viewport that clipped wide reaches; use the complete versions.

The isolated review uses simple colored hand markers for props; the actual arena retains its illustrated balls and bags. These are still deforming 2D drawings with fixed fingers and expressions. Connectivity and passing tests do not establish perfect anatomy or motion-capture realism. New cards still require visual review of their individual source art and choreography.
