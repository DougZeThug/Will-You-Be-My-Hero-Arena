# Motion prototype, pass B: layered cut-out rig

Isolated prototype. Nothing here is imported by the shipped game, and nothing
outside `prototype/motion/` is modified. `pass-a/` belongs to a separate pass.

The shipped side rig draws the whole body as one mesh, so legs cannot pass each
other and nothing can lead. This folder re-cuts the **same drawings** into a
layered, skinned cut-out rig with one pipeline for every character, and gives
a small renderer to pose it. All output is **derived**: the source sheets are
only read, and their hashes are recorded in each `rig.json`.

## Commands (from the repository root)

```
node prototype/motion/prep/build.mjs doug          # rebuild one character (add --debug for part PNGs in work/qa)
node prototype/motion/prep/build.mjs dan
node node_modules/vite/bin/vite.js --config prototype/motion/vite.config.ts   # http://127.0.0.1:3032
node prototype/motion/tools/capture.mjs doug dan   # torture sheets + bind comparison -> work/qa/reimagine/pass-b/
node_modules/.bin/tsc --noEmit -p prototype/motion/tsconfig.json
```

Pages: `/torture.html?c=doug` (`&s=0.8` scale, `&bones=1`, `&flip=1`,
`&only=stride,knee`), `/prep/mark.html` (landmark tool, `?c=doug` loads an
existing character). The build is deterministic: same inputs, same bytes.

## Files

| Path | What |
|---|---|
| `characters/<id>.json` | Per-character config: source sheet, landmarks, hints |
| `prep/build.mjs` | Entry point: config -> `rigs/<id>/atlas.png` + `rig.json` (mesh, atlas packing) |
| `prep/recut.mjs` | The re-cut: keying, segmentation, hidden-surface fills, bones, weights. All tunables in `RECUT` |
| `prep/raster.mjs`, `prep/png.mjs` | Mask/image helpers and a PNG codec on Node built-ins (no dependencies) |
| `prep/mark.html`, `prep/mark.ts` | Landmark tool for new characters |
| `rig/` | Runtime: `loadRig`, `Skeleton`, `RigRenderer` (pure TypeScript + WebGL 1) |
| `torture.html`, `torture.ts` | Bind-pose comparison and the extreme-pose grid |
| `tools/capture.mjs` | Playwright capture of the torture page |

## Character config

```json
{
  "id": "doug",
  "source": "lab/loongbones/assets/cornhole-side-v3/doug_source.png",
  "overlays": [{ "image": ".../doug_limbs-source.png", "rect": [840, 0, 414, 1254] }],
  "landmarks": "lab/loongbones/assets/cornhole-side-v3/doug_authoring.json",
  "hints": { "nearSide": "L", "handScale": 0.79 }
}
```

- `source`: chroma-keyed sheet (body on the left, bare throwing arm and the
  grip / open / relaxed hands on the right). Paths are repository-relative.
- `overlays` (optional): rectangles replaced from another sheet of the same
  layout (the shipped rig takes the limbs from `*_limbs-source.png`).
- `landmarks`: path to, or inline copy of, the authoring JSON: `joints` (same
  names as the shipped `*_authoring.json`) and `registration.armJoints`,
  `.wrists`, `.sleeveBoundary`, `.sleeveOpening` (`.bodySleeveCutout`
  optional; the boundary grown by 12 px otherwise).
- `hints` (all optional): `nearSide` (`"L"` default: which drawn leg is nearer
  the camera), `handScale` (hand art size relative to the arm; estimated from
  the wrist widths when absent, which is rough), `neckLine` (`[[nape],[throat]]`
  when the head/neck split should be tilted), `farShoulder`, `farElbow`,
  `farArmScale` (override the derived hidden far arm).

