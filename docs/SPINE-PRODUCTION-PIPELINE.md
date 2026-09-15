# Spine production character pipeline

**2026-09-11 update: the user has no Spine license and has selected LoongBones for evaluation. Spine integration is paused. Follow [LOONGBONES-COMPATIBILITY.md](LOONGBONES-COMPATIBILITY.md) for the active runtime proof. The anatomical, source-fitting and motion-quality requirements below remain relevant; the Spine-specific implementation is historical.**

This is the integration and authoring plan following the [root-cause audit](CHARACTER-RIG-ROOT-CAUSE.md). **Production remains on its existing connected meshes. The new Lab inspector and Dan landmarks do not constitute a completed Spine character.**

## Current readiness

| Gate | Evidence / remaining work |
|---|---|
| Inspect source and active solver | Complete. Both original atlases, active Phaser meshes, pivots, source palms, torso and hip rules inspected. |
| Diagnose rendered anatomy | Current joint, silhouette, mirror and court-scale views available in Lab. Missing bones are explicitly reported. |
| Dan anatomy | Draft landmark hierarchy, separate setup/idle targets and approximate balance checks. Source fitting and artistic approval remain. |
| Preserve source identity | Existing source untouched. Two generated trials rejected for transparency/pose or mascot drift; prompts and reasons recorded in `art-prompts/anatomy-source-trials.json`. |
| Layered source | Not complete. Existing atlases contain useful head and relaxed arm drawings, but lack the required shoulder/hip/clothing influence maps and independent hand orientations. |
| Spine authoring | User confirmed no license. Paused in favor of the LoongBones compatibility proof. No weighted Spine mesh, IK or authored animation export is present. |
| Runtime | Phaser 3.90 is installed. Official matching Spine runtime is not integrated. Existing optional adapter is a legacy sampling boundary, not production readiness. |
| Dan motion / Doug reference | Pending approved Dan source and rig. Do not copy the old deformations into Spine or start mass-producing characters. |

## Three different pose artifacts

1. **Source anatomy:** the actual drawing registered to skull, neck, shoulder sockets, elbows, wrists, rib cage, pelvis, hip sockets, knees, ankles and contact points. Preserve source head/logo pixels where possible. A generated likeness is not proof of pixel preservation.
2. **Setup:** balanced bind geometry with modest arm/leg separation, enough coverage to weight the joints, clean elbow/knee locations and external IK targets. Not a visible gameplay idle.
3. **Idle animation:** character-specific asymmetric support and breathing. Dan's proposal favors image-left support; Doug needs a separate pose with a mechanically supported waist gesture. Never save both as one shared REST pose.

Draft data is in `lib/arena/engine/characters/anatomy/`. It is **not imported by production**. Units are character-local pixels, positive Y downward, floor at zero, L/R by image side. Convert coordinate conventions explicitly at the Spine boundary. The projected mass calculation is a design approximation, not measured human biomechanics or a physics solver. Screen-space draft landmarks still need fixed bone-length/foreshortening decisions when authoring.

## Source fitting requirements

Start with Dan only. Keep the original head and printed mascot as protected source regions. Fit torso volume and pelvis first; register sockets under the sleeve/shorts outlines. Reuse the existing relaxed-arm drawings where appropriate, but reconnect clothing/body surfaces with weighted overlap rather than placing hard sprite hinges.

The delivered source must include editable regions or meshes for chest/shirt, neck/shoulder transition, pelvis/shorts, both continuous arm surfaces with wrist controls, both leg surfaces and planted footwear. Provide relaxed, hold and gesture hand attachments. Preserve Dan's flip-flops. Doug later adds independently weighted overshirt panels and his sneakers.

Check real alpha or an explicitly supported key background. A painted checkerboard is not transparency. Flat PNG cutouts alone are not the rig: the shoulder, waist and hip boundaries need influence weights across neighboring anatomical bones.

## Authoring contract

