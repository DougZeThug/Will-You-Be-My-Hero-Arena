# Dan: user-selected proportions, revision 2

The user rejected the previous Lab assembly as too lanky and supplied an earlier full-body illustration as the desired appearance. The rejected assembly narrowed the torso, reduced the head and remapped limbs to a generic anatomical proposal. Further independent resizing also changed the pose. That assembly is superseded.

The current Lab source is [full-body-v2.png](../../../lab/assets/dan-source/full-body-v2.png). It is a built-in image_gen background-cleanup edit of the user's selected [reference](../../../lab/assets/dan-source/proportion-reference.png). The exact [edit prompt](../../art-prompts/dan-reference-background-v2.txt) requested preservation of the complete figure and replacement of the painted checkerboard with the existing loader's magenta chroma key. Prompt, generated filename and scope are recorded in [provenance](../../../lab/assets/dan-source/provenance.json).

The Lab displays the complete source using one uniform scale. There are no separate head, torso or limb dimensions, no old atlas assembly and no mesh deformation in this view. Source-space anatomical points register the selected drawing for inspection and future authoring. They do not drive its pose. The rear foot keeps the source's slightly higher position in the three-quarter ground projection, with a matching contact shadow.

Open Arena Lab → **Dan · revised full-body source**. Existing source-fit URLs still work. `rigQA.sourceFit` reports revision 2, `uniform-source-registration`, equal horizontal/vertical scale and `deformed: false`. It also explicitly reports no animation, no production installation and no LoongBones export.

`before.png` records the rejected lanky assembly. `revised.png`, `joints.png`, `silhouette.png`, `mirrored.png` and `court.png` capture the current actual Phaser render at 1440×1080, manual time zero. `state.json` contains the corresponding source/pose information. Visual review compared the larger illustrated head, torso volume, arm reach, natural hands, legs and oriented flip-flops against the user's full-body reference.

Validation: TypeScript passed; all six focused source/rig browser tests passed, including actual Lab navigation, reload/reset, static-state reporting, uniform source scaling, source/production distinction and restoration of the unchanged production character pixels. The six existing approved visual baselines passed without updates. Full simulation/build regression was not repeated for this Lab-only source substitution; gameplay, production code and runtime dependencies were untouched.

This is a static source correction. Weighted rigging, deformation and continuous animation QA remain unfinished. Preserve this figure's proportions during the LoongBones authoring work rather than forcing it back onto the rejected tall proposal.
