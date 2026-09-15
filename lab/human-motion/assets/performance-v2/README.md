# Arena performance-v2 editable LoongBones pack

This pack contains Arena-authored native animation derivatives for Dan and Doug. It preserves their approved source art and existing hand drawings. It is used by the local Human Motion Lab authoring pipeline; production Play/Watch has not been migrated.

Each character folder contains:

- `*_ske.json`: DragonBones 5.5 skeleton, weighted meshes and native animation clips.
- `*_tex.json` and `*_tex.png`: packed existing character and hand atlas.
- `authoring.json`: semantic clips, contacts and provenance.

For editor review, create a separate LoongBones work, import the texture/atlas and then the skeleton. Keep the earlier editor work intact. Export the result and return the ZIP in Codex for structural and rendered comparison. Editor key editing does not require modifying Arena gameplay code.

The exact Phaser 3.90.0 / pinned DragonBones 5.7.000 local import path has been tested. The external editor import could not be completed through the available browser file chooser. Therefore `editorRoundTripVerified` and `productionInstalled` remain **false**. These files are not claimed to be returned editor exports.

Arena owns dynamic ground contacts, world travel, semantic input and final evaluated socket/projectile handoff. Native clips remain editable; world-space runtime contact corrections are not represented as a fully baked editor scene.

See `docs/review/performance-upgrade/README.md` for the implementation and validation record.
