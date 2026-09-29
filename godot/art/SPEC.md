# Rig-ready art specification (characters)

**Status: DRAFT, awaiting owner approval; no generation starts before approval.**
Derived from `docs/CHARACTER-RIG-ROOT-CAUSE.md`, the documented defects behind commits
`87c120a`, `7bffac1`, `5ae4c66`, `d786fa0`, and the measured Godot limits in
[`../PROBES.md`](../PROBES.md). Applies to Dan and Doug first; equipment and court have
their own, shorter spec (registration only) written when the character pilot passes.

## What this is for

The legacy rigs were cut from **one near-profile painting**, so every part the painting
never shows had to be invented at runtime: the far arm is a strip, the shorts are bound
to the pelvis, there are three fixed hands and a baked open-arm setup pose. Runtime
patches (`LoongBonesAdapter.ts:148-264`) then hide the gaps. The new art must **contain
those hidden parts as real, layered, overlapping drawings**, so nothing has to be
invented in code. Likenesses, clothing and the printed-sunset style are references; the
original collectible cards are never repainted.

## Fixed conventions

| Item | Rule |
|---|---|
| View | Near-profile, character faces **screen right**. One view per sheet. |
| Camera side | Bones and parts say `near` / `far` (camera side), never the legacy `_L`/`_R`. |
| Scale | **Standing height 720 px at native scale**, identical for Dan and Doug (both 5′8″, confirmed by the owner). Lane depth is applied once, at the actor root, and scales rig, feet, sockets, shadow and release velocity together. No per-character scale fudge. |
| Angles | Degrees, Godot convention: positive = clockwise on screen. Bones point along local +x. |
| Setup pose | A **balanced** stance with relaxed, slightly bent limbs and relaxed hands. Not an open-arm frontal pose. Idle is an animation, not the setup. |
| Texture | **8-bit alpha**, straight alpha, colour bled into transparent texels (`Image.fix_alpha_edges()` or the import equivalent), mipmaps on, sRGB. 1-bit alpha is rejected: it gets a dark fringe at court scale (PROBES.md). Keep the printed cream contour as part of each part. |
| Atlas | One atlas per character, at most 4096×4096. Original generated images are kept byte-identical beside the cleaned parts. |

## Skeleton contract

Names are fixed; the gate ([`qa/skeleton_contract.json`](qa/skeleton_contract.json)) and
every later tool use them. Bones point along +x; `near`/`far` pairs are mirrored roles.

```
root (ground origin between the feet)
└─ pelvis
   ├─ spine_lower ─ spine_upper ─ neck ─ head
   │      ├─ clavicle_near ─ upper_arm_near ─ forearm_near ─ hand_near
   │      └─ clavicle_far  ─ upper_arm_far  ─ forearm_far  ─ hand_far
   ├─ thigh_near ─ shin_near ─ foot_near
   └─ thigh_far  ─ shin_far  ─ foot_far
```

- The trunk is **three segments** (pelvis, lower spine, chest) with independent clavicles,
  so counter-rotation and shoulder motion exist as real controls. No global "shoulder
  drop" warp.
- The arm ends in a **wrist bone** (`hand_*`), not a palm effector.
- Sockets (Node2D markers, exported with the rig): `palm_near`, `palm_far` (held objects;
  each hand drawing carries its own crease-registered offset), `sole_near`, `sole_far`
  (foot contact), `chest_anchor` (chest tap), `head_anchor`.
- Legs use two-bone IK with a knee-direction cue (verified to work: PROBES.md). Feet are
  planted by IK, never by hip clamping.

## Parts every character sheet must contain

Each part is a separate drawing with its own alpha. Hidden overlap is **painted**, never
stretched from a neighbour.

| Group | Required parts | Requirement that traces to a defect |
|---|---|---|
| Head | head with face; hair or hat as a separate layer; neutral, blink and mouth variants (if approved) | The hat gesture (Doug) needs a hat layer. Face pixels are never warped. |
| Trunk | chest front, back garment panel, pelvis; shirt hem | The back panel is a real drawing, so forward swing cannot pull shirt back into the arm (attachment revision 4). |
| Sleeves | `sleeve_near`, `sleeve_far` with a **clean, empty opening** and a visible cuff | The skin arm passes inside the opening; the opening is transparent, not painted grey (revision 3). |
| Arms, near and far | upper arm, forearm, wrist, **both arms full length** | The far arm is a full arm. A strip is a rejected defect (`7bffac1`). Skin under each sleeve extends at least 20 px past the cuff. |
| Hands, near and far | cupped grip, open release, relaxed, edge-on; fist and point if approved | Opaque, crease-registered, each with its palm offset. No baked open palm in the arm. |
| Legs | thigh, shin, foot with shoe (heel and toe readable) | Thighs continue under the shorts. |
| Shorts | **separate hem/shorts parts weighted to the thighs**, plus a pelvis part | Shorts bound rigidly to the pelvis slide off the hem (`5ae4c66`). |
| Joint overlap | every adjacent pair overlaps by at least 12% of the narrower part's width across the joint | Prevents see-through gaps at bends (`87c120a`). |

