# Organic performance — review record

This pass extends the opt-in Human Motion V2 Lab with shared, restrained body response over the existing authored LoongBones animation. It preserves the source art, hierarchy, skin weights, proportions, gameplay outcome rules and production Play/Watch. It does not promote the experimental motion library to production or claim an editor round trip.

## Findings and changes

The existing native clip blending connected poses but did not provide a shared balance/settling response. Pelvis, chest, opposite arm and head needed independent timing, and recovery did not consider the evaluated outgoing pose. The new common performance layer supplies delayed segment responses, small overshoot, coherent breathing, balance estimates, opposite-arm compensation, target stabilization and bounded inertial residuals. Dan's quieter, more compact response and Doug's looser, longer settling come from persistent motion traits used across techniques.

Two concrete defects surfaced during the new browser tests:

- At the semantic release boundary, native color interpolation could still show the grip drawing for one tick. The release event now commits the registered open-hand exposure in the same simulation step as projectile detachment. It does not advance a second clock or replace the hand art.
- Running to the taller idle could demand about 126 px from a roughly 123 px support leg, producing 2.78 px of locked-contact drift. Bounded pelvis compression now keeps the foot within the actual chain's reach. The foot is not moved and the leg is not stretched.

Combat review also found that the authored extension peaked after its hitbox interval. The visible jab now extends within that interval, with preceding pelvis/spine/chest motion. The timing markers, health rules and controller route remain unchanged.

The first failed organic browser run and stop-drift probe are retained under `work/qa/organic-motion/browser/` and `stop-drift.json`. The tests were not weakened to accept those defects.

## Review without coding

Open [Human Motion V2](http://127.0.0.1:3010/human-motion/?event=cornhole&actor=dan&take=primaryAction). Choose a character and action, then **Load take** and **Play**. Try 1× and 0.25×, and switch **Camera framing** between the arena and either character. Disable Skeleton and Trails for an unobstructed view. The same controls provide a running start/stop, basketball shot or jab.

The **Organic performance** toggle isolates the new supplemental motion layer; release/contact safety fixes remain enabled in both modes. The curve panel shows evaluated positions, speeds and accelerations, plus chest angle. **Export motion curves** saves real rendered-joint samples. A measured reference appears in dashed purple when loaded. The included measured demo is an unmatched action and must not be described as a cornhole comparison.

## Mechanical evidence

- Both cornhole takes pass one-release, evaluated hand-origin continuity, opaque grip-to-open exposure, identifiable forward weight transfer and ordered supplemental response peaks.
- Dan's pelvis-to-wrist supplemental peak spread is about 175 ms; Doug's is about 217 ms. These are **performance-layer response peaks**, not measured human joint-velocity peaks. The actual evaluated-joint curves are separately exportable.
- Locked-contact error is below 0.01 world px in the selected single-action cornhole, running start/stop, basketball and jab takes. This measures the registered ankle/contact target, not every sole vertex or pressure distribution. It does not establish universal zero foot slip across all possible gameplay.
- Running retains acceleration and reaches a stationary stop; basketball takes off, releases once and lands; fighting uses startup/active/recovery and closes its hitbox. All continue through the same semantic controller, motor, planner, graph and native adapter.
- A separate unrecorded 12-second desktop Chromium run measured 56.9 FPS, 18.2 ms p95 cadence, 5.01 ms mean update work and 1.51 ms mean render work. These are local samples, not a 60 FPS guarantee or GPU profiling result.

The full regression passed typecheck, **169,905 pure checks**, **82 browser tests**, production build and production isolation; one optional approved-image baseline suite was skipped. A subsequent Lab camera-framing fix passed typecheck, all four organic browser tests and the 22-image review again. Close framing now fits raised hands instead of clipping the basketball shot. No gameplay or animation transforms changed in that final framing fix.

Final regression outcomes and source hashes are in `validation.json`. Continuous video, detailed state samples, failures and final screenshots stay in `work/qa/organic-motion/` so future agents can reproduce and compare them. Continuous MP4s: [Dan 1×](../../../work/qa/organic-motion/review-videos/dan-cornhole-1x.mp4), [Dan 0.25×](../../../work/qa/organic-motion/review-videos/dan-cornhole-0.25x.mp4), [Doug close 1×](../../../work/qa/organic-motion/review-videos/doug-close-cornhole-1x.mp4), [Doug close 0.25×](../../../work/qa/organic-motion/review-videos/doug-close-cornhole-0.25x.mp4). The same folder includes running, basketball and fighting at both speeds. MP4s are H.264/yuv420p, constant 30 fps, with clean full-decode verification. Their source WebM captures and time mapping are retained. The final camera-only fit change is shown in the final stills; recorded skeletal motion is unchanged.

Curated stills: [Doug follow-through](doug-follow-through.png), [basketball close view](basketball-close.png), [curve review](curve-review.png). The dashed reference curve is deliberately labelled as an unmatched demo.

## Visual assessment and remaining limits

Cornhole has a connected underhand swing, visible release, continuing torso/arm motion and independently settling recovery. Dan and Doug retain their approved silhouettes and different rhythms. Close and arena-scale review remain necessary: the additive layer is small by design and cannot repair a badly authored clip.

Running starts/stops and basketball loading/jumping/recovery demonstrate transfer of the shared body logic. These are still athletic proofs. Sole articulation, a dedicated basketball wrist/finger finish and richer gait poses remain art/authoring work. The combat jab demonstrates whole-body timing, but the existing open-hand drawings and same-facing opponent do not constitute a finished fighting presentation. Do not flip faces/logos as a shortcut.

There are three registered hand drawings, not individual finger bones; there are no separately authored cloth/hair helper bones. The balance model is a screen-space proxy, not measured human forces. Pose matching chooses settling policies, not a large authored motion-matching database. Corrections are bounded, so inertial blending is not a blanket guarantee of continuous velocity at every transition.

The existing CJ Marquez video study remains the visual timing reference. A calibrated side-view cornhole landmark track is still needed before quantitative reference-fit claims. The NumPy/OpenCV comparison tool was exercised with the explicitly labelled general-motion demo; SciPy and another browser engine were unnecessary.

See [the implementation contract](../../ORGANIC-PERFORMANCE.md) for module responsibilities, extension rules and reference-processing commands.
