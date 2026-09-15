---
name: arena-regression-check
description: Review an Arena change against preserved art, gameplay, replay, input and runtime contracts using source diffs and existing automated/Lab evidence. Use before integrating a feature or when asked to check regressions.
---

# Arena regression checking

Read [AGENTS.md](../../../AGENTS.md). Establish the actual change boundary and starting revision or working-tree inventory. Preserve unrelated modified/untracked files. An old Git HEAD is not automatically the previous working Arena; follow [GIT-WORKFLOW.md](../../../docs/GIT-WORKFLOW.md) when the current implementation is not checkpointed.

Inspect the diff for unintended changes to assets, geometry, scoring/rules versions, persistence, input mappings, runtime imports and production bundles. Infrastructure-only changes should not silently redesign UI or rebalance gameplay. Check newly added/untracked files as well as tracked diffs.

Run `pnpm check:regression` and the relevant `pnpm typecheck`, `pnpm test`, `pnpm test:browser` and `pnpm build` checks described in [the workflow](../../../docs/AI-DEVELOPMENT-WORKFLOW.md). Read the reports and failures rather than relying on the last process exit or assertion count. Existing test reports/import examples may regenerate; inspect their meaning before including them.

The aggregate runner also runs `pnpm test:production` after building, checking production API isolation and Play/Watch in a clean browser. Normal browser tests capture screenshots but skip opt-in pixel comparisons. Use `pnpm test:browser:visual` when reviewed baseline comparison is needed. The aggregate result does not replace source-diff review or visual judgment.

Use representative Lab checkpoints from all four Watch sports when simulation, animation, assets or equipment are shared. Use keyboard/controller and live running/fighting scenarios for controller/session/component changes. Confirm Lab debug controls are absent from the production app and do not mutate the regular game's browser storage.

Compare screenshot differences against the intended scope. Inspect a continuous sequence if motion changed. Do not update baselines to make an unexplained regression disappear, and do not treat synthetic gamepad or headless performance results as hardware certification.

Report confirmed regressions first, with scenario/seed/checkpoint, expected behavior and evidence. Separate pre-existing issues and untested limitations from new failures. If fixes are authorized, repair the smallest responsible boundary and rerun affected checks. A clean summary should say what was tested and what remains uncertain rather than claim the whole game is flawless.
