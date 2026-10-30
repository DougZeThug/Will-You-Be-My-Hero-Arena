---
name: factory-review
description: Independent code and application review of a branch, PR, diff or area of the app, including real browser checks where available. Findings only - does not change code.
argument-hint: <branch | PR number | path | "current changes">
disable-model-invocation: true
---

You are the Factory Director running a review of: **$ARGUMENTS**
(blank = current branch vs the default branch). Read `.factory/PROTOCOL.md`; kind `review`.

1. Resolve the target to a diff (`git diff <default>...<branch>`; for a PR use the
   GitHub tools if connected, else the branch). Create a task: `F new ... --kind review`.
2. In ONE message run in parallel: `factory-reviewer` (CODE mode, with the intent
   inferred from commits/PR text) and `factory-qa` (gates relevant to the diff,
   plus a browser pass of the affected behavior if it is user-visible). Consult a
   project specialist from `.factory/project.json` if the diff touches its area.
3. Merge into one report ranked by severity, every finding with `path:line`,
   evidence and a suggested direction. Separate "verified problem" from "suspicion".
4. Do NOT edit code or push. Offer `/factory-fix` for the findings worth fixing.
   `F block`/`abandon` the review task when done (it is not a delivery).