## Skinning

- **At most 4 influences per vertex.** Godot silently drops the lowest-weight bone beyond
  four (PROBES.md), so weights are authored and checked at four. The legacy shorts weld
  used up to five.
- Chest, clavicle and upper-arm regions are weighted separately; sleeve weights do not
  bleed into the chest outside the overlap zone.
- Skinned vertices cannot be read back from Godot, so weights are reported from the
  authoring data (`Polygon2D.get_bone_weights`), and the surface is judged by the gate.
  A `weights_report` tool is added in Step 2 with the first real rig.

## AI generation and cleanup workflow (owner decision: AI generation + cleanup)

Image generation runs in the owner's tool; this project does cleanup, slicing, atlasing,
assembly and QA. Generation is the highest-risk step, because the model must produce
**consistent hidden parts**. Working rules:

1. Inputs: the collectible card, the current side-v3 source art (likeness reference only,
   never re-published as the new art), and this spec.
2. Generate in **layered passes**, not one full-body image: the body without arms; the
   near arm alone; the far arm alone; each hand drawing; the legs with shorts; the head
   and face variants; the sleeves. Same reference and style prompt for every pass.
3. Every pass is delivered at native scale (720 px standing height) on a flat neutral
   background. Keep the untouched output; cleanup works on copies.
4. Cleanup: matte to alpha, decontaminate edge colour, match palette and contour weight,
   then hand paint-over of joints. **At most 2 paint-over repairs per part sheet** count
   as a pass; more counts against the K2 kill criterion.
5. Record for every asset: prompt, reference images, tool and date, source hash, cleanup
   steps, output hash, and a label of `generated` or `derived` in `PROVENANCE.json`.
   Do not claim a likeness match, measured motion, or an editor round trip you have not
   verified.

## Acceptance

A character passes when all of these hold (thresholds in [`../EVALUATION.md`](../EVALUATION.md)
and [`qa/thresholds.json`](qa/thresholds.json)):

1. **Rig-QA gate clean** on all poses of [`pose_battery.json`](pose_battery.json):
   single connected silhouette; the expected skeleton core fully covered (no gaps, tears
   or strip limbs); nothing outside the maximum radii; no enclosed see-through region in
   the core; adjacent parts touch at every visible joint; planted soles on the ground
   line; a held object's socket on the evaluated palm; rigid segment lengths equal
   their setup lengths.
2. At most 4 influences per vertex; 8-bit alpha; colour bled into transparent texels.
3. The owner signs off likeness on 3 stills, and the rendered action is inspected as
   continuous frames at normal speed around release, contact and recovery. Numbers are not
   proof of natural motion.
4. Per-character radii: the gate's capsule radii are declared per character in
   `godot/assets/<character>/rig_contract.json` (same schema as
   `qa/skeleton_contract.json`), set conservatively from the drawn part widths before
   any result is known.

## What the gate does and does not prove

`tools/rig_qa.sh` runs today against a **hand-assembled test puppet** (rigid parts with
joint caps). `tools/rig_qa_selftest.sh` shows the clean puppet passes all 18 poses and
that six injected defects (missing elbow cap, detached hand, floating foot, stretched
forearm, thin far-arm strip, drifting held-object socket) each fail on the intended
metric. That proves the **harness discriminates**. It does not prove any real character
is good: real art needs its own contract radii and an ID pass (each part rendered as a
flat colour through a small shader that keeps the texture's alpha), both built in Step 2.
Occluded joints are skipped for adjacency because one view cannot judge them; a hidden
defect is caught only if it changes the silhouette.

## Deliverables per character

```
godot/assets/<character>/
  source/            untouched generated images (byte-preserved)
  parts/             cleaned per-part PNGs
  atlas.png + atlas.json
  rig.tscn           Skeleton2D + Bone2D + weighted Polygon2D, sockets, IK
  rig_contract.json  per-character gate radii
  PROVENANCE.json    prompts, references, hashes, generated/derived labels
```

## Open decisions for the owner

1. Approve this spec, and decide which optional parts to include: fist and point hands,
   blink and mouth variants, separate hat layer for Doug.
2. Who runs generation and how many review rounds per character (likeness review is on
   the critical path).
3. Whether Dan's part list differs from Doug's (both are specified identically here).
