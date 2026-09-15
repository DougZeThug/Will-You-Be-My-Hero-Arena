# Throw mechanics review — 2026-09-12

This pass updates the **existing connected-paper production characters** and equipment presentation. It does not install Dan's experimental LoongBones rig, replace source artwork, or change event scoring. Basketball, football and beer pong remain Watch events; live cornhole shares the new throw form and bag sizing.

## What was wrong

- Watch bags used a 44-pixel texture width while Play used 37. Transparent padding made both smaller than those nominal dimensions. Both now use the same 60-pixel width; the far board's existing depth scale still applies in Watch.
- The hand was part of the forearm surface with no separate wrist articulation. Its equipment socket was the undeformed palm marker. Turning the forearm alone could not produce a cornhole palm-up release or a basketball wrist follow-through.
- Cornhole's short forward target produced a bent-arm curl. The new path swings low from beside the body and extends forward below the shoulder. Airmails use a higher release; rolls retain a different hand attitude.
- Other throwing sports reused too much of the same delivery. They now have separate setup, load, release, follow-through and recovery poses.
- Flat bags visually tumbled like roll bags. Flat/slide shots now preserve a shallow plane with restrained variation; roll/flop/trick shots turn over. Flight-to-board angle and flattening are continuous, including direct holes and misses.

## Footage and coaching references

These are visual references, not motion-capture data or proof that a single technique is mandatory for every player.

| Event | Reference actually inspected | Motion translated into the game |
| --- | --- | --- |
| Cornhole | [Joe2Jock: Cornhole Release Close Up](https://www.youtube.com/watch?v=Tl-krK1b054), stepped through approximately 1:11–1:13; [ACL flat-bag guide](https://www.youtube.com/watch?v=m5_dAGUmZ5A), 1:08; [actual slow-motion throw](https://www.youtube.com/watch?v=8gBsg_-539g), opening/backswing samples | Low underhand load, longer forward swing, outward/upward presentation of the palm, continued follow-through. The ACL guide includes an illustrated explanation; the other clips show actual people. |
| Basketball | [Jr. NBA / Allan Houston: Fundamentals of Shooting](https://www.youtube.com/watch?v=t7ciq_x4138), 2:15–2:30, plus lower-body/setup samples | Shooting pocket on the throwing side, modest leg load, extension above the head, separate guide-hand recovery, downward wrist follow-through. |
| Football | [Wilson / Russell Wilson Passing Academy](https://www.wilson.com/en-us/blog/football/how-tos/how-throw-football-pro), [grip video](https://www.youtube.com/watch?v=o8RWU0-8aAg) at 1:30 and [stance video](https://www.youtube.com/watch?v=-Jx0nrSCcEg) at 1:51, 2:54 and 3:14 | Compact set, raised throwing hand, modest hip/torso weight transfer, overhand release, arm recovery across the body. |
| Beer pong | [ESOBP Final Game / DanTV](https://www.youtube.com/watch?v=1HbnEhQIr8g), 1:45–1:55 tournament samples | Compact upper-body setup, shorter delivery and wrist follow-through, rather than a cornhole pendulum or football windup. |

## Implementation boundary

`SportMechanics.ts` supplies reusable motion data. Watch retimes its release key to the existing recording's semantic release time with continuous spline tangents. Play maps the same cornhole vocabulary to its existing release marker; charge windows and simulation timing stay unchanged. Character rituals, pace and reactions remain profile-driven.

`hand-geometry.ts` supplies a wrist frame within the existing continuous illustration. The joined mesh and held-equipment socket use the same transform. Wrist weights are fixed in source space; two frames are calculated per character update rather than recalculating trigonometry for every vertex. Existing zero-wrist clips keep their original appearance. The mesh remains connected through the shoulders.

This is a **2D projection**, with an existing open-palm drawing. Wrist bend and palm foreshortening do not create separately articulated fingers or unseen hand views. A football grip wrapping the laces and a true beer-pong fingertip pinch still require authored hand attachments in the future weighted rig. This pass must not be described as completing that rig or achieving motion-capture realism. Do not substitute palm-up cornhole mechanics for all other sports.

## Verification and reproducibility

- `node scripts/regression.mjs`: typecheck, 169,248 pure assertions / 2,000 seeded contests, **47 browser tests passed**, production build and production Play/Watch isolation passed. The optional approved-pixel-baseline test was skipped; existing baselines were not silently replaced.
- New tests exercise both Dan and Doug, four event forms and three anticipation durations. They check planted ankles, release-position and velocity continuity, finite connected surfaces, long cornhole extension, above-head basketball extension and overhand football release. Every cornhole shot style is checked for a discontinuity at contact and resolution.
- Four new browser tests inspect actual rendered held/released equipment against the wrist socket, enlarged bag dimensions, first flight movement and unchanged recording hashes. Existing physical-key and synthetic Xbox/PlayStation/generic-controller tests pass. No physical gamepad was used.
- Normal-speed canvas recordings, decoded motion frames, screenshots and state dumps are in ignored `work/qa/sport-mechanics/`. These are local evidence, not new production assets. Decode timestamps are recorded alongside requested sample times; a stale frame must not be called a neighboring release frame.
- `node scripts/capture-sport-mechanics.mjs` captures all four Watch events from the intro. `--live` records a real browser keyboard charge/release through live cornhole. `--stills` captures fixed checkpoints; `--decode-only` re-examines saved clips. `--before` addresses the preserved pre-change comparison folder and should only be used intentionally.
- `work/qa/regression.json`, `work/qa/production-smoke.json` and `work/qa/sport-mechanics/geometry.json` contain machine-readable evidence. The geometry report's mesh maximum includes transparent atlas vertices; it is not an anatomical quality score. Rendered motion inspection remains required.

No new animation dependency was needed. Phaser's existing clock, connected mesh and semantic animation events support these changes without adding another animation scheduler.
