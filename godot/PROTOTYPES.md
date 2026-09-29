# Prototype: Skeleton2D vs Scalable Vector Shapes vs hybrid, plus a Phantom Camera spike

**Status: exploratory evidence, not a gate result and not an adoption decision.** Written
2026-09-29 from `scenes/prototypes/`. Nothing here changes `main_scene`, the frozen Phaser
build or the TypeScript simulation. The owner decides what, if anything, is adopted.

## What was compared

One Doug, one throw, one clock, three rigs. All three read the same art
(`assets/doug/shapes.json`) and the same pose function (`ThrowMotion.pose_at(t)`), so any
difference comes from how the skeleton deforms the art.

| Variant | Deformation | Hands |
|---|---|---|
| **A** Skeleton2D + skinned mesh | Weighted, textured `Polygon2D`; continuous arms and legs with blended joints, ≤4 influences | one drawing |
| **B** Skeleton2D + Scalable Vector Shapes 2D | `ScalableVectorShape2D` curves; each curve point follows **one** bone (`deformation_map`) | one drawing |
| **C** Hybrid | A's body | `SpriteFrames` drawings (relaxed, grip, open) swapped at the release marker |

- **Motion:** `assets/doug/throw_reference.json`, a derived copy of the compiled cornhole
  reference. Release marker at reference frame 51 (t = 2.26 s). Far arm and hand states are
  authored. This is an authored adaptation of filtered monocular data, **not measured motion**.
- **Why a battery too:** the throw bends the elbow only about 4° (its channel is
  `elbowRight`), so it cannot judge joint quality. The 18-pose rig battery
  (`art/pose_battery.json`) is what bends elbows to a fold, lifts a shoulder to -150° and
  drops the pelvis 150 px. Those results carry the comparison.
- **Art:** scripted vector geometry (`tools/gen_doug_art.py`), labelled *generated (scripted
  vector geometry)* in `assets/doug/PROVENANCE.json`. It is **not AI-image generation** (no
  image generator was available in this session) and **not a verified likeness**; the legacy
  Doug art was a colour and costume reference only. Simple flat shapes will flatter
  deformation methods that are hurt by painted detail; see Limits.

## Results

Evidence: `docs/review/godot-anim-compare/` (`joints-A-B-C.png`, `throw-six-moments.png`,
`camera-plain-vs-phantom.png`, `battery-metrics.json`). Rendered under Mesa llvmpipe.

| Criterion | A skinned | B SVS | C hybrid |
|---|---|---|---|
| Elbow continuity (`chest_tap`, fold ≈ 100°+) | Smooth, rounded fold | **Pinches into a small self-intersecting triangle** on the inner elbow | Same as A |
| Shoulder (`follow_through`, -150°) | Sleeve stays one coherent tube | **Sleeve folds over itself; chest skin shows through** | Same as A |
| Knee continuity (`crouch_deep`, `step_lunge`) | Smooth | **Angular knees with wedge notches** | Same as A |
| Tears (18 poses, connected components − 1) | 0 | 0 | 0 |
| See-through regions (18 poses, count) | 15 | 17 | 15 |
| Torso fold and lean back (`torso_twist_forward`, `torso_lean_back`) | No visible defect | No visible defect | No visible defect |
| Foot planting | Identical: soles on the ground within 0.01 px, no slide (shared leg IK, `tests/test_anim_compare.gd`) | same | same |
| Silhouette / outline | Baked raster stroke, fine at native scale | Crisp, constant vector stroke; **resolution independence not exercised** (max camera zoom 1.05) | Same as A |
| Script-side cost per pose update (this container's CPU, headless) | **≈ 42 µs** | **≈ 1,180 µs** (25 shapes, 260 curve points re-tessellated; measured for one explicit update pass) | ≈ 41 µs |
| Real render cost | **Not measured** (llvmpipe only) | Not measured | Not measured |

The hole counts are not verdicts. A gap between an arm and the torso is legitimate and
counts too, so read them only as A/C 15 vs B 17, meaning B has two extra see-through regions
(`stance_ready` and `follow_through` each have one more in B).

**Findings that matter**

1. **Scalable Vector Shapes deforms with one bone per curve point, with no weight blending**
   (`deformation_map` is `Dictionary[int, Bone2D]`). The inner-elbow, sleeve and knee artefacts
   are consistent with that: points on the inside of a bend cross over. I did not isolate the
   cause by experiment. More anchors near joints or hand-tuned point assignment might reduce
   it; neither was tried.
2. **A pose update costs about 28× more in B** because every shape re-tessellates. The
   addon also polls bone transforms in `_process`. From reading its code (not measured), an
   explicit update, which I added to make seeking exact, does not refresh its change cache,
   so the addon's own update probably runs again and doubles the work.
3. **The `SpriteFrames` hybrid adds nothing to joint quality** (C is A with a different
   hand). Its value is hand drawings: grip, open release and relaxed, swapped at the
   release marker. The swap is instant, so it pops; whether that pop reads well in motion
   was not judged by a person.
4. **Wrong-height arms were an authoring error of mine, caught by the battery, not by the
   throw.** The rig hangs the clavicle off the *tip* of `spine_upper` (shoulder at y = -576),
   and the arms were first drawn 90 px lower, so the wrist pivoted about the wrong point and
   the hand floated off the forearm at `release`. Fixed in `tools/gen_doug_art.py`; the
   battery now shows zero tears in all variants.

### Phantom Camera spike

The same four-shot beat (wide, push-in on the windup, bag follow after release, board
settle) with a plain `Camera2D` computed as a pure function of time and with Phantom Camera
in `MANUAL` interpolation mode. Visually the two are near-identical. What differs:

| Property | Plain `Camera2D` | Phantom Camera 0.11.0.3 |
|---|---|---|
| Camera is a function of the clock alone | **Yes**, same at 60 Hz and 30 Hz steps | **No.** The host integrates tweens by adding frame deltas: 60 Hz vs 30 Hz stepping differs by up to **18.7 px** |
| Seek | Assignment | **Rebuild and replay from zero**; replay equals continuous play exactly (tested) |
| Activation | immediate | **Needs one engine frame** after its cameras enter the tree (`_active_pcam_missing` until then), so seek is a coroutine |
| Deviation from the plain reference | none | up to **35 px** (tween starts a frame after the priority switch) |
| Project impact | none | needs the `PhantomCameraManager` autoload; addon is 0.x |
| Authoring (non-blank lines, `camera_spike.gd`) | 16 (`_shot_state` + `_plain_state`) | about 34 (29 in `_build_camera` plus the priority switching in `_step`), plus the addon |

What Phantom Camera offers that this scripted beat did **not** exercise: follow modes with
dead zones, damping, group framing with auto-zoom, noise and shake, and editor-side authoring.
Those are aimed at live cameras (Play), where no one seeks. Watch's rule (pause, seek, speed
and replay never change results) is the one it strains, and the seek cost above is the
price of keeping that rule.

