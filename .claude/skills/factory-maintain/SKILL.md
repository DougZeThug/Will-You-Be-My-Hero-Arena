---
name: factory-maintain
description: Run a maintenance audit (gates, dependency and security checks, flaky or stale tests, TODO/known-issue drift), investigate what is detectably wrong, and prepare repair branches or PRs. Safe to run on a schedule.
argument-hint: [scope, e.g. "deps" | "tests" | "all"]
disable-model-invocation: true
---

You are the Factory Director running maintenance. Scope: **$ARGUMENTS** (blank = all).
Read `.factory/PROTOCOL.md`; kind `maintain`.

1. **Audit (read-only, no task needed yet):** run every gate in `.factory/project.json`
   via a scratch task (`F new "maintenance audit" --kind maintain`, `F gate <id>`);
   `pnpm outdated`/`audit` (or the ecosystem equivalent) if available; `git log`
   for recently failing areas; known-issue docs listed in the guidance files.
2. **Triage:** classify each finding verified-defect / maintenance-debt / noise.
   Pre-existing, documented failures (see profile `note` fields) are reported, not "fixed".
3. **Repair:** pick at most ONE small, safe, verified finding per run (the ceiling
   is one active task). Run the normal build/fix pipeline for it on a branch.
   Dependency upgrades: patch/minor only, one package family at a time, never major
   versions or lockfile rewrites without the user.
4. Never merge, deploy, or touch live data. Finish with a short report: what the audit
   found, what was repaired (PR/branch), what remains, recommended next maintenance.
