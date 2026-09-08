# Review build status

## Working

Two independent illustrated articulated rigs: Mack and Captain Marmalade, with different human and paw actions, expressions, hand/paw sockets, idle, entrance, locomotion, follow-through, reactions and victory poses. Four automatic events use seeded precomputed recordings. The replay clock controls pause, speed, skip, resize and background recovery. Cornhole version 1.0.1 records a short board slide before the final resting/hole marker; older recordings retain their original paths.

The local results repository persists the full recording and points together before playback. Results appear at contact markers. The active result is withheld from standings/history until its reveal, including after refreshing into the lobby. Each counted entry awards both participants once, exhibitions award none, and later policy changes preserve historical awards. A correction is an appended adjustment linked to the original award.

## Observed checks

- Running cornhole showcase: automatically completed 3–5; replay retained the same result. Still and actual browser-frame GIF capture supplied.
- Counted football: interrupted, resumed, and automatically completed 11–9; Doug received +3 and a total of 6, Jules +0. The completed entry did not award again.
- Beer pong: all six attempts per side completed; an observed 2–2 draw remained an exhibition with zero awards. Blacklight Bloom appeared as a cosmetic round-three effect.
- Basketball: all five attempts per side completed; observed 0–2 exhibition finish and zero awards.
- Production static export and TypeScript checking pass. Engine property-test counts and distributions are in test-results.json.
- Browser checks used the Codex in-app Chromium browser on Windows at 360×800 and 390×844 portrait, 844×390 landscape, 1024×768 tablet, and a wide desktop view. These are viewport emulations, not physical phone/GPU testing. A portrait camera edge issue and landscape stage-height issue were corrected during this pass.

## Still required after user review

The full six-character roster is not complete. Per the requested checkpoint, two more humanoids, another pet, and an unusual Secret rig wait for feedback on this pair's style and motion. The current Secret effect is Blacklight Bloom, a cosmetic arena effect, not a completed Secret competitor.

This prototype is not a final premium animation pass. The entrance has lift, reveal, foreground masking, landing and walk beats, but still needs stronger hand/edge interaction and personality-specific emergence. Repeated entrances do not yet shorten automatically. Football, pong and basketball have functioning authored geometry and event poses; their target materials and contact choreography need further art polish. Some puppet joints, planted-foot transitions and reactions remain visible in motion. The audio is a small synthesized effects mix, without finished crowd ambience, music or commentary. Basketball nets are currently drawn rather than fully simulated.

Imported assets must conform to the normalized human or cat families. The screen maps prepared assets; it is not a skeleton editor, arbitrary retargeter or automatic card-to-animation converter. New anatomy needs authored rig support. Catalog display still uses local fixtures. A shared backend, actual user authentication, server ownership verification and authorized leaderboard writes remain integration work.

Graphics load time, mean frame interval and actual WebGL draw-call counts are exposed in Settings → Performance snapshot. Texture memory is an estimate, not a GPU allocation measurement. Do not interpret this desktop preview as a measured 60 fps guarantee on mobile hardware. Exhaustive asset-failure/context-loss, empty-collection and every-contact visual acceptance testing remains before a full release.

## Feedback checkpoint

Review cartoon style, movement, paw/hand release, bag landing/slide, pacing and readability before roster expansion. Proposed competitive defaults also need review: 3 points for a win, 1 for a draw, 0 for a loss; four counted entries per user; scheduled opponents; no ranked Secret modifier; approximately one-minute contests.

For the first personalized contest, only two real card images are needed, with optional clear reference photos and a short personality/throwing/celebration description for each.

Observed performance sample: 60 fps, 16.7 ms mean frame interval, 10 WebGL draw calls and 51 ms cached arena asset load during basketball playback in the in-app browser. Texture memory was estimated at 15 MB. The viewport changed from 390-pixel portrait to 844-pixel landscape during this run; this is a cached desktop-browser observation, not a cold-load or physical mobile benchmark.
