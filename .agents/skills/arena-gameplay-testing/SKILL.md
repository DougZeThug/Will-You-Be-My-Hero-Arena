---
name: arena-gameplay-testing
description: Test Arena event rules, deterministic outcomes, state transitions and live mechanics using existing Lab scenarios and pure simulation tests. Use for gameplay fixes, event integration or mechanics validation.
---

# Arena gameplay testing

Read [AGENTS.md](../../../AGENTS.md) and the relevant event contract. [PLAYABLE-ENGINE.md](../../../docs/PLAYABLE-ENGINE.md) distinguishes direct Play from recorded Watch. Do not assume basketball, football or beer pong has live controls because its recorded scenario exists.

First reproduce with the nearest named [Lab scenario](../../../docs/AI-DEVELOPMENT-WORKFLOW.md). Keep seed, participants, options and input sequence fixed. Use `getState()` for meaningful state assertions and semantic `input(...)` for controlled mechanics; exercise raw keyboard/gamepad adapters separately when they are part of the change.

Test the rule boundary affected:

- Recorded sports: authoritative contact, equal attempt budgets, reveal/score timing, deterministic replay, no duplicated points and preserved historical recordings.
- Live precision: valid aiming/charging/release states, timing/aim affecting actual landing, evaluated-hand detachment, contact before score and next-player handoff.
- Running: acceleration/stamina, lane or free movement, obstacle contact, jump/slide state and finish conditions.
- Fighting: range/direction, startup/active/recovery, independent hitboxes, block/dodge, reaction/knockback and buffered chaining at cancel windows.

Use pure tests for rule outcomes and browser tests for integration/rendered contacts. Cover just-before/at/after important boundaries and a failure path. Never set internal scores, health or success flags to make a scenario pass. A short reproducible input sequence is preferable to waiting for random AI behavior.

Run `pnpm test` and relevant `pnpm test:browser` scenarios, then typecheck/build for implementation changes. Shared code requires cross-event and Play/Watch checks. Keep the user's ledger and installed characters untouched by using isolated test storage.

Report expected versus observed outcome, reproduction inputs, seed and scenario. Distinguish completed tests, intentionally unavailable event features and unresolved failures. Add a lasting test when it guards the actual behavior that failed, not the incidental implementation shape.
