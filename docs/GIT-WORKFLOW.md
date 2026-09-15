# Arena Git and worktree workflow

The user can ask Astra to perform this workflow. No Git commands or source editing are required from the user.

## Preserve the current Arena first

At the infrastructure audit on September 11, 2026, this repository had one old commit (`3f45921`, blacklight clubhouse), one `main` worktree, no remote, and substantial newer modified/untracked source and artwork. **That old commit does not represent the current game.** Recheck status before acting; this note is an audit snapshot, not a permanent assumption.

Before creating a feature worktree from a Git revision, capture the intended current source, assets, tests and documentation in a reviewed checkpoint. Do not discard, stash blindly, or omit untracked character/engine files. Exclude dependencies, build output, caches, browser profiles, secrets and temporary captures. A dirty-tree inventory is useful evidence, but is not a backup of untracked file contents.

Useful request:

> Create a reviewed checkpoint of the current Arena, preserving all current source and art. Show me what is included, then prepare an isolated worktree for the next change.

The infrastructure setup itself does not commit, push, create a remote or rewrite history. Git publication follows the user's requested scope.

## One bounded feature per branch

Use a short branch such as `codex/throw-release-polish` with a corresponding worktree. Start from the latest reviewed Arena checkpoint. A worktree gives a separate working directory while sharing Git history; it does not automatically copy unsaved/untracked work from another checkout. See the [official Codex worktree guide](https://learn.chatgpt.com/docs/environments/git-worktrees).

Astra should record the source revision, purpose and acceptance criteria, install dependencies from the committed lockfile, then reproduce the relevant Lab scenario before changing code. Give concurrent servers distinct local ports. Keep captures in that worktree's ignored `work/qa/` folder; do not share mutable fixtures or browser storage across tasks.

When parallel agent work is requested, assign bounded file ownership or separate worktrees. Shared contracts should be agreed before editing. Worktree isolation does not replace integration testing.

Useful request:

> Improve Doug's release in an isolated worktree. Preserve the art and scoring. Reproduce the issue in Arena Lab, compare the motion, and run the regression checks before bringing it back.

## Review before integration

Keep commits focused and explain the resulting behavior. Include the scenario/test change with the fix when they establish the same invariant. Keep deliberate art changes separate enough to inspect their provenance and visual comparison.

Before integration, Astra should:

1. Inspect the final diff against its actual starting revision, including added assets and generated reports.
2. Run relevant unit/browser checks and the regression review; inspect unexpected visual changes.
3. Reconcile changes to shared files and rerun affected checks on the combined result.
4. Report what changed, evidence, current limitations and any unresolved conflict.

Use a normal merge, cherry-pick or reviewable pull request appropriate to the existing repository and user request. Do not invent a remote, force-push, rewrite other work or treat passing screenshots as permission to publish.

## Retire a worktree safely

Keep a worktree until its changes and useful evidence are integrated or deliberately retained. Before removal, inspect its status and ensure unique untracked source/assets are preserved. Stop only servers started for that worktree. Remove the worktree through Git after verifying its resolved path and status; do not recursively delete a computed directory as a shortcut.

Useful request:

> Review this feature against the current Arena, integrate it if the checks pass, and clean up only its finished worktree and temporary server.

## What belongs in version control

| Keep | Usually ignore |
|---|---|
| Source, approved art, registration/provenance | `node_modules`, `dist`, framework caches |
| Lockfile, Lab scenarios, test contracts | Browser profiles, traces, temporary videos |
| Intentional reviewed screenshot baselines | Routine `work/qa/` captures and measurements |
| AGENTS, repository skills, current guides | Local environment files and credentials |
| Concise reviewed evidence in `docs/review/` | Large scratch exports already reproducible from scenarios |

Existing tests intentionally regenerate selected reports/import examples under `docs/`. Inspect those diffs and retain useful current evidence; do not stage every generated file automatically.
