# Release hand correction — pass 3

Two narrowly scoped right-hand drawings generated with OpenAI ImageGen on 2026-09-15, using each character's existing `cornhole-side-v3` atlas as the visual reference. Direction: three-quarter edge/back of hand, close gently uncurling fingers, straight wrist, black ink and warm cel shading. Original character exports are unchanged.

`*-release-source.png` preserves each complete generated output. Run `node scripts/author-release-hands.mjs` to reproduce the unscaled transparent crops `*-release.png`. `ReleaseHands.ts` records the crop-space wrist pivot, uniform artwork scale and orientation. The native image slot is attached to the existing `hand_L`; no limb length, mesh registration, or anatomical scale changes are involved. Only one opaque throwing-hand exposure is visible.

The correction is used from 70 ms before release through 320 ms afterward. Existing grip, relaxed hand and chest-contact palm remain. These are discrete hand drawings, not independently animated fingers. This is a runtime derivative; no editor export/import round-trip was performed.
