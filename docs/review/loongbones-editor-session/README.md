# LoongBones editor session — 2026-09-12

Historical session status: editor access and manual keyframing verified; export delivery was initially blocked. **Resolved later on 2026-09-12:** the user supplied the original ZIP and its textured example now runs in Phaser 3.90.0. See [the completed export review](../loongbones-editor-export/README.md). The observations below preserve the earlier session chronology.

## Saved project

[Arena Compatibility Test](https://www.loongbones.app/editor/?workId=NfiK5sO1), visible editor version **1.2.3**. Created in the user's authenticated session and saved with the editor's Save control.

- `armature1`: built-in Human preset with Stickman shape attachments. Astra manually keyed `compat_wave` at frames 0, 30 and 60, at 30 FPS. Shoulder rotation: 133.43 → 65 → 133.43 degrees. Elbow: 15.64 → -65 → 15.64 degrees. The middle pose was inspected in the editor. This is a diagnostic stickman, not Dan and not a claim of finished animation quality. Easing and an authored release marker were not completed.
- `ubbie`: loaded from the editor's own **Mesh Example**, including its existing `stand`, `walk`, `turn face` and `atc` clips. This became the current export target. These are example animations, not Astra-authored Dan motions.
- LoongBones AI attempted the bounded animation request but reported that AI animation generation requires VIP. No subscription was purchased. The manual clip name was shortened because the editor enforces a 16-character animation-name limit.

## Export observations

The actual Export panel offers data versions 6.0 and **5.5**. The saved handoff uses Current Armature (`ubbie`), Dragonbones Json, 5.5, Texture Atlas, output scale 1, Keep Armature Scale Unchanged, no background color, and Data + Texture + ZIP. See [settings screenshot](export-settings.png).

The initial Stickman export reported that texture export failed because no texture was available or packing size was too small. This is not a valid textured compatibility fixture.

The textured Mesh Example export completed its dialog, but the supported browser download event timed out, including a 55-second attempt. A separate data-only, non-ZIP export explicitly reported `Export successful`, also without a delivered download. No `arena-editor-test` or `loongbones-web` output was found in the inspected Downloads/workspace paths. This narrows the issue to export delivery, but does not establish whether the fault is in LoongBones or the in-app browser. No raw export bytes or hashes are available. No data was fabricated or rewritten to pretend that an export succeeded.

## Original handoff (completed by the user)

Open the saved project in Chrome or Edge and export the current `ubbie` armature using the settings above. Attach the resulting ZIP in Codex, or tell Astra its saved path. If the browser asks for a download location, use Downloads. The dialog in the current Codex editor tab is also left ready for a direct user export attempt.

Once actual files exist, Astra should preserve the original ZIP, extract skeleton JSON + atlas JSON + PNG locally, record hashes and editor provenance, load them through the existing Lab proof, and test actual rendered clips, mesh deformation, markers, pause/replay and mirror behavior. Keep `freshLoongBonesExportVerified` false until that evidence exists.

Dan's approved proportions and static source remain unchanged. No production code, runtime dependencies or gameplay changed during this session. Automated game suites were not rerun for this documentation-only repository update; UI authoring/export attempts do not substitute for the still-pending runtime tests.
