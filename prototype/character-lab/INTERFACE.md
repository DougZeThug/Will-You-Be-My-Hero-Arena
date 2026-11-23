# Character Lab: shared contract (core <-> views) — DRAFT

**Draft until the motion proves it.** The demo sequence decides what the renderer really
needs; change this file when the sequence shows a field is missing or wrong.

Isolated prototype. Nothing here is imported by the shipped game, and nothing here edits it.

Approach: ONE 3D skeleton + procedural, goal-driven animator per character (`core/`), drawn
through hand-drawn 2D cut-out view rigs (`views/`) posed from the projected 3D joints (2.5D).
Motion, turning, proportions and props live in 3D; the look stays the owner's drawings.

## Space and units
- Right-handed, metres. `+Y` up, ground at `Y = 0`. World `+X` is screen-right and `+Z` is
  toward the viewer when the camera yaw is 0.
- Angles in radians. Yaw follows the right-hand rule about `+Y` (counter-clockwise seen
  from above): `facing(yaw) = (cos yaw, 0, -sin yaw)`. Yaw 0 faces `+X`; yaw +90 deg faces
  `-Z` (away from the viewer at camera yaw 0); yaw -90 deg faces `+Z` (toward the viewer).
  `core/camera.ts` owns `facing()` and `viewAngle()`; a known-angle test pins them:
  facing `+Z` with camYaw 0 is `front`, `+X` is `side` (facing screen-right), `-Z` is `back`,
  `-X` is `side` mirrored; orbiting the camera by +a equals turning the character by -a.
- Both pilot characters stand 1.73 m (5'8"). Fixed step: 1/60 s. No wall clock, no
  `Math.random` in `core/` (seeded noise only): the same inputs give the same frames.

## Joints (anatomical left/right, never near/far)
`pelvis, spine, chest, neck, head, headTop,
 shoulderL, elbowL, wristL, handL, shoulderR, elbowR, wristR, handR,
 hipL, kneeL, ankleL, heelL, toeL, hipR, kneeR, ankleR, heelR, toeR`
(`handL/R` is the palm centre; `spine` is the lumbar/thoracic junction; `chest` the sternum
level between the shoulders; `headTop` the crown.)

## Frame (what core emits every step, what views consume)
```ts
interface Vec3 { x: number; y: number; z: number }
interface Frame {
  step: number;
  joints: Record<JointName, Vec3>;       // world positions
  yaw: { pelvis: number; chest: number; head: number };   // world facing of each block
  lean: { pitch: number; roll: number }; // chest relative to vertical, for the trunk drawing
  // Orientation, not only position: a joint triple gives a limb's bend plane but not its
  // roll, and says nothing about which way a palm, a foot or a prop faces.
  basis: Record<SegmentName, { x: Vec3; y: Vec3; z: Vec3 }>;  // world axes per segment:
  //   x along the bone (parent -> child), z the segment's anatomical FRONT (kneecap, inner
  //   elbow crease is -z, chest front, face), y = z cross x. Segments: pelvis, spine, chest,
  //   head, upperArmL/R, forearmL/R, handL/R, thighL/R, shinL/R, footL/R.
  //   handL/R: x = toward the fingers, z = palm normal (out of the palm).
  hands: { L: 'relaxed' | 'open' | 'grip'; R: 'relaxed' | 'open' | 'grip' };
  contacts: { footL: boolean; footR: boolean };  // planted (world-locked) this step
  props: { id: string; pos: Vec3; vel: Vec3; heldBy: 'L' | 'R' | null;
           basis: { x: Vec3; y: Vec3; z: Vec3 } }[];   // full orientation; when held it is
  //   rigid in the hand's basis. A renderer may reduce it to one screen angle plus a
  //   flatness for a first demo, but the data is complete.
  squash: number;                        // root-level only, 1 = rest
  phase: string;                         // debug label of what the animator is doing
}
```

## Proportions (how a character differs)
```ts
interface Proportions {       // metres; produced by views/prep from the drawings' landmarks
  height: number;
  pelvisHeight: number; spine: number; chestLen: number; neck: number; headLen: number;
  shoulderWidth: number; hipWidth: number;
  upperArm: number; forearm: number; hand: number;
  thigh: number; shin: number; footLen: number; ankleHeight: number;
}
```
`views/` writes `rigs/<id>/proportions.json`; `core/` reads only that plus a
`styles/<id>.ts` MotionStyle (posture, timing, acting). The animator has no character
branches.

## Camera
Orthographic, yaw `camYaw` about +Y (the lab's "viewing angle"), small fixed pitch.
`project(p, cam) -> { x, y, depth }` lives in `core/camera.ts` and is the ONLY projection
both halves use. `viewAngle(blockYaw, camYaw)` is the block's facing relative to the
camera, defined by the known-angle test above (not by a sign rule in prose).
Planted feet are world-locked, so their projected positions must not move when a block
changes drawn view: view rigs are placed FROM the projected joints, never from their own
layout.

## Views
A view rig is a 2D cut-out drawn for one canonical angle: `front`, `side`, `back`,
`threeQuarterFront`, `threeQuarterBack` (mirrored at draw time for the other half-circle).
`rigs/<id>/views.json` lists which exist and which are stand-ins. The trunk, head and each
limb choose their view from their own block's yaw, so a head can turn before the body.
