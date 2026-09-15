# Anatomy audit evidence — September 11, 2026

**This is diagnostic evidence of the existing characters and an unfinished Dan skeleton proposal. No corrected production artwork or Spine rig is installed.**

Read the [root-cause audit](../../CHARACTER-RIG-ROOT-CAUSE.md) and [production pipeline / remaining gates](../../SPINE-PRODUCTION-PIPELINE.md).

## Inspect without writing code

Open [Arena Lab — Dan](http://127.0.0.1:3010/?scenario=character-dan&animation=idle_breathe). Expand **Anatomy / rig inspection**. Toggle joints, silhouette, mirror and court scale. Select the setup/idle proposal to inspect the planned hierarchy separately from the existing art. Doug's actual rig is inspectable too; no Doug reconstruction has been approved yet.

## Still-image evidence

| View | Dan | Doug |
|---|---|---|
| Actual solver joints and target positions | [Dan](dan-current-joints.png) | [Doug](doug-current-joints.png) |
| Black silhouette | [Dan](dan-current-silhouette.png) | [Doug](doug-current-silhouette.png) |
| Mirrored at court scale | [Dan](dan-current-mirrored-court.png) | [Doug](doug-current-mirrored-court.png) |
| Draft setup skeleton | [Dan proposal](dan-setup-proposal.png) | Not started |
| Draft asymmetric idle skeleton | [Dan proposal](dan-idle-proposal.png) | Not started |

Each still has a matching `.state.json` with the exact seed, clip, time, root transform, solver landmarks and QA options. Source images and identities are unchanged. The Dan proposal's roughly 62% image-left support estimate is a design proxy, not measured biomechanics or an implemented IK rig.

The silhouettes retain a symmetric load-bearing stance with little arm/torso negative space. Actual palm endpoints explain the rigid visible hands. Moving the whole torso cannot independently rotate chest/pelvis or relax clavicles. Those findings agree with the source-code audit.

## Motion evidence

Four 4-second real-time canvas recordings were captured in Chrome 153.0.8010.37; selected decoded frames were visually inspected:

- [Dan — current run clip](dan-run.webm)
- [Doug — current run clip](doug-run.webm)
- [Dan — current airmail action](dan-throw_airmail.webm)
- [Doug — current airmail action](doug-throw_airmail.webm)

These are isolated production clip/rig samples, not a new natural gait or the full live running simulation. The Lab no longer inserts its 0.45-second action-settling pause between gait cycles. The recordings expose existing shorts/hip deformation, palm-only arm control and the static torso/pelvis relationship. Capturing video without browser errors does not certify motion quality. Full normal-speed artistic approval remains part of the future weighted-rig gate.

The [Watch screenshot](production-watch.png) and [Play screenshot](production-play.png) confirm that the existing figures, cards and court still load at gameplay scale. Play's screenshot deliberately includes the normal pause overlay after readiness was verified.

## Validation and regression review

- TypeScript check passed after the final code changes.
- Pure suite passed: 161,408 checks across deterministic rules, persistence, inputs, geometry/animation and 39 added anatomy assertions; 2,000 seeded contests.
- Final browser suite: 26 passed, 1 optional visual test skipped. Five of the passing tests cover the new rig inspector and continuous gait preview.
- Separate visual comparison passed: six reviewed fixed-clock reference images, no baseline updates.
- Production build and Play/Watch/isolation checks passed. Existing chunk-size/dynamic-import warnings remain; no gameplay code, source art or published site was changed in this anatomy pass.
- One intermediate browser run was interrupted by a development page reload while a Lab source edit was being made. The unchanged-source rerun passed, including that controller checkpoint test.

The [aggregate regression report](regression.json) records the full five-stage pass before the final Lab-only additions; [final browser results](browser-results.json) and [pure results](pure-tests.json) record the subsequent checks. No new regression was found in these inspected paths. Physical controller feel/haptics and finished Spine motion are not certified by these tests.

## Remaining blocker and unfinished work

Spine Editor license/edition/version is still unconfirmed. The official runtime has not been installed or activated. Dan's source fitting, weighted meshes, constraints and authored clips remain unfinished; Doug follows only after Dan passes. Two generative source trials were rejected for unusable transparency and pose/logo fidelity; neither replaced a production asset. Their prompts and rejection reasons are saved in [the trial record](../../art-prompts/anatomy-source-trials.json).