The hierarchy uses root → pelvis → lower/mid spine → chest → neck/head. Clavicles branch from chest; shoulders/upper arms, forearms and hands descend from them. Hips branch from pelvis, then knees, ankles and feet. Foot/hand targets stay outside their driven IK chain. Keep visual contact points separate from ankle/wrist joints.

First rig deliverables:

- Editable Spine project and versioned JSON or binary export, atlas and texture pages.
- Multi-influence shoulder/chest/clavicle/upper-arm weights; waist/pelvis, hip/shorts and elbow/knee transitions tested across range of motion.
- Foot plant and hand-hold constraints with meaningful targets.
- Distinct idle, weight shift, walk, run, basic throw, chest tap, reaction and celebration.
- Semantic animation-to-export mapping and actual export events: release, grab, plant, footstep, land, hitboxOn/Off, cancelWindow as applicable.
- Reviewed close-up, silhouette, mirrored, normal-scale and normal-speed evidence. Finite coordinates or unbroken pixels alone do not pass the quality gate.

Do not substitute a hand-written empty skeleton, a generic stick-figure demo or a renamed old pose library for these deliverables.

## Runtime integration sequence

Use the official `@esotericsoftware/spine-phaser-v3` package for this Phaser 3 project, matching Editor/export major.minor. Confirm Editor license/edition and available authored project before activation. See the [official integration guide](https://esotericsoftware.com/spine-phaser) and [Editor license](https://esotericsoftware.com/spine-editor-license).

Replace the inactive sampling boundary only after a real export can be loaded and tested. The current `SpineCharacterRig.apply` clears every track for every sample; that behavior must not be reused for ordinary playback. Preserve persistent track entries and mixes during playback; use a separate silent deterministic seek path. Sampling a release socket must not disturb the displayed track, duplicate sound/release events, or advance physics.

Build the semantic animator behind the existing character controller: play/mix, base and upper-body layers, listeners, attach/detach and aim target. Event modules request semantic actions and never call Spine internals. Character profiles choose export overrides and personality pools. Do not duplicate controllers for AI, humans or sports.

For live play, explicitly inject the animation driver at the session/component boundary. Current `AnimationComponent`/ActionTimeline owns custom markers, while `CharacterPresentation` renders those states. Replacing only the renderer would leave gameplay on the old release timers. There must be one authoritative source of animation markers per character action. Deliver each Spine release/hitbox marker once through the existing fixed-step command/event boundary, then let Phaser event physics own projectiles and collisions. Keep held objects on the evaluated hand transform up to that release.

For recorded Watch playback, outcomes and historical release/contact timestamps remain immutable. Use controlled time mapping to the authored marker and silent seeking. Do not resimulate winners when changing rigs, replaying or scrubbing. Store any new rig/export identifiers with future recordings without reinterpreting old recordings.

Audit `createCharacterRig`, `CharacterAssetLoader`, `CharacterPresentation`, `ArenaSession` and recording asset validation together when enabling Spine. The current live constructor explicitly excludes Spine; toggling that condition alone is not a migration.

## QA in ordinary language

Ask Astra: “Open Dan in the Lab, show the real joints, then compare silhouette and mirror at court scale.” Or: “Show Dan's setup and idle skeleton proposals.”

In Arena Lab select **Dan · animation** or **Doug · animation**, then expand **Anatomy / rig inspection**. Show joints, black silhouette and horizontal mirror independently. Dan also has setup/idle proposal views. They intentionally hide the current artwork instead of suggesting it has been fitted.

The read-only snapshot exposes `rigQA.current` (actual solver joints and absent controls) and `rigQA.plan` (draft landmarks, hierarchy, approximate balance and explicit `fittedArtwork:false`). `setRigQA` controls only this internal presentation; normal production screens contain neither the controls nor the API.

Browser tests verify actual socket alignment, isolated snapshots, unsupported options, both characters, setup/idle separation and pixel-identical restoration. The production regression suite protects Watch/Play, input, scoring, storage and asset loading. These tests protect the tool and existing behavior; they do not certify natural animation.
