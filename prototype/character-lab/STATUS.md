# Character Lab status

**The cut-out view rig is frozen** as of commit `00523ab` (`views/`, `prototype/motion/prep`,
`rigs/`). It failed visual review: at rest it matches the drawing, but in motion Doug reads
as separate pieces (see `work/qa/character-lab/shoulder/closeup-before-*.png`). An interrupted
shoulder repair pass is in history (commit before the revert) and is not part of the build.

**Current test: one short shot to win.** Doug takes two quick steps, plants, reaches across
his body and snaps into a turn. Same outfit and likeness, normal speed, game size, no cuts.
The frozen cut-out rig is shown beside one different construction, driven by the same frames:

- `shot/`: the authored 3D performance (frames per `INTERFACE.md`).
- `volume/`: "drawing on volume": the owner's drawing wrapped onto a low inflated 3D body, so
  shoulder, sleeve and torso are one skinned surface with real depth, the depth buffer decides
  what is in front per pixel, limbs shorten by projection and the chest actually turns.
  Outlines and the sticker border are generated from the current silhouette.

Nothing here is imported by the shipped game.
