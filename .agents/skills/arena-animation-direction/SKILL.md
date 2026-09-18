---
name: arena-animation-direction
description: Direct and refine current Arena character motion while preserving approved artwork, runtime boundaries, immutable recordings, semantic markers, and distinct personality.
---

# Arena animation direction

Read [the current handoff](../../../docs/ANIMATION-HANDOFF.md) and inspect the
imports at the affected entry point before choosing a review scene.

## Choose the correct surface

- **Recorded cornhole Watch (current Dan/Doug performance):** use the normal
  Watch flow, `/performance/`, and `cornhole-performance`. This path is
  `ArenaStage` → `performanceMatchProvider` →
  `CharacterPerformanceController` → `LoongBonesAdapter` → side-view-v3 assets.
- **Legacy connected-paper comparison:** use `character-doug`, `character-dan`,
  or `cornhole-paper-reference` only when the task explicitly concerns those
  old paper rigs. They are not a proxy for current Watch animation.
- **Other recorded Watch sports:** reproduce their own recorded scenario; they
  do not use the cornhole performance provider.
- **Live Play:** reproduce the relevant live scenario and preserve its
  fixed-step rules and semantic controller path.
- **Human Motion V2/V3:** use only for an explicitly experimental Human Motion
  task. Do not promote it into Play or Watch incidentally.

## Direct and verify the motion

State the visible problem before changing curves: timing, shoulder or wrist
join, planted-foot drift, IK branch, palm/release registration, abrupt recovery,
or reaction choice. Capture the current action at normal speed, then inspect
neighboring frames at anticipation, release/contact, follow-through, and
recovery. Keep the scenario, seed, viewport, runtime revision, profile, and
asset identity with the evidence.

Preserve approved likeness, protected art, connected chest/shoulder/sleeve
surfaces, opaque hands, registered palms/feet, lane-depth scaling, and original
asset provenance. Do not solve motion by mirroring faces/logos, stretching a
limb, moving a locked support foot, dissolving hand silhouettes, or rewriting
recorded outcome/timing facts. Held equipment follows the evaluated hand until
the semantic release marker; scoring remains owned by event rules.

Character differences belong in profiles, authored technique, rhythm, gesture
pools, and contextual selection—not indiscriminate wobble or a scaled copy of
one performance. Preserve action priority, same-clip restarts, native phase,
pause/seek behavior, and result acknowledgments after revealed results.

Run the smallest relevant pure and browser checks while iterating. For a motion
change, finish with continuous playback in the affected real runtime plus its
matching isolated surface; test Play/other Watch sports only if shared code was
touched. Numeric geometry and marker checks complement, but never replace,
rendered review. Save disposable evidence under `work/qa/` and update
`docs/ANIMATION-HANDOFF.md` rather than appending a new chronological router.
