# LoongBones / Phaser compatibility evidence

2026-09-11. **Native runtime proof passes; fresh LoongBones editor-export gate remains open.** See [the compatibility decision and workflow](../../LOONGBONES-COMPATIBILITY.md).

This review covers Phaser 3.90.0, pinned official DragonBones core 5.7.000, the unmodified upstream mecha_1406 5.5 export, and an Arena-authored weighted-mesh fixture. It does not certify a production Dan/Doug rig or AI-assisted LoongBones authoring.

## Reviewed artifacts

- [Proof page](proof-page.png): actual local Phaser WebGL scene and diagnostic UI.
- [Normal-speed capture](native-motion.webm): one-second encoder warm-up, followed by authored walk and fixture throw/release. The warm-up avoids missing initial frames from browser encoder startup.
- Decoded presented frames: [anticipation](anticipation.png), [release](release.png), [flight](flight.png). The strip remains connected, the bag follows its hand during anticipation and separates for flight. These are skinning/attachment checks, not an anatomical character approval.
- [State and timing](state.json): animation tracks, actual bone matrices/vertices, event log, socket/projectile position, decoded presentation timestamps and independent unrecorded timing sample. The authored release is 0.333333 seconds and dispatch was observed at 0.341667, within one 120 Hz tick.
- [Production Play](production-play.png) and [production Watch](production-watch.png): existing Arena game loaded in isolated storage during production smoke checks.

The unrecorded headless desktop sample collected 170 frame durations with p95 17.92 ms. This small two-object test is not a performance promise for a production arena or physical device.

## Automated checks

- [Full five-stage regression](regression.json): typecheck, simulation/animation, browser, production build and production isolation passed.
- [Pure tests](pure-tests.json): 161,408 checks, 2,000 seeded contests.
- [Browser suite summary](browser-summary.json): 30 passed; one opt-in visual comparison skipped in the normal suite. The 36 MB raw `browser-results.json` remains local-only; its SHA-256 is preserved in the summary.
- [Separate visual comparison](visual-results.json): six existing approved canvas baselines passed; no baselines updated.
- Four focused new proof tests cover blending, mirrored transforms, analytical weighted-vertex position, FFD, once-only authored release, hand attachment, pause/replay, file import, unsupported-version rejection and local-only file handling.

The build retains the repository's existing large-chunk and dynamic-import warnings. No new production runtime dependency or rendering module was introduced. The production smoke scan now excludes both Lab globals from the shipped JS/HTML/CSS and verifies Play/Watch and practice-save invariants.

## Regression review conclusion

No production architecture, gameplay, source character atlas, card, board, background or match rule was changed for this trial. Experimental runtime, adapters, sample art and UI remain under `lab/loongbones/`; Dan's new unfitted body-source trial remains under `lab/assets/dan-source/`. The existing shared character/input/controller systems are untouched. There was no publish, commit, account creation or purchase.

Remaining gate: sign in to LoongBones or supply an actual editor export, then record editor version/export settings and hashes and run that export through this loader. Advanced 6.x features and Dan's real weighted rig require separate verification before migration. Passing the older DragonBones sample must not be relabeled as passing the editor gate.
