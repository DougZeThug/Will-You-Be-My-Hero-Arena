# Performance takes (`arena-performance-take-v1`)

One file per character and technique (`<character>-underhand.ts`). The shipped
cornhole throw is compiled from these files by `lab/performance/compile.ts`
through `BodyMechanics.underhandMechanics`. Validation lives in
`../TakeValidation.ts`; tests run it on every shipped take.

Files are TypeScript data modules (`export default take`) rather than JSON so
the same import works in Vite, the Node test build and Playwright specs.

## Shape

| Field | Meaning |
|---|---|
| `provenance.kind` | `authored`, `retargeted` or `captured`. Never label authored or retargeted data as captured. |
| `duration` | Seconds at `movementTempo` 1. |
| `times` | Shared knot grid in seconds. Every time must fall on a 60 Hz frame (the compiler keys native frames). |
| `markers` | `anticipate ≤ windup ≤ windupPeak ≤ equipmentRelease ≤ finish ≤ holdEnd`, in seconds. The release must be on a frame. Choreography phases and the live clock read these. |
| `channels` | One value per `times` entry. |

### Channels

All angles are degrees in the side rig's sign (+ = clockwise on screen; the
character faces +x, so + tips backward for the arm and forward for the torso).

| Channel | Meaning |
|---|---|
| `armSwing` | World swing of the throwing upper arm from its bind pose (the sum of torso, clavicle and upper-arm rotation). + = behind the body. |
| `hips`, `lowerSpine`, `upperSpine`, `chest` | Local spine rotations (pelvis → chest). Their sum is the torso lean. |
| `shoulder` | Throwing clavicle (`clavicle_L`). |
| `elbow` | Throwing forearm (`forearm_L`). |
| `wrist` | Pre-overlap throwing-hand intent, limited to −35…95. The compiler adds wrist/chest lag and enforces the native `hand_L` limit per frame. |
| `counterArm`, `counterElbow` | Free arm (`upper_arm_R`, `forearm_R`). |
| `weightX` | Normalised pelvis travel (× profile `weightTransfer` rig px). |
| `compression` | Pelvis drop in rig px (knees bend through planted IK). |
| `gaze` | Additional head pitch. |
| `frontFootX/Y`, `backFootX/Y` | Optional footwork: rig-px offsets of the front (`foot_target_R`) and back (`foot_target_L`) IK targets from their stance. Omit for a planted throw. |

The compiler adds baked overlap (head drag, chest settle, off-arm swing, wrist
lag) and a soft knee reach, and it rejects any frame outside `NativeLimits`.

## Importing motion capture

Recommended mapping from a side-view capture (e.g. `scripts/motion-reference/extract.py`
output, or a BVH export):

1. Trim to one throw and mark `windupPeak` (top of the backswing),
   `equipmentRelease` (bag leaves the hand), `finish` (follow-through peak)
   and `holdEnd`.
2. `armSwing` = shoulder→elbow angle minus the bind upper-arm angle.
   `elbow` = elbow flexion. `wrist` = hand direction relative to the forearm,
   clamped to the hand limit.
3. Split the torso pitch across `hips/lowerSpine/upperSpine/chest` (about
   0.18/0.24/0.26/0.32, with the chest trailing by 1–3 frames).
4. `weightX`/`compression` from pelvis travel, normalised by torso length and
   scaled to the rig (the rig is 1215 px for 68 in).
5. Steps and heel lifts go in the foot channels. Contacts stay planted
   between them; the adapter flags a foot that drifts from its target.
6. Resample onto a 60 Hz-aligned grid, set `provenance.kind: 'captured'`, then
   do a short exaggeration pass for the Arena's cartoon style (deeper load,
   moving hold at the top, overshoot and settle on the finish).

The court is drawn more compressed than the characters. A release faster
than ~550°/s at the hand makes the bag leave well above its ballistic cruise
speed, so it visibly slows during the release blend.
