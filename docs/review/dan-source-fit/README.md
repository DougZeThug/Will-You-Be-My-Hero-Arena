# Dan: visible revised source fit

**Historical, superseded:** the user rejected this assembly as too lanky. The active source now follows [the user-selected full-body reference](../dan-reference-proportions/README.md). The images and checks below record the earlier assembly, not the current appearance.

The reported Lab view was still rendering `public/assets/dan/puppet-v3.png` through the old connected paper rig. The improved source panel existed in `lab/assets/dan-source/body-v1.png` but was never fitted to a full body or connected to the Lab. Opening the ordinary Dan animation scenario therefore could not show the revised artwork.

## Open it without code

Use the **Dan · revised full-body source** link near the top of Arena Lab. Alternatively ask Astra to open the revised Dan source. Evidence view identifies it as **Dan revised full-body source · static**.

Show joints, Black silhouette, Mirror horizontally and Court scale inspect the assembled result. Court scale uses the existing sunset arena, equipment registration and card presentation at Dan's normal `(225, 610)` position. Select **Current artwork / evaluated rig** to return to the existing animated character.

## What changed

- The approved connected body panel is fitted to anatomical source landmarks. Its relaxed hand drawings replace the old open palms. The original atlas head, legs and flip-flops are reused; no new image was generated in this pass.
- Pelvis, spine, clavicles, shoulders, elbows, wrists, hands, hips, knees and ankles have explicit fitting positions. The image-left leg is the support side; the body's estimated mass projection is a design proxy, not measured biomechanics.
- Source registration is separate from the old A-pose joint data. Arm length and transverse width are fitted separately. Shorts remain attached to the pelvis instead of accidentally inheriting arm deformation. Thigh overlap and hand-over-shorts triangle ordering were checked in actual Phaser screenshots.
- The Lab API reports the visible figure as `static-source-fit`, with `source-neutral` as its static pose and no event animation timeline. `rigQA.sourceFit` explicitly reports `animated: false`, `productionInstalled: false` and `editorExport: null`.

## Scope

This is **source-fitting progress**, not a completed replacement game rig or approval of natural motion. It intentionally cannot play the old animation library. The original articulated rig, Play/Watch, scoring, characters, cards, arena art and LoongBones compatibility fixture remain separate and unchanged.

Authored joint weights, shoulder/elbow/wrist deformation, foot planting through locomotion, release sockets and continuous motion still need a real editor rig and validation. The LoongBones editor-export gate remains open; see [compatibility status](../../LOONGBONES-COMPATIBILITY.md). Do not call this an exported LoongBones character or send this source through the old A-pose registrations.

## Review evidence

Captured at 1440×1080 in isolated Chrome, Phaser 3.90.0, `character-dan`, `idle_breathe`, manual time zero. `revised.png`, `joints.png`, `silhouette.png`, `mirrored.png` and `court.png` show the actual render. `current.png` is the old game rig for comparison. `revised.json` contains the matching state.

Visual review checked the revised hand silhouettes, uninterrupted sleeve/arm boundary, shorts/thigh overlap, mirror balance, original head/footwear and court-scale readability. These stills do not certify locomotion or a full weighted rig.

`tests/browser/source-fit.spec.ts` exercises real UI navigation, reload, static-state reporting, source/production distinction, mirrored/court views and restoration of the previous production pixels. Existing rig and visual tests guard the current character rendering separately.

Validation: full regression passed with 161,408 simulation/animation checks across 2,000 seeded contests, 31 browser tests, production build and Play/Watch isolation smoke tests. After the final Lab transport/reset correction, typecheck and six focused source/rig browser tests passed. The separate visual test compared all six approved canvas baselines successfully, without baseline updates. Build emitted existing chunk-size and dynamic-import warnings. No deployment or production character migration was performed.
