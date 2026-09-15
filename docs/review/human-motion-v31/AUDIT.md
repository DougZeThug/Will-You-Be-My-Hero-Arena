# Human Motion V3.1 — before-change audit

Reviewed the complete 104.6-second V3 MP4 before runtime edits: all 3,138 frames decoded, 210 half-second observations inspected sequentially across 18 contact sheets, then live near-arm/layer isolation at setup, backswing, release and follow-through. Evidence is in `work/qa/v31-before/`.

## Doug's anatomical right arm (legacy image-side `_L` bones)

The source-to-bind affine registration in `side-rig/build.ts` maps three nearly collinear shoulder/elbow/wrist points with one unconstrained 2D affine transform. Doug's linear matrix is `[[1.18644,-0.02542],[-0.01718,0.94381]]`, with principal stretches **1.18830 / 0.94196**. This widens the isolated arm while shortening it. The sleeve hides its proximal width at rest; the forward swing exposes the already enlarged skin silhouette.

The ten evaluated setup/throw poses have pelvis, chest, clavicle, upper-arm, forearm and hand global scales **1 / 1**. Joint-oriented opaque mesh cross-sections remain effectively constant away from the elbow (about 105.94 source units through upper-arm midsection, 86.10 at forearm 45%). Thus this is not repeated inflation by animated scale, IK stretch or FFD. The isolated arm itself is bulky with both sleeve meshes hidden. There is one near-arm mesh; the back/front cuff overlap does not create a duplicate full arm. The source drawing is broad, and the unconstrained registration magnifies that breadth unnecessarily. The hidden cap already tapers under the sleeve and should remain inserted there.

The opposite upper arm is largely hidden by clothing. Measuring the entire `body` layer across that bone also crosses shirt material and is **not** a valid arm-width measurement. Use the visible far forearm skin/weight region for comparisons; do not misreport shirt width as anatomy.

Correction: register each source limb segment with its anatomical length ratio and rotation, blend the elbow neighborhood, and keep the shoulder/elbow/wrist landmarks fixed. Preserve transverse proportions instead of solving an ill-conditioned affine fit. Recompute bind vertices before inverse-bind parsing; retain source pixels, UVs, skeleton, hand registration and animation. This is a documented derived geometry correction, not a new body drawing or an unchanged editor export.

## Cross-event findings

- Cornhole has a coherent measured throw. Keep its release, full-body tracks and fixed-gravity bag. Chest contact is visible but needs less neutral-pose approach and a cleaner second body response; repeated frame-49 keys in the gesture deserve inspection.
- Running has correct established numerical foot locks, but a flat, non-articulating foot, small prescribed pelvis bob and immediate cycle selection do not read as propulsion. A speed-fit number alone cannot establish push-off. Start/stop need support-aware loading, shorter exit steps and contact-oriented toe/heel behavior.
- Basketball has actual 60.5/42.35-world-pixel motor jumps and impact compression, but the long staggered cornhole stance, arm-dominant set, mild load and automatic close-camera reframing conceal the lower-body action. Preserve actual ball sampling/gravity and rebuild setup/loading/landing poses around a shooting stance. Do not solve this with a taller camera-tracked translation alone.
- Combat body centers remain separated, but the 98-pixel combined body radius does not represent desired guard range, and both source drawings face right. Attacks must visually aim toward the opponent using directional skins with semantic handedness and readable text preserved. Existing motor sweeps, contact markers and inertial blending remain reusable.

No runtime/artwork modifications preceded this audit. Source originals and production integration gates remain preserved. The requested order is arm geometry → integrity tooling → running → basketball → combat facing/spacing → cross-event reference/personality validation.
