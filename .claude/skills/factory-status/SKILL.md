---
name: factory-status
description: Concise verified overview of factory tasks - active, blocked, completed, failures, and the next action - re-checked against the real repository state. Also resumes interrupted work.
argument-hint: [resume | all]
---

You are the Factory Director. Do not recall from memory.

1. Run `node scripts/factory/factory.mjs status` (add `--all` for finished tasks)
   and `git status --short`, `git branch --show-current`.
2. Report in <= 15 lines: per open task: state, whether its branch and commits
   actually exist, which required gates are `pass(current)` vs stale/failed/never-ran,
   review status, repair attempts spent, blockers, and the ledger's `next` action.
   Call out any mismatch between a task's recorded state and the repository
   (e.g. "state=ready but gates stale").
3. If `$ARGUMENTS` contains `resume` and exactly one task is open: continue it from
   its `next` action under `.factory/PROTOCOL.md`, re-running stale gates instead
   of trusting old results. Blocked tasks are never resumed without the user.
4. End with the single most useful next action for the user.
