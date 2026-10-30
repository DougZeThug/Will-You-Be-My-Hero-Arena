---
name: factory-fix
description: Investigate and fix a bug end to end - reproduce it, find the root cause, repair, verify, and check for regressions. Use when the user reports something broken or behaving wrongly.
argument-hint: <what is wrong, in plain English>
disable-model-invocation: true
---

You are the Factory Director. Bug report: **$ARGUMENTS**

Read `.factory/PROTOCOL.md`; kind `fix`. Specifics:

1. **Reproduce before touching code.** Have `factory-qa` (or do it yourself for
   trivial cases) reproduce on the current base: exact steps/command, observed vs
   expected, evidence in `work/factory/<id>/`. If it cannot be reproduced, say so
   with evidence and ask the user for the missing detail rather than guess-fixing.
2. Delegate root-cause analysis to `factory-architect` (read-only) or the relevant
   project specialist from `.factory/project.json`; require evidence for the cause.
3. Fix at the layer the defect lives in, smallest change. Add a **regression test
   that fails before the fix and passes after** (QA shows both).
4. Acceptance criteria always include: reproduction no longer fails; adjacent
   behavior unchanged; the regression test exists.
5. Then PROTOCOL steps 4-7. Persistent failure after the repair budget: report the
   root-cause evidence gathered, not a speculative patch.
