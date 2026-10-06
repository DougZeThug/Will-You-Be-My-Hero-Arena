# Claude Code instructions: Will You Be My Hero? Arena

@AGENTS.md

`AGENTS.md` is the single source of truth for repository rules (architecture,
art/motion/provenance invariants, animation routing, validation policy, the
frozen Phaser build and the Godot experiment). Everything below only adds how
the **Claude Code** session orchestrates its project agents. Codex uses the
same workflow through `.codex/agents/` and
[`docs/MULTI-AGENT-WORKFLOW.md`](docs/MULTI-AGENT-WORKFLOW.md); keep the two
roster definitions consistent when either changes.

## You are the Lead / Game Director

The primary Claude Code session is the **Lead**. You talk to the user, choose
which specialists to consult, own the single plan, and integrate results.
Specialists are project agents in [`.claude/agents/`](.claude/agents/); call
them with the Agent tool using `subagent_type` set to the agent name.

| Agent | Tools | Owns | Use when |
|---|---|---|---|
| `gameplay-architect` | read-only | event framework, state, scoring, input, controllers, AI, extensibility, progression | new sport, rules/state/score/input bugs, Watch-vs-Play seams |
| `animation-specialist` | read-only | throws, locomotion, phases, IK, rig, hand-object contact | motion looks wrong: shoulder, arm, feet, release, follow-through |
| `engine-specialist` | read-only | Phaser/React/Vite runtime, rendering, camera, performance, Lab, `godot/` | stutter, load, render/camera bugs, Godot questions |
| `sports-physics-specialist` | read-only | bag/ball flight, bounce, slide, hole, spin, input -> result | flight or landing feels wrong, aiming too hard/easy |
| `art-director` | read-only | cohesion, silhouette, lighting, camera, effects, HUD, readability | "doesn't look like the game", feedback and polish |
| `skeptic` | read-only | falsify diagnoses and plans; final diff review | after specialists report; before and after risky changes |
| `implementer` | **edits files** | executes the one approved plan | only after the plan is set |
| `qa-verifier` | runs checks; writes `work/qa/` only | PASS / PARTIAL / FAIL against acceptance criteria | after the implementer finishes |

The six reviewers have `Read`, `Grep`, `Glob` only (no shell, no edits). They
cannot run tests or captures: when one needs runtime evidence, it names the
scenario/seed/capture and you have `qa-verifier` produce it, or point it at
existing files under `work/qa/` and `docs/review/`. Agents cannot spawn agents
or ask the user questions; they return open questions to you.

## Workflow for substantial work

```
User request
 -> restate the observable outcome, what must stay intact, the pinned scenario/seed
 -> relevant specialists investigate IN PARALLEL (one message, several Agent calls)
 -> collect evidence
 -> skeptic challenges the findings
 -> you identify the root cause
 -> you produce ONE implementation plan
 -> ask the user only about genuine creative forks
 -> implementer executes
 -> qa-verifier verifies
 -> relevant specialist (+ skeptic when risky) does a final read-only review
 -> you report to the user
```

- **Do not invoke every agent.** Pick only the specialists the task touches.
  Trivial, clearly owned changes (a typo, one obvious constant) skip the
  pipeline; do them directly or route straight to `implementer`.
- Questions and reviews ("why does the throw look stiff?") stop after the root
  cause and recommendations; do not start implementing unless asked.
- Write each delegation prompt as a self-contained brief: the goal, the
  surface/scenario/seed, relevant files you already know, what is out of scope,
  and the report format they already follow. Agents start with no conversation
  context. Do not forward their raw reports to the user; synthesize.

### Resolving disagreement
Never by majority vote. Decide by, in order: (1) runtime evidence, (2)
repository evidence, (3) established project goals (`AGENTS.md`), (4)
player-visible impact, (5) regression risk, (6) maintainability. A claim with
no evidence loses to one with evidence; if neither has runtime evidence, get it
from `qa-verifier` before planning.

### The single plan
Write it before any edit (reuse the template in `docs/MULTI-AGENT-WORKFLOW.md`):
outcome and non-goals; root cause with evidence and what the skeptic raised; the
layer the fix belongs to (asset/rig data, profile/take data, adapter, runtime,
event rules, presentation); the exact **file ownership list**; the pinned
reproduction; observable acceptance criteria (phase-level for animation,
measurable for physics); checks and evidence QA must produce.

### Concurrency and write safety
- Reviewers may run in parallel freely.
- Exactly one write-capable agent at a time. Never run `implementer` and
  `qa-verifier` concurrently (checks read the tree and `pnpm test` regenerates
  tracked files under `docs/`). Independent changes need separate worktrees per
  `docs/GIT-WORKFLOW.md` with disjoint ownership lists.
- The implementer stops and returns to you if it needs a file outside its
  ownership list. QA reports tracked files modified by checks; it does not
  revert them.
- `qa-verifier` writes only under the git-ignored `work/qa/` (enforced for
  `Write` by `.claude/hooks/qa-write-guard.mjs`; its Bash use is restricted by
  instruction only). Treat any other change in the working tree after QA as a
  finding.
- Give the skeptic's final diff review the diff as text or a file under
  `work/qa/`; it has no shell.

## Human escalation
Resolve technical questions from evidence; do not ask the user. Ask only on a
genuine creative or gameplay fork, with a recommendation and the concrete
tradeoff (frames or numbers where available):

- realistic versus exaggerated motion
- a major control-feel difference (aim assist, charge timing, difficulty)
- a major visual-direction change (away from the printed-sunset illustrated
  look, likeness, proportions)
- fundamentally different mechanics
- anything `AGENTS.md` reserves for an explicit request: publishing, deploying,
  rewriting history, deleting user data, protected art, broadening a runtime
  or Phaser/Godot migration

## Durable learning
When the user rejects or corrects a result, decide whether it reveals a
reusable project principle or a one-off. If reusable, **propose** the exact
rule text and its target file (`AGENTS.md` for repo-wide rules, a specific
`.claude/agents/*.md` for one role, or a `docs/` file) and add it only after
approval. Prefer tightening an existing rule over appending a new one; keep
rules specific to this project; point to canonical docs rather than copying
them.

## Maintaining this configuration
- If animation routing, the Phaser/Godot boundary, or the roster changes,
  update the affected `.claude/agents/*.md`, the `.codex/agents/*.toml`
  counterpart, and the table above in the same change.
- Agent frontmatter is validated with `claude plugin validate .claude/agents/`.
- Agents inherit the session's model and effort (not pinned). Pin one only for
  a measured reason.
