# Godot capability probes

Measured on **Godot 4.7.2-stable (official)**, Linux x86_64 cloud container, no GPU,
Compatibility renderer on Mesa llvmpipe under Xvfb, 2026-09-29. Re-run everything with
`bash godot/tools/probe.sh`; the probe sources are in `godot/probes/`. These results
answer the open questions in the plan. Anything not listed here is still **unverified**.

| Question | Result | Consequence for the art spec and rigs |
|---|---|---|
| Max skin influences per vertex (`Polygon2D`) | **4.** With 5 weighted bones the lowest-weight bone is dropped (not the last-by-index): shift 0.000 px where full linear-blend skinning gives 10.0. With 4 influences the shift is exactly 10.000 px. | New rigs must have ≤4 influences per vertex. The legacy shorts weld averages up to 5 bones, so it cannot be imported as-is. |
| Can script read skinned vertices back? | **No.** `Polygon2D` exposes `get_bone_weights` and the bone paths but no post-skin vertex getter (`ClassDB` check). | Skinned-surface checks use a script-side LBS reference from `Bone2D` transforms and weights, plus rendered-mask metrics. |
| 2D IK available in the pinned version? | **Yes, and it works.** `SkeletonModification2DTwoBoneIK` (plus CCDIK, FABRIK, LookAt, Jiggle, StackHolder) with `SkeletonModificationStack2D`. A two-bone leg reached its target within 0.000 px, and `flip_bend_direction` moved the knee to the opposite side of the hip-to-target line. The stack must be set up after the skeleton has had a frame to register its bones. | Leg IK can be authored natively. Hand-authored or baked leg IK remains the fallback. Not yet tested: IK inside an AnimationPlayer-driven clip, and `inheritRotation:false`-style foot behaviour. |
| Animation markers and manual stepping | **Yes.** `Animation.add_marker` / `get_marker_time` work. With `callback_mode_process = MANUAL`, repeated `seek(t, true)` in a shuffled order was bit-identical, and `advance(84 × 1/60)` equalled `seek(1.4)` exactly. | A Watch player can be a pure function of the clock, and seek/replay is safe. |
| Numeric precision | GDScript floats are **float64** (`0.1 + 0.2 == 0.30000000000000004`, same as JS). **`Vector2` and node transforms are float32** (`Vector2(16777217, 0).x == 16777216`). | Parity thresholds tighter than about 1e-4 px must be checked on script-side float64 values, never on node transforms. |
| Alpha edges at court scale (0.25×, mipmapped linear) | Soft **8-bit alpha shows no dark fringe** (0.000). **Hard 1-bit alpha with black RGB under transparent texels gets a dark fringe** (0.108 luminance darker than interior and background). `Image.fix_alpha_edges()` removes it (0.000). | Art spec requires 8-bit alpha, and every atlas must have colour bled into transparent texels (or import with the fix-alpha-border option). The legacy atlas is 1-bit. |
| Godot runs and renders here | **Yes.** Editor binary starts; `xvfb-run` + `--rendering-driver opengl3` + `--write-movie` produced 120 distinct, non-uniform 1280×720 PNGs at ~18% of real time. `--headless` draws nothing (dummy renderer), so capture always needs Xvfb. | Agents can review continuous frames via contact sheets. Rendering is llvmpipe, not a real GPU, so final fidelity sign-off still needs a real machine. |
| Test framework | **GUT v9.7.1 works on 4.7.2.** Exit code 0 when all pass, 1 on a failing test; `run_tests.sh --selftest` proves the failure path. | `run_tests.sh` can gate CI and agent loops. |
| Download path | The editor zip (77,860,424 B) downloaded through the proxy in about 1.4 s, and its SHA-512 matches the official `SHA512-SUMS.txt`. GUT installs by `git clone --branch`. | `bootstrap.sh` works from a cold container. Export templates (about 1.28 GB) were not downloaded. |
| Scalable Vector Shapes 2D 2.35.1 on 4.7.2, `gl_compatibility` | **Runs**: shapes built from code with `update_curve_at_runtime`, a `Polygon2D` fill and a `Line2D` stroke render under llvmpipe. Skeleton deformation assigns each curve point to **one** `Bone2D` (`deformation_map`); there is no weight blending. It re-tessellates every shape on update (25 shapes, 260 points: ≈1,180 µs per pose update on this CPU, versus ≈42 µs for skinned `Polygon2D`). | Large bends show self-intersecting kinks (see `PROTOTYPES.md`). Pinned by `tests/test_anim_compare.gd` (seek order does not change the deformed outline). |
| Phantom Camera 0.11.0.3 on 4.7.2 | **Runs** in `MANUAL` interpolation mode when driven with `host.process(delta)`. Its host stays inactive until **one engine frame** after its cameras enter the tree. Its tweens integrate frame deltas, so the camera is **not a function of the clock alone**: 60 Hz vs 30 Hz stepping differed by up to 18.7 px, and it trailed a plain-camera reference by up to 35 px. Replay from zero at a fixed step reproduces continuous play exactly. | A seekable Watch camera needs rebuild-and-replay (a coroutine) or a plain camera. Pinned by `tests/test_camera_spike.gd`. |
| Skinned `Polygon2D` texture edges | A polygon whose edge sits on the centre line of a baked outline clips the outer half of the stroke and looks thinner than a vector stroke. Offsetting the mesh outline outward by half the stroke width fixes it. | `tools/gen_doug_art.py` writes the offset outline for meshing. |

## Not probed yet

- 2D IK evaluated inside an AnimationPlayer clip, and any foot-planting behaviour.
- Real-GPU rendering and frame time (this container only has llvmpipe).
- Export templates and a Windows/Steam export.
- Accessibility (screen-reader) support on desktop.
- C#/.NET (deliberately out of scope; the plan is GDScript only).
