# Factory protocol (the Director follows this; skills only add what differs)

The **Director is the main Claude Code session** running a `/factory-*` skill. It
talks to the user and owns the plan. Agents (`factory-*`) do the work and return
reports. CLI: `node scripts/factory/factory.mjs` (alias `F` below). Project facts
come from `.factory/project.json`; never hard-code them.

## 0. Right-size it
- **trivial** (one obvious file/constant/typo/doc): skip agents. `F new`, edit,
  run the cheap gates, one `factory-reviewer` CODE pass only if logic changed.
- **normal**: architect -> builder -> qa -> reviewer.
- **complex** (cross-cutting, risky, protected areas, >5 files): add a
  `factory-reviewer` PLAN pass, consult project specialists, split only if file
  ownership is disjoint.
Never use more agents than the task needs. Reviewers can run in parallel; only
ONE write-capable agent (builder/ui/repair) or QA runs at a time (checks read the
tree; `pnpm test`-style gates may regenerate tracked files).

## 1. Intake
Read the request, `git status`, `F status` (resume if the user is continuing an
open task - verify from the ledger and git, not from memory). Ask the user ONLY
if a missing product decision changes the outcome (then recommend a default and
proceed if they do not answer in a non-interactive run). `F new "<title>" --kind K`
(refuses past the concurrency ceiling). Switch to the task branch
(`git switch -c <branch>`; never work on the default branch). Do not discard
unrelated uncommitted work: stop and report it.

## 2. Plan
Invoke `factory-architect` with a self-contained brief (request, relevant paths
you already know, out of scope). Write the plan to `.factory/tasks/<id>.plan.md`
(concise; it is durable state). Record criteria:
`F set <id> --plan .factory/tasks/<id>.plan.md --criterion "one;;two"`.
For `complex`, run `factory-reviewer` in PLAN mode and revise until APPROVE.
Then `F plan-ok <id>`. Routine technical choices are yours, not the user's.

## 3. Build
`F set <id> --state building`. Invoke `factory-builder` (or `factory-ui` for
interface work) with: the plan path, file-ownership list, acceptance criteria,
branch name. Parallel builders only with disjoint ownership lists, each in its own
worktree (`git worktree add`), merged by you. Check the builder's claim against
`git diff --stat` yourself.

## 4. Verify (independent)
Invoke `factory-qa` with the task id, criteria and gates to run. QA runs
`F gate <id>` and drives the real app. A builder's "tests pass" is never
evidence; ledger gate results tied to the current tree are.

## 5. Repair (bounded)
For each distinct failure: `F repair <id> <issue-key>` (exit 3 = budget of 3
spent -> STOP, `blocked`, report evidence; do not try a fourth variation).
Invoke `factory-repair` with the evidence and attempts remaining; rerun the failed
check via `F gate`. If the same failure recurs with the same cause, escalate early.
Never accept: skipped/weakened tests, updated baselines, widened tolerances,
removed functionality.

## 6. Review
After QA is PASS (or accepted PARTIAL), invoke `factory-reviewer` in CODE mode with
`baseSha`, criteria and QA evidence paths. Record: `F review <id> --verdict ...`.
Findings of blocker/major severity go back through step 5 (`review:N` keys), then
re-review. Any edit after approval makes the review and gates stale.

## 7. Deliver
`F ready <id>` must succeed (gates green on the CURRENT tree, review approved on
the CURRENT tree, no protected-path changes). If it refuses, fix the problem it
names; never edit the ledger by hand. Commit on the task branch, `git push -u
origin <branch>`, open a PR if a GitHub tool is available (never merge), then
`F finish <id> --pr URL`. Final report to the user, <= 25 lines: what changed in
plain English, screenshots (paths or PR links), gate table with timings, repair
attempts, what was NOT verified, decisions needing the user, recommended next
step. Mark honestly: unverified is "not verified", not "done".

## Boundaries (enforced by `.claude/settings.json` + `.claude/hooks/factory-guard.mjs`)
No merge/deploy/migration/force-push; no commits on default or protected
branches; no credentials; no edits to protected paths without explicit user
approval; never silence a failing check. If a guard blocks you, that is the
system working: report the decision needed.
