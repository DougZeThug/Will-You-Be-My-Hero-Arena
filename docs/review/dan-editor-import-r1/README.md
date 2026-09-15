# Dan's first LoongBones import — diagnosis and correction

**Subsequent result:** the user imported revision 2 and its authoring workspace now works. All seven clips select/advance and both leg IK properties are present. See [the corrected editor check](../dan-editor-r2/README.md). The export round trip remains pending; the import instructions below describe the earlier handoff.

The user imported Dan's original pack into the existing authenticated LoongBones **1.2.3** project. The armature, texture, all 30 bones, seven animation names and mesh bone bindings were visible. The editor's runtime Preview rendered Dan with his approved art and proportions. **The authoring workspace did not pass:** selecting the mesh or changing a clip with that mesh selected threw an exception, and the timeline remained on `neutral`.

## Exact cause

The original pack omitted DragonBones mesh `edges`, `userEdges`, `width` and `height`. Arena's runtime renderer accepted these omissions, so the previous runtime tests did not detect this editor requirement.

The observed exception was `TypeError: Cannot read properties of undefined (reading 'length')`, at line 2, column 2190450 of the editor's public `main.94c63af5.js`. Inspection of that [public vendor bundle](https://www.loongbones.app/editor/static/js/main.94c63af5.js) located the failing outline renderer. The importer assigns `outlines:e.edges`; the renderer then reads `e.outlines.length` without a fallback. The genuine earlier `ubbie` export contains `edges`, `userEdges`, width and height. This identifies a specific serialization omission, not a shoulder/art defect or an unsupported weighted-skin conclusion.

The public script was fetched as text for inspection with Node's system CA support. It was not evaluated or used to patch the live editor. No private application state, authentication data or account API was accessed.

## Revision 2 correction

`lab/loongbones/dan-rig/skin.ts` now derives **1,028 boundary edges** from triangle incidence: a boundary edge belongs to exactly one triangle. Internal shared edges are excluded. The existing transparent-gap regions retain their boundaries. The mesh also declares its original **808×1947** dimensions and an empty authored user-edge list.

A direct deep comparison of original and corrected skeleton JSON, excluding only those four added fields, was identical. Bones, pivots, vertices, UVs, weights, IK constraints, clips and markers were unchanged. The texture is unchanged. A new browser assertion compares every exported boundary edge to actual triangle topology, in addition to the existing anatomy, planting and release checks.

Four dedicated Dan browser tests passed after rebuilding. The full regression report for the correction is saved as `regression.json` alongside this document. This revision does not change any production character, gameplay rule or runtime bridge.

The completed regression run passed type checking, simulation/animation checks, **39 browser tests**, the production build and production isolation. One opt-in visual-baseline test was skipped; this is not a new visual-baseline approval. `browser-results.json` preserves compact per-test results without the large trace/step payload. The corrected skeleton download was also exercised in the open Dan Lab.

## Editor state and next step

The first imported armature was renamed **`dan_import_r1`**, saved, and confirmed present after reloading the editor. The existing `ubbie`, `armature1` and `dan_tex` assets are preserved. The corrected local armature remains named `dan_weighted_v1`, so the next import can coexist with the original diagnostic copy.

Open [Dan's Lab](http://127.0.0.1:3010/loongbones/dan/) and use **Download corrected editor skeleton (revision 2)**. Drag that JSON into LoongBones' Library. The already-imported texture can be reused. Alternatively extract the updated full ZIP and drag only its `dan_ske.json`. Do not use the earlier extracted JSON.

The available browser control cannot perform an operating-system file drag. The corrected revision has therefore **not yet been inspected in the actual editor or round-tripped through it**. `editorRoundTripVerified` and `productionInstalled` remain false. After import, verify that the mesh selects without errors, switch/play the seven clips, check constraints, then export the current corrected armature as DragonBones 5.5 Data + Texture + ZIP and test the unchanged returned bytes in Phaser.

The prior report's normal-speed motion evidence remains relevant to local deformation because no runtime data changed. It must not be presented as evidence that the corrected editor import has already succeeded.