Hand input Dan and Doug needed: none beyond their existing authoring JSON,
plus `handScale` (0.9 / 0.79, the shipped rig's numbers). `nearSide` is the
default and is written out only to make the decision visible.

A new character costs 37 clicks and two outlines in `mark.html`: 31 joints on
the body, 3 on the separate arm, 3 hand wrists, the sleeve outline and the
sleeve opening; then optionally `handScale`.

## Parts (back to front) and why

| Part | Bones | Notes |
|---|---|---|
| `arm_far` | upper_arm_far, forearm_far, hand_far | Off arm, behind everything |
| `leg_far` | thigh_far, shin_far, foot_far | |
| `shorts_far` | pelvis -> thigh_far | The far thigh's own copy of the lower garment |
| `leg_near` | thigh_near, shin_near, foot_near | |
| `trunk` | pelvis..head, thigh_near | Head, neck, shirt, shorts (near leg) |
| `sleeve_near_back` | chest, clavicle_near, upper_arm_near | Whole sleeve incl. the dark opening, behind the arm |
| `arm_near` | upper_arm_near, forearm_near | Throwing arm from its own island |
| `sleeve_near` | same as back | Sleeve cloth without the opening, hides the shoulder joint |
| `hand_grip` / `hand_open` / `hand_relaxed` | hand_near | Group `hand`; one visible at a time |

Changes from the brief, both demanded by the art:

1. **Two shorts legs instead of "hem follows both thighs a little".** One mesh
   cannot keep its front edge on whichever thigh is in front: with the legs
   crossed the thigh bursts out of the cloth. So the trunk's shorts follow the
   near thigh (0 at the hips to 0.92 by 40% of the thigh) and the far thigh has
   its own copy drawn behind. In the bind pose the copy sits exactly under the
   original, so the drawing is unchanged. Near the hips the trunk keeps a
   pelvis-weighted wedge in front of the near thigh so no hole opens there.
2. **A sleeve back part.** The source paints the empty sleeve opening; that
   paint has to sit behind the arm while the cloth sits in front (as shipped).

Bone names use depth, not left/right: `*_near` is the camera side (throwing
arm, near leg), `*_far` the other. Chain: `root > pelvis > spine_lower >
spine_mid > chest > neck > head`; `chest > clavicle_* > upper_arm_* >
forearm_* > hand_*`; `pelvis > thigh_* > shin_* > foot_*`. Translate
`clavicle_near` to protract / retract / elevate the shoulder.

Sockets: `palm` (throwing hand), `off_hand`, `head`, `ankle_near|far`,
`heel_near|far`, `toe_near|far`.

## Derived (hidden) surfaces

Kept minimal; nothing is AI-generated and the visible bind pose is the source
drawing.

- **Thigh tops** (both legs, under the shorts; the far thigh also behind the
  near one): the thigh's edges are continued straight up the bone, the inside
  is filled with the mean lit skin colour of that leg per across-bone column
  (flat, shaded front to back like the drawing), and the new edge gets the
  drawing's outline colour.
- **Far shorts leg**: a copy of the existing shorts pixels over the far thigh,
  with an outline added on its back edge (hidden in the bind pose).
- **Far upper arm and the hidden half of the forearm**: the separate bare-arm
  drawing, re-posed onto the far arm's bones, scaled across to the drawn wrist
  width, colour-matched to the drawn forearm, and clipped to what the trunk
  hides in the bind pose (the clipped edge is outlined). The drawn forearm and
  hand sit on top, feathered 4 px into it along the old cloth edge.
- **Trunk under the sleeve**: the shirt cloth below the sleeve mirrored upward,
  with a straight outlined back edge between the shoulder and the side.
- **Hand stubs**: the three hand drawings fade out behind the wrist crease so
  no cut end shows over the forearm.
- **Keying**: the shipped hard rule plus a 2 px soft edge with the key colour
  unmixed.

## rig.json (format `arena-cutout-rig`, version 1)

Root-space pixels of the source sheet, y down, origin at the ground point
(`meta.sheetOrigin` is that point on the sheet). Types: `rig/rig.ts`.

```
meta    { id, generator, derived: true, facing (+1 = faces +x), heightPx, sheetOrigin,
          inputs: [{ path, sha256, rect? }], landmarks: { path, sha256 } | { inline },
          hints, recut (every tunable used), layout, bodyBox, sleeveCutBox, notes }
atlas   { image: "atlas.png", width, height }
bones   [{ name, parent | null, x, y, rotation (rad, bind direction), length }]   parents first
sockets [{ name, bone, x, y }]                                                    bind position
parts   [{ name, visible, group?, xy: [x,y,...], uv: [u,v,...],                   back to front
           bones: [4 indices per vertex], weights: [4 per vertex, sum 1], triangles: [...] }]
```

Atlas: one island per part, 4 px transparent margin with colour bled into it,
4 px gutters; sample with premultiplied alpha and linear filtering.

## Renderer API

```ts
import { loadRig, Skeleton, RigRenderer } from './rig/index';

const rig = await loadRig('./rigs/doug/rig.json');       // data + atlas image
const skeleton = new Skeleton(rig);                      // one per character instance
skeleton.reset();                                        // bind pose
skeleton.rotate('thigh_near', radians);                  // delta from bind; + = clockwise on screen
skeleton.translate('clavicle_near', dx, dy);             // root-space axes at bind; turns with the parent
skeleton.scale('root', sx, sy);                          // squash and stretch (root only)
skeleton.update();                                       // forward kinematics
skeleton.socketWorld('palm', out);                       // also jointWorld, tipWorld, angleWorld, transform
const renderer = new RigRenderer(gl, rig);               // WebGL 1, one draw call
renderer.show('hand', 'hand_open');                      // or setVisible(part, on)
renderer.swap('hand_grip', 'arm_near');                  // or setOrder([...]); renderer.order is the list
renderer.draw(skeleton, { x, y, scale, flip, opacity }); // root at canvas px (x, y)
renderer.positions;                                      // skinned vertices of the last draw
```

`skeleton.pose` (5 floats per bone: rotation, tx, ty, sx, sy) can be written
directly. No per-frame allocation. Sign convention: y is down, so a positive
rotation is clockwise on screen. For a rig facing +x a hanging limb swings
**forward** with a negative angle and the spine leans forward with a positive
one; multiply by `meta.facing` as `torture.ts` does (`applyPose`).

## Character Lab view rigs

`build.mjs <id> --view side|sideRear|front|back|all` (see `prep/views.mjs`, `prep/front.mjs`)
writes the Character Lab's per-view rigs to `prototype/character-lab/rigs/<id>/<view>/`
plus `proportions.json` and `views.json`, from `prototype/character-lab/characters/<id>.json`.
Without `--view` the command and its output are unchanged. `front` cuts a front parts
sheet (`FRONT` in `prep/front.mjs` lists every tunable); `back` is a labelled stand-in
built from the same parts. Details and the art checklist:
`prototype/character-lab/SUBMISSION.md`.

## Known limits

See the torture sheets. In short: the far arm has no sleeve; the throwing
sleeve pinches when the arm goes above about +100 degrees; shorts get rough
past about 60 degrees of hip flexion; the near shorts leg has no outline on its
front cut edge; hidden thigh skin is flat colour.