## Recommendation (evidence-limited)

- **Do not adopt Scalable Vector Shapes for the character rig on this evidence.** Weighted
  skinning (A) gave the better joints at about 1/28th the script cost. SVS may still suit
  non-skeletal vector elements (cloth, ropes, court markings); that was not tested.
- **Keep A for the body and take C's idea for hands**: separate hand drawings, swapped on
  the release marker, already required by `art/SPEC.md`.
- **Phantom Camera: not needed for Watch.** A plain camera table gives the same shots as a
  pure function of the clock. It is worth reconsidering for Play's live camera.
- **Lit is untested.** It needs Forward+ and this project is `gl_compatibility`.

## Limits (what this does not show)

- One character, one throw reference, placeholder scripted art, one reviewer (the agent
  that built it). **No human likeness or motion review.** Numbers and stills are not proof
  of natural motion; the 300-frame loop was inspected as stills at six moments, not judged
  as motion by a person.
- SVS was driven programmatically. Its editor tools (paint-bone weights, SVG importer) were
  not tried, and the mitigations named under finding 1 were not tried.
- Raster art was never shown above native scale, so SVS's resolution advantage is unproven.
- Timings are script-side CPU on a cloud container. There is no GPU here, so there are no
  frame-time or final-look claims.
- Hand-off constraint: `art/SPEC.md` and `EVALUATION.md` are still drafts awaiting owner
  approval, and the SPEC's "no generation starts before approval" rule was answered by the
  owner's explicit approval in the session that produced this. Nothing generated here has
  had a likeness sign-off.

## Repeat it

```sh
bash godot/tools/bootstrap.sh                      # installs the pinned addons too
python3 godot/tools/gen_doug_art.py                # regenerates assets/doug (deterministic)
bash godot/tools/run_tests.sh                      # includes test_anim_compare and test_camera_spike
bash godot/tools/capture.sh res://scenes/prototypes/anim_compare/compare.tscn ac_loop 300
bash godot/tools/capture.sh res://scenes/prototypes/anim_compare/battery_compare.tscn ac_battery 540
python3 godot/tools/anim_compare_metrics.py work/qa/godot/ac_battery work/qa/godot/ac_battery/metrics.json
bash godot/tools/capture.sh res://scenes/prototypes/camera_spike/camera_spike_plain.tscn cs_plain 300
bash godot/tools/capture.sh res://scenes/prototypes/camera_spike/camera_spike_phantom.tscn cs_phantom 300
```
