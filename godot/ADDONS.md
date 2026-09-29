# Godot addons

Addons are pinned in `tools/env.sh`, restored by `tools/bootstrap.sh`, and git-ignored (GUT precedent).
A pin changes only in its own commit with the reason. Neither prototype addon is adopted by the game;
they exist for the `scenes/prototypes/` experiments and are recorded in `EVALUATION.md`.

| Addon | Pin | License | Godot | Used by | Checked |
|---|---|---|---|---|---|
| GUT | `v9.7.1` | MIT | 4.x | `tests/` | existing |
| Phantom Camera (`ramokz/phantom-camera`) | `v0.11.0.3` (`cb6e096`) | MIT | 4.4+ (README badge) | `camera_spike` | 2026-09-29 |
| Scalable Vector Shapes 2D (`Teaching-myself-Godot/ez-curved-lines-2d`) | `2.35.1` (`d477ee3`) | MIT | 4.4+ (asset library) | `anim_compare` variant B | 2026-09-29 |

Review of the code at the pinned versions (`grep` for `HTTPRequest`, `OS.execute`, `OS.shell_open`, `OS.create_process`):
- Phantom Camera: no network or process calls in `addons/`.
- Scalable Vector Shapes 2D: one `OS.shell_open` for an in-editor help-video button; no other process or network calls.

Neither has been verified against Godot 4.7.2 yet. Results (compatibility, renderer, behaviour) belong in
`PROBES.md` once measured. Lit is deliberately not pinned: it needs Forward+ and this project is
`gl_compatibility`.
