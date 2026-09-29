# Godot client: rules for agents

This folder is an **experiment** (see [`EVALUATION.md`](EVALUATION.md)): a Godot 4.7.2
presentation client for the Arena, built on regenerated art. Read the root `AGENTS.md`
first; its invariants still apply. This file only adds what is specific to `godot/`.

## What Godot is, and is not

- Godot is a **presentation client**. The TypeScript simulation
  (`lib/arena/simulation.ts`, `model.ts`, `engine/events/**`) is authoritative for
  outcomes, scoring, contact and recordings. **Never import or reimplement it here**
  unless a Gate 2 decision says so.
- Watch plays **immutable recordings** through a versioned one-way contract
  (`contract/`, from Step 3). Pause, seek, speed, replay and resize must never
  resimulate a winner or award points again. The clock is a pure function of time.
- The bag is a pure function of time. **No Godot physics bodies**, no `randf`/`randi`/
  `RandomNumberGenerator` in `godot/scripts`; a GUT test greps for them.
- Objects stay attached to the evaluated hand socket until the semantic release marker.
- Feet stay grounded; squash and stretch is applied only at the root/actor scale and
  returns exactly to rest; Dan and Doug are both 5′8″ and lane depth applies uniformly.
- Live practice and Lab never change club points, saved matches or installed characters.

## Toolchain (pinned in `tools/env.sh`)

```sh
bash godot/tools/bootstrap.sh              # Godot 4.7.2-stable (SHA-512 checked) + GUT 9.7.1 + Pillow/numpy/scipy
bash godot/tools/run_tests.sh              # GUT, exit 0 only if every test passes
bash godot/tools/run_tests.sh --selftest   # proves a failing test yields a non-zero exit
bash godot/tools/capture.sh res://scenes/smoke/capture_smoke.tscn smoke 120
bash godot/tools/probe.sh                  # re-run the capability probes in PROBES.md
bash godot/tools/rig_qa.sh [--inject <defect>]   # rig-QA gate on the test puppet (art/qa)
bash godot/tools/rig_qa_selftest.sh        # mutation test: clean passes, each injected defect fails
```

- The container is ephemeral: run `bootstrap.sh` at the start of a session. It uses the
  configured HTTPS proxy. If a host answers 403/407, stop and report it; do not route
  around the proxy and do not use `apt` (its plain-HTTP sources fail through the proxy).
- `--headless` draws nothing. **Visual review needs `capture.sh`** (Xvfb + Mesa llvmpipe,
  Movie Maker PNG sequence + contact sheet under `work/qa/godot/`, git-ignored). Renders
  are llvmpipe, not a real GPU: never claim frame-time or final-look results from them.
- Godot node transforms are **float32**; script floats are float64. Parity thresholds
  tighter than ~1e-4 px are evaluated on script-side float64 values (see PROBES.md).
- Skinned `Polygon2D` supports **4 influences per vertex** and the surface cannot be read
  back; check it with a script-side linear-blend reference plus rendered-mask metrics.
- GDScript only (no C#). Text `.tscn`/`.gd`/`.tres`. Commit `.import` sidecars; `.godot/`
  and `addons/gut/` are git-ignored and restored by the bootstrap.

## Art and provenance

- New art lives under `godot/assets/` with a `PROVENANCE.json` (prompts, source images,
  cleanup steps, hashes), following `docs/art-prompts/*provenance.json`. Anything not
  hand-verified stays labelled *generated* or *derived*. No claim of an editor round
  trip, of unseen poses or of measured motion.
- Legacy art, atlases, rigs and hashes elsewhere in the repo stay **byte-preserved**;
  the original collectible cards are never repainted. Spine is historical and must not
  be activated.
- The art spec and acceptance gate are in `art/` (Step 1). Passing numeric checks is not
  proof of natural motion: inspect the rendered action at normal speed and around
  release, contact and recovery, from continuous frames.

## Working rules

- Small checks while iterating (`run_tests.sh`, one `capture.sh`); before reporting a step
  done, run the checks named in `EVALUATION.md` and report any not run.
- Prototype results and how to repeat them are in [`PROTOTYPES.md`](PROTOTYPES.md) (exploratory, no adoption
  decision); the two prototype addons and their pins are in [`ADDONS.md`](ADDONS.md).
- Do not update thresholds, or any baseline, merely to silence a failure.
- Do not publish, deploy or rewrite history, and do not download export templates
  (about 1.28 GB) until an export is decided at Gate 2.
