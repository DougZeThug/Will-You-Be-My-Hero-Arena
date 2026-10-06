# Multi-agent development workflow

The primary Codex session is the **Lead / Game Director**. It owns the user
conversation, decides which specialists to consult, forms the single plan, and
integrates results. Specialists are project-scoped Codex custom agents defined
in [`.codex/agents/*.toml`](../.codex/agents); shared limits are in
[`.codex/config.toml`](../.codex/config.toml). Repository rules in the root
[`AGENTS.md`](../AGENTS.md) apply to every agent and take precedence over this
file. The older [`.agents/skills/`](../.agents/skills) workflows remain the
how-to for specific review types; agents use them, they do not replace them.

## Roles

| Agent (`name`) | Sandbox | Owns | Typical trigger |
|---|---|---|---|
| Lead (primary session) | session default | user dialogue, root cause, the one plan, integration | always |
| `gameplay_architect` | read-only | event framework, state, scoring, controllers, input, AI, extensibility, progression | "can this support a new sport", state/score/input bugs |
| `character_animation` | read-only | throw/locomotion mechanics, phases, IK, rig, hand-object contact | "the throw looks wrong", shoulder/arm/foot issues |
| `engine_specialist` | read-only | Phaser/React/Vite runtime, rendering, performance, Lab, `godot/` | stutter, load, camera/render bugs, Godot questions |
| `sports_physics` | read-only | bag/ball trajectories, bounce, slide, hole, spin, input -> result | "the bag flies wrong", hard/easy to aim |
| `art_director` | read-only | cohesion, camera, lighting, effects, impact feedback, HUD, readability | "doesn't look like the game", feedback/polish |
| `skeptic` | read-only | falsify diagnoses and plans; final diff review | after specialists report |
| `implementer` | workspace-write | executes the one approved plan | only after the plan is set |
| `qa_verifier` | workspace-write, **evidence only** | PASS/PARTIAL/FAIL against acceptance criteria | after implementation |

Notes on the permissions:

- Only the Implementer edits the repository. `qa_verifier` needs a writable
  workspace solely to run checks and browsers and to write disposable evidence
  into the git-ignored `work/qa/`; its instructions forbid editing anything
  else. Running `pnpm test` regenerates some tracked files under `docs/`; QA
  reports those instead of reverting or staging them.
- Read-only agents cannot run the test suite or capture tools. When one needs
  runtime evidence it asks the Lead to have QA produce it, or reads existing
  captures under `work/qa/` and `docs/review/`.
- Subagents inherit the session's network and approval policy. Neither
  `model` nor reasoning effort is pinned in the agent files, so they follow
  the user's session. Pin them in a file only for a measured reason.
- Specialist agents do not spawn further agents. Only the Lead delegates.

## Workflow for substantial work

```
User request
 -> Lead restates the observable outcome, what must stay intact, the pinned
    scenario/seed
 -> relevant specialists investigate IN PARALLEL (read-only)
 -> skeptic challenges the findings
 -> Lead identifies the root cause
 -> Lead writes ONE implementation plan (below)
 -> Lead asks the user only about genuine creative/gameplay forks
 -> implementer executes the plan
 -> qa_verifier verifies against the acceptance criteria
 -> the relevant specialist (+ skeptic when the change is risky) does a final
    read-only review of the diff and the evidence
 -> Lead reports to the user
```

Do not invoke every specialist mechanically. Small, clearly bounded tasks
(a typo, a one-line constant with an obvious owner) skip the pipeline; the Lead
may route them straight to the Implementer or do them directly.

Typical routing:

| Problem | Investigate with |
|---|---|
| Throw/arm/shoulder/foot motion | `character_animation` (+ `art_director` if it is about look) |
| Bag/ball flight, bounce, scoring feel | `sports_physics` (+ `gameplay_architect` if input mapping or rules change) |
| New sport or shared rules/state | `gameplay_architect` (+ `engine_specialist` for runtime seams) |
| Stutter, load time, camera, render glitch | `engine_specialist` |
| "Feels flat", impact feedback, HUD | `art_director` |
| Always, before a plan is final | `skeptic` |

### Specialist report format

The five investigators return, in this order: VERDICT, ROOT CAUSE, EVIDENCE,
RECOMMENDATIONS, RISKS, ACCEPTANCE CRITERIA, CONFIDENCE, with unverified items
marked UNVERIFIED. The Skeptic returns its own challenge format. QA returns
PASS / PARTIAL / FAIL per criterion. The Lead does not forward these raw to
the user; it synthesizes.

### The Lead's implementation plan

One plan, written before any edit, containing:

1. **Outcome** in observable terms and **non-goals** (what must not change).
2. **Root cause** and the evidence for it, plus what the Skeptic raised.
3. **Layer** the fix belongs to (asset/rig data, profile/take data, adapter,
   runtime, event rules, presentation).
4. **File ownership list**: exact files the Implementer may edit. No other
   agent edits any of them while the Implementer runs.
5. **Pinned reproduction**: Lab scenario or surface, seed, participants,
   viewport (see [AI-DEVELOPMENT-WORKFLOW.md](AI-DEVELOPMENT-WORKFLOW.md)).
6. **Acceptance criteria**: observable and checkable, including phase-level
   animation criteria or measurable physics criteria where relevant.
7. **Checks** to run and the evidence QA must produce under `work/qa/`.

## File-ownership and concurrency rules

- Read-only agents may run in parallel freely.
- At most one agent writes to the repository at a time. If two changes are
  truly independent, use separate worktrees per
  [GIT-WORKFLOW.md](GIT-WORKFLOW.md) and disjoint ownership lists, and
  reconcile and re-test the combined result.
- QA runs after the Implementer finishes, never concurrently with it, because
  checks regenerate files and read the working tree.
- The Implementer stops and returns to the Lead if it needs a file outside its
  ownership list.

## Human escalation

Resolve technical questions from evidence; do not ask the user. Ask only on a
genuine creative or gameplay fork:

- realistic versus intentionally exaggerated behavior
- a major control-feel change (aim assist, charge timing, difficulty)
- a substantial visual-direction change (away from the printed-sunset
  illustrated sports-card look, character likeness, proportions)
- a fundamentally different game mechanic
- anything AGENTS.md reserves for an explicit request: publishing, deploying,
  history rewrites, deleting user data, protected art, broadening a runtime
  migration (including the Phaser/Godot boundary)

When asking, present a recommendation and the concrete tradeoff, with
evidence (frames or numbers) where available.

## Durable learning

When the user rejects a result or corrects the Lead, the Lead determines
whether the correction is a reusable rule or a one-off. If reusable, it
**proposes** the exact wording and the target file (root `AGENTS.md`, a
specific agent file, or a doc under `docs/`) and waits for approval before
editing. It does not silently grow the instructions. Prefer replacing or
tightening an existing rule over appending a new one, and keep rules tied to
this project (not generic game-dev advice). Agent instructions should point to
canonical docs rather than copy them, so there is one place to update.

## Maintaining this configuration

- Keep agent descriptions precise; Codex uses them to choose when to spawn.
- When runtime routing changes (see [ANIMATION-HANDOFF.md](ANIMATION-HANDOFF.md),
  [ANIMATION-ROADMAP.md](ANIMATION-ROADMAP.md), or a Godot gate decision),
  update the routing text in the affected agent files in the same change.
- Agent files require `name`, `description` and `developer_instructions`; valid
  `sandbox_mode` values used here are `read-only` and `workspace-write`.
