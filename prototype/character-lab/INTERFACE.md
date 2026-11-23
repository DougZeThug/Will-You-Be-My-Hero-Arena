# Character Lab: shared contract (core <-> views)

Isolated prototype. Nothing here is imported by the shipped game, and nothing here edits it.

Approach: ONE 3D skeleton + procedural, goal-driven animator per character (`core/`), drawn
through hand-drawn 2D cut-out view rigs (`views/`) posed from the projected 3D joints (2.5D).
Motion, turning, proportions and props live in 3D; the look stays the owner's drawings.

## Space and units
- Right-handed, metres. `+Y` up, ground at `Y = 0`. World `+X` is screen-right and `+Z` is
  toward the viewer when the camera yaw is 0.
- Angles in radians. Yaw is rotation about `+Y`; yaw 0 faces `+X`; positive yaw turns the
  facing toward `+Z` (toward the camera at camera yaw 0).
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
  hands: { L: 'relaxed' | 'open' | 'grip'; R: 'relaxed' | 'open' | 'grip' };
  contacts: { footL: boolean; footR: boolean };  // planted (world-locked) this step
  props: { id: string; pos: Vec3; vel: Vec3; angle: number; heldBy: 'L' | 'R' | null }[];
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
both halves use. View angle of a block = its world yaw relative to the camera:
0 = facing camera-right (profile), +90 deg = facing the camera (front),
180 = profile facing left, -90 = facing away (back).

## Views
A view rig is a 2D cut-out drawn for one canonical angle: `front`, `side`, `back`,
`threeQuarterFront`, `threeQuarterBack` (mirrored at draw time for the other half-circle).
`rigs/<id>/views.json` lists which exist and which are stand-ins. The trunk, head and each
limb choose their view from their own block's yaw, so a head can turn before the body.
