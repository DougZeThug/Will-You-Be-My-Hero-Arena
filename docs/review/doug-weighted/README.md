# Doug weighted rig and cornhole motion

Doug now runs beside Dan in the main internal cornhole Lab through the native Phaser 3.90.0 / DragonBones bridge. Doug's LoongBones editor round trip is **pending**. Dan's source is his returned export with the previously documented compatibility repairs; the current motion files are further derived authoring, not unchanged editor output.

Use [the current motion review](http://127.0.0.1:3010/loongbones/doug/) or [the main match](http://127.0.0.1:3010/?scenario=cornhole-recorded). The older `character-doug` scenario intentionally retains the paper rig. Other sports, live Play and the production player app retain their established rigs.

## Foundation

- Original `public/assets/doug/ready.png`, 255×589, preserved byte for byte. SHA-256: `725048791432765dd85c413a71bf30dd6afdaaaf1f85d991484e273fd436b471`.
- Doug-specific 30-bone anatomy, weighted surface, two planted-foot IK constraints, anatomical hand sockets and warm court tint/contact shadows.
- Eleven original foundation clips remain archived under `lab/loongbones/assets/doug-weighted-v1/`. The current derived motion pack replaces its two throws with five cornhole variants, for fourteen authored clips.
- Per-game rig injection keeps the experimental editor runtime out of production. Shared semantic character commands request clips, markers and evaluated hand sockets without importing an editor implementation.
- No face, outfit, logo or source PNG repainting. Original mesh boundary calibration required a traced overshirt/forearm edge; the old horizontal cutoff incorrectly attached cloth to the wrist.

## Current motion revision

See [the full cornhole motion audit](../cornhole-motion-v2/README.md). Image-side labels in the source skeleton are not anatomical handedness. The corrected primary chain is `clavicle_L → upper_arm_L → forearm_L → hand_L → throwing_hand`, which is the person's right arm in this front-facing illustration. The artwork is never mirrored to fix this.

The new import pack is `lab/loongbones/assets/cornhole-motion-v2/doug-motion-v2-import.zip`. Extract it, import its PNG and atlas JSON into LoongBones Library, then import its skeleton JSON. Return the exported ZIP in Codex so its curves, weights, IK and release markers can be compared with the running fixture. No additional runtime purchase or Spine license is required for this local bridge.

## Limits

The single original drawing does not contain alternate palm/finger views or complete hidden body layers. Bounded motion, corrected material overlap and a small fabric underlap avoid the worst seams; close-up clothing intersections are still not equivalent to a complete artist-authored turnaround. This pass does not claim full locomotion, cloth simulation, overhand sports or production installation. Doug's native source resolution also limits close-up detail.
