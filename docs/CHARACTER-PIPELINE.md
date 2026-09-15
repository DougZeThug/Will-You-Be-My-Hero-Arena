# Character production and mapping

The revised pair is Dan and Doug Weidensaul, based on their supplied collectible cards. Danielo's card supplied additional print/style direction. The original card images are displayed without repainting or text replacement.

## Completed production

1. Generated separate full-body six-pose illustrations for each person, referencing their card. Adult proportions, identity cues, clothing and black-ink shading stay visible at game scale.
2. Inspected the actual sheets. Their apparent checkerboard was baked into RGB, so it was removed as background rather than treated as real transparency. Mask cleanup preserved shirt shading and the printed cream contour. Pose crops were inspected on contrasting backgrounds.
3. Prepared six transparent frames: ready, underarm backswing, underarm release, football cocked, basketball shot and celebrate. The aligned atlas uses 640×768 tiles with a common foot origin. Cropped frame PNGs and original card art are in `public/assets/dan` and `doug`.
4. Authored a foot origin and palm socket for every frame. `paper.ts` supplies their geometry; `rig.ts` swaps whole drawings at intentional beats. Animation includes entrance, a restrained paper step, anticipation, release, held follow-through, a celebration pose and recovery. Faces and body proportions are not continuously warped.
5. Rendered held props at the active palm socket. The simulation records release coordinates from the same geometry, including imported frame scale. A snapshot of prepared manifests travels with each new recording, so later mapping edits do not alter its playback geometry. Replacing a file at the same asset URL can still change its pixels; production assets should have content-versioned URLs.

## Current limitations

Six drawings provide limited 2D animation, connected by foot-aligned fades and a shared match state timeline. Palm markers drive held props through those transitions and coincide with the saved release position. Walking is a small whole-paper step, disappointment is a modest tilt, and football transitions from a cocked pose to the shared extended-arm drawing. Unique dense in-between frames, face reactions, expressive finger/edge contact and distinct per-person entrances remain a later animation pass. The generated likenesses are interpretations of the illustrated cards, not scans of the people.

## Prepared imports

The collection → Asset mapping validates a prepared JSON manifest, checks asset loading, attaches it to an existing catalog ID and previews motion. It accepts this authored human paper-frame family, with six required poses, frame dimensions, finite foot/palm coordinates, a frame scale and all four event actions. New pets or unusual anatomy need their own reviewed drawings and action mapping. It is not a skeleton editor or arbitrary image retargeter.

Keep original collectible artwork separate from arena frames. For each new person, prepare consistent right-facing drawings, verify likeness in all poses, remove background contamination, align feet, locate the palm, and inspect prop registration and contact timing in the running game. Prompts and generation provenance are in `docs/art-prompts/`.

The Heat check effect is cosmetic; results always come from the saved shot/contact record.
