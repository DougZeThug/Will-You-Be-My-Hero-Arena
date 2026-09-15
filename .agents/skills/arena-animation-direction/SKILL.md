---
name: arena-animation-direction
description: Direct and refine Arena character motion while preserving approved artwork, connected rig anatomy, semantic markers and distinct personality. Use for entrances, throws, locomotion, reactions and celebration polish.
---

# Arena animation direction

Start with [AGENTS.md](../../../AGENTS.md), the relevant character profile and the failing clip in the current registry. Use `character-doug` or `character-dan` plus the affected event scenario from [Arena Lab](../../../docs/AI-DEVELOPMENT-WORKFLOW.md).

Identify the motion problem in performance terms before changing curves: anticipation too long, shoulder fold, drifting planted foot, abrupt pose recovery, missed palm release, repeated gesture or wrong reaction intensity. Watch the full action at normal speed, then inspect neighboring frames at the problem.

The current actors are calibrated connected paper meshes. Preserve joined chest/shoulder/sleeve surfaces, artwork, rest posture and registered palms/feet. Do not split outlined arms from the torso or compensate with extra wobble. Their fixed fingers and facial drawings are real authoring limits; new anatomy or expressions require authored assets.

Use independently authored effector paths, bounded interpolation, anticipation, follow-through and recovery. Character differences belong in profiles, clip overrides, rhythm, gesture pools and contextual selection. Compare Dan's restrained behavior with Doug's expressive behavior; scaling the same motion is insufficient for a request for distinctive performance.

Keep release/contact/hitbox/cancel/footstep moments as semantic markers. Held equipment follows the evaluated socket until release. Score changes remain owned by event rules. Validate same-clip restarts, transitions and pause/seek behavior when modifying timeline code. Layer only where body continuity and foot placement remain sound.

Inspect entry, extremes and recovery in isolated and on-court views. Check planted feet, elbow branch continuity, shoulder/neck shape, palm contact and equipment trajectory. Run relevant animation/geometry tests plus browser scenarios; review continuous motion after tests pass. Do not describe finite coordinates or connected alpha regions as proof of natural movement.

Save reproducible before/after evidence under `work/qa/`. Report the performance change, clips/profiles affected, tests and remaining drawing limitations. Keep a new permanent rule only if it addresses a recurring authoring constraint.
