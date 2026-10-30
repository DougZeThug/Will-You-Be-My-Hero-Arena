---
name: factory-adopt
description: Install or adapt the factory in another repository - copy the generic kit, generate a project profile from that repo's real scripts and structure, and verify it with the doctor.
argument-hint: <path to the target repository>
disable-model-invocation: true
---

Adopt the factory into: **$ARGUMENTS**

1. Read `.factory/kit.json` (the manifest of generic files) and `.factory/README.md`
   "Adopting".
2. Run `node scripts/factory/install.mjs --target "$ARGUMENTS"` (add `--dry-run` first
   if the target already has a `.claude/`; it never overwrites without `--force`).
3. In the target repo, inspect it (package.json scripts, CI workflows, test setup,
   art/asset dirs, migrations, env files, deploy config) and complete the generated
   `.factory/project.json`: real gates with real commands, `protectedPaths` (approved
   art, baselines, migrations, seed/league data), `deniedCommands`, `specialists`
   (reuse any existing agents), `uiSurfaces`, `previewCommand`. Do not copy another
   project's assumptions; delete anything you cannot justify.
4. Run `node scripts/factory/factory.mjs doctor` in the target and fix every FAIL.
5. Run one trivial task through `/factory-fix` or `/factory-build` there to prove the
   gates run, and report what the user must still do (branch protection, secrets).
