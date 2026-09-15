# Character pipeline: Phase 0 audit

Status: source/code audit complete; anatomical landmarks are an authoring proposal. No claim of finished corrected artwork, a Spine rig, or a natural run cycle is made by this document.

The inspected sources are Dan and Doug's `public/assets/*/puppet-v3.png`, their original `character.png` drawings, `puppet-assets.json`, `puppet-geometry.ts`, `JoinedSurface.ts`, `PaperCharacterRig.ts`, `AnimationComponent.ts`, `CharacterPresentation.ts`, and the optional `SpineCharacterRig.ts` boundary. The existing Arena Lab captures provide the actual rendered comparison.

## Confirmed causes

| Finding | Evidence and consequence |
|---|---|
| Source setup and visible idle are conflated | Both connected upper-body images depict an open-arm frontal setup with exposed palms. The renderer bends this one surface into every idle/action. Its fingers cannot become relaxed fingers through elbow movement. The separate relaxed-arm drawings in the lower atlas are not used by `PaperCharacterRig`'s upper surface. |
| No articulated torso/pelvis foundation | `puppetJoints` has one hip position and one body rotation. Both hip sockets remain at `hip.x ± 23, hip.y + 6`; there is no independent pelvis tilt, lumbar/thoracic chain, or clavicle control. Counter-rotation is unavailable. |
| Shoulder correction is a silhouette warp | `joinedBodyPoint` scales width/height and adds a lateral shoulder drop. Both characters currently use width/torso-height 0.9 and hip lift 12, with shoulder drops 16/11. It moves the same artwork and its markers, but does not establish scapular/clavicular motion or a distinct rib-cage volume. |
| Weighting does not model anatomical masses | `JoinedSurface` infers arm influence from distance to two arm segments and horizontal distance to the hip center. There are no separately authored chest/clavicle/upper-arm weights. Shorts blend toward the leg branches through another position-based rule. Continuous pixels can still have anatomically implausible deformation. |
| Hands are palm effectors, not wrist chains | The arm solver terminates at `palm`. There is no wrist bone/rotation and no curled/edge-on/holding attachment selection. Even perfect shoulder movement cannot fix a palm silhouette baked into the atlas. |
| Rest proportions and stance share global constants | `REST` and both leg lengths (88/70) are shared; default feet are almost mirrored. Head drawing size is independent of body calibration. The ratio of visible head rectangle to total height is a stylization/proportion concern that must be re-evaluated as a whole; it is not fixed by lengthening one limb. |
| Elbow behavior is projected correction, not an authored joint chain | The solver clamps reach and adjusts the elbow using a side/pole heuristic and further axis limits. This can preserve continuity while changing apparent segment length/volume and producing elbows that look externally mounted. |
| Foot contact is a position constraint only | The hip is clamped to a floor reach limit; foot tails are deformed by an angle parameter. There is no stance/flight phase, heel-to-toe roll, knee direction constraint, or support-leg weight transfer. Floor contact alone does not prove balance. |
| Existing Spine adapter cannot satisfy the requested runtime | `apply` clears tracks and resets setup pose for each sample; `createCharacterRig` explicitly excludes Spine for live play. Live release markers currently come from the custom `ActionTimeline`, not a Spine event. No official runtime or authored skeleton export is present. |

## What the evidence does not show

The active characters are already deforming connected meshes, not simply twelve rigid PNGs rotating at arbitrary image centers. Their documented shoulder markers are manually registered; the audit does not prove that each one is literally at the sleeve edge. The confirmed defect is the combination of setup artwork, incomplete hierarchy, shared pose constraints and heuristic weights. Doug's overshirt makes the silhouette wider, but moving its outside edge is not a shoulder-joint correction.

Faces, hair, facial hair, clothing identity, logos, rendering style and the court are not responsible for these rig mechanics. They should remain intact. A black silhouette, mirrored inspection, actual joint overlay and court-scale view are necessary before accepting fitted art.

## Reconstruction order

1. Dan is the reference. Define source landmarks, a separate balanced setup, and an asymmetric idle. The proposal in `engine/characters/anatomy/dan.ts` puts arms under clavicles and hip sockets inside a pelvis; it labels its coordinate convention and support leg.
2. Review the bare skeleton and body masses first. The center line uses an explicitly approximate illustration-mass proxy; it is not a measurement of real human forces. Reject a pose outside its support interval.
3. Fit existing illustration regions to those landmarks. Preserve head pixels and logo content. Author shoulder/waist overlap surfaces, independent wrists, relaxed/holding hands, and clothing influence masks. Do not simply apply another global shoulder drop.
4. Build the Spine setup, weighted meshes and constraints from the fitted source. Keep gameplay idle in animation tracks. The two-bone arm/leg chains must use real joint pivots; IK targets belong outside the driven chain.
5. Verify Dan's idle/shift/walk/run/throw/chest tap/reaction/celebration, silhouette, mirrored view and normal Arena size. Then fit Doug using his own anatomy and clothing layers.
6. Integrate matching official Spine/Phaser versions, with one owner of animation time and actual Spine release markers delivered through the existing controller/event boundary. Keep projectile trajectories, scoring and hit detection in Phaser.

## Spine prerequisite

The project uses Phaser 3.90, so the relevant official package is `@esotericsoftware/spine-phaser-v3`, not the Phaser 4 adapter. Match its major/minor version to the selected Editor export version. Editor availability, license/edition and export version must be confirmed before activating the integration; the requested weighted-mesh/IK authoring requires the appropriate edition. See the [official runtime guide](https://esotericsoftware.com/spine-phaser), [Editor license](https://esotericsoftware.com/spine-editor-license), and [edition comparison](https://esotericsoftware.com/spine-purchase).

The inactive adapter and a JSON landmark plan are not substitutes for those production assets. Do not mark this pipeline complete because the Lab can draw a plausible skeleton.
