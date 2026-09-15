# Natural posture reference pass

Adjusted Dan and Doug to the user's Photo 1 reference: lower sloping shoulders, more space beside the neck, arms resting beside the shorts, a slimmer torso, longer visible legs and a slightly narrower stance. The existing PNG artwork, faces, outfits, court, cards, equipment and UI are unchanged.

The correction is a per-character rest-shape calibration applied to both the connected upper-body mesh and its neck/shoulder sockets. Hip height and leg lengths change together while soles remain on the court. Dan's thigh registration now hides the duplicate short-hem edge. Neutral hand positions and the two built-in idles were adjusted; authored throws, entrances and reactions return to the new rest pose. Throws still meet the recorded release palm.

The final review captured 1,920 frames at 60 fps across both characters' idle, entrance, celebration, miss and four sports. Inspected the reference-matched idle, crossed-hand/chest-tap poses, overhead arms, lifted feet and recovery. The alpha scan found zero detached regions above the 25-pixel threshold at half resolution. A 32-second normal-speed and 64-second half-speed recording are saved beside a direct before/after comparison. These checks measure continuity and aid visual inspection; they are not a realism score.

TypeScript, the production build and 51,875 automated checks pass, including shoulder position below the neck, planted feet, both characters' elbow continuity, all-sport release palms and malformed posture rejection. The packer passes 20 checks including calibration round-trip and legacy pack compatibility. The corrected authoring example, guidance and validation are installed in the existing card-to-character workflow.

Reloaded the local arena and completed the 3–5 cornhole showcase exhibition. Inspected its on-court poses and replay. Existing 3 club points and 3 remaining counted entries were retained; exhibitions awarded zero points.

Current review files in `outputs/animation-review`:

- `natural-posture-comparison.png`
- `natural-posture-60fps.mp4`
- `natural-posture-half-speed.mp4`

This supersedes the shoulder-only posture in the earlier repair videos. It remains 2D illustrated animation with fixed hand and face drawings.
