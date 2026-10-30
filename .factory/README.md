# AI Software Factory

Claude Code is the software organization. You describe; it plans, builds, tests,
reviews, repairs and hands back a branch/PR with evidence. It never merges or
deploys.

## Use it (type these in Claude Code)

| You type | What happens |
|---|---|
| `/factory-build Add a retry button to the results screen` | plan -> build -> independent test -> review -> branch + report |
| `/factory-fix The score doesn't reset after a rematch` | reproduce -> root cause -> fix + regression test -> verify |
| `/factory-review PR 42` (or a branch / "current changes") | independent code + browser review, findings only |
| `/factory-polish The main menu on mobile` | look first, fix defects only, before/after screenshots |
| `/factory-status` (`resume`) | verified overview, re-checked against git; resumes open work |
| `/factory-maintain deps` | audit gates/deps, repair one verified finding |
| `/factory-adopt ../other-repo` | install the factory into another repo |

## Who does what

The **Director is your main Claude Code session** (running the skill); it owns the
plan and the ledger and uses only the agents a task needs. Subagents are in
`.claude/agents/`:

| Agent | Edits? | Role |
|---|---|---|
| `factory-architect` | no | investigate, smallest plan, criteria, file ownership |
| `factory-builder` | yes | implement + tests, commit on task branch |
| `factory-ui` | yes | interface work, desktop + mobile screenshots |
| `factory-qa` | `work/factory/` only | run gates, drive the real app, PASS/PARTIAL/FAIL |
| `factory-repair` | yes | one failing issue: reproduce, root cause, targeted fix |
| `factory-reviewer` | no | challenge the plan, then review the diff independently |

Project specialists (Arena: animation, physics, art, engine, gameplay) live in
`project.json -> specialists` and are consulted only when relevant. A trivial change
skips the pipeline (see PROTOCOL section 0).

## Where things live (no duplication)

| What | Where |
|---|---|
| Stable repo rules | `CLAUDE.md` / `AGENTS.md` (unchanged) |
| Pipeline procedure | `.factory/PROTOCOL.md` |
| Project-specific facts: gates, protected paths, specialists | `.factory/project.json` (the ONLY per-project file) |
| Active/finished work, gate results, review, repairs, interventions | `.factory/tasks/T-*.json` (+ `.plan.md`) |
| Disposable evidence (logs, screenshots, traces) | `work/factory/<task>/` (git-ignored) |
| Enforcement | `.claude/settings.json`, `.claude/hooks/factory-guard.mjs` |
| Ledger/gate CLI | `node scripts/factory/factory.mjs help` (`pnpm factory ...`) |

The ledger refuses to say "ready" unless every required gate passed **on the current
tree** and an independent review approved **the current tree**. Any later edit makes
both stale. Repair budget is 3 per issue, then it escalates. Only 1 task is active
at a time (`maxActiveTasks`).

## Safeguards (what is actually enforced)

| Boundary | Mechanism |
|---|---|
| No merge to default branch | deny `gh pr merge`, GitHub merge/auto-merge tools; guard blocks commits/pushes on protected branches |
| No deploys / publishes | deny + guard patterns (vercel, wrangler, npm publish...), Vercel write tools denied |
| No production DB changes | Supabase migration/SQL tools denied; guard blocks `supabase db push`, prisma deploy, prod `psql` |
| No force-push / history rewrite / `reset --hard` | guard |
| No credentials | `.env`/key reads denied; guard scans written content and staged diffs for key patterns |
| Approved art / baselines / lockfile / records | `protectedPaths`: guard blocks edits to existing files **and** `ready` fails if they changed (backstop for shell edits) until you run `factory.mjs approve` yourself (agents are blocked from running it) |
| Don't weaken safeguards | settings/hooks/profile are protected by default |
| Builder can't self-certify | QA and reviewer are separate, read-only agents; only the ledger can mark ready |
| Branch protection on `main` | **GitHub setting, not enforceable from here** - see "Your remaining steps" |

Limits: shell commands can be obfuscated past regex rules; the `ready` check and
GitHub branch protection are the real backstops.

## Automation (opt-in, off by default)

`.github/workflows/factory-queue.yml`: label an issue `factory:build` (owner only) or run
the workflow manually and it prepares a PR via `/factory-build`, one run at a time
(`concurrency: factory-queue`). Disabled until the repo variable `FACTORY_ENABLED=true`
and secret `ANTHROPIC_API_KEY` exist. **Status: written, not tested.** Scheduled
maintenance (`/factory-maintain`) is not scheduled; propose a schedule first.

## Your remaining steps

1. GitHub -> Settings -> Branches: protect `main` (require PR + the `CI` checks, no force push).
2. Only if you want unattended runs: add `ANTHROPIC_API_KEY` secret, set `FACTORY_ENABLED=true`, install the Claude GitHub app.
3. Optional: Playwright browsers on your machine for `/factory-polish`.

## Adopting in another repo

`/factory-adopt ../other-repo` (or `node scripts/factory/install.mjs --target ../other-repo [--dry-run]`)
copies exactly the files in `.factory/kit.json`, merges (never clobbers) `.claude/settings.json`,
adds `/work/` to `.gitignore`, and generates a starter `project.json` from that repo's real
package.json scripts. The session then fills in what only a human/inspection knows (approved art,
league/production data, migrations -> `protectedPaths`) and `factory.mjs doctor` must pass.
Profile ideas: FloorForge -> visual baselines + layered-art dirs protected, screenshot gates;
717REC -> migrations/seed/league data protected, playoff/standings tests as required gates;
Nothing Strange Here -> scene/navigation tests + a performance gate.

## Tests of the factory itself

`pnpm factory:test` (ledger, gates, guard, installer; throwaway repos, no network).
