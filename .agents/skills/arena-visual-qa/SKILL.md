---
name: arena-visual-qa
description: Inspect Arena screenshots and rendered sequences for art, layout, character-grounding, equipment-registration and visual regressions. Use for Arena visual review or after a relevant rendering change.
---

# Arena visual QA

Use the established art and geometry rules in [AGENTS.md](../../../AGENTS.md). Read [the Lab workflow](../../../docs/AI-DEVELOPMENT-WORKFLOW.md) for scenarios and evidence locations.

Reproduce the issue with an existing named Lab scenario before adding a harness. Record scenario, seed, checkpoint, viewport and reduced-motion setting. Use the actual Phaser rendering and serializable state; a mock DOM or diagram cannot validate the game.

Choose the views needed by the change:

- Court framing: full silhouettes, readable UI, one corresponding card anchor per character, feet and contact shadows on the playing surface.
- Character detail: face/outfit identity, natural neck-to-shoulder slope, shirt/sleeve continuity, elbow folds, shorts/leg overlap and planted soles.
- Equipment/contact: horizontal cornhole boards and near/far scale, source contour masking, balls/bags meeting the printed hole/rim/target/cup and correct foreground occlusion.
- Presentation: existing warm printed palette and intact source cards. Avoid treating a new decorative effect as a repair for misregistered geometry.

Capture matching before/after checkpoints. For motion-related findings, inspect the surrounding continuous sequence at normal speed and slow down the suspect transition; a clean still is not enough. Dense geometry/connectivity tests complement visual judgment rather than replace it.

Use `pnpm test:browser` for repeatable screenshots/state checks and `pnpm test:browser:visual` for opt-in comparison against reviewed pixel baselines. Inspect failed image differences before considering `pnpm test:browser:update`; do not bless a defect by changing a baseline. Keep large temporary captures in `work/qa/` and a concise reviewed summary in `docs/review/` when useful.

Report confirmed issues with a reproducible checkpoint and visible symptom. Separate observed defects from optional art preferences. If the task includes fixing issues, preserve the authorized art direction and verify the affected scenes again. Do not redesign the court, characters or UI during a QA-only request.
