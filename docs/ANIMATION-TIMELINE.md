# Match animation

Current animation: see [Articulated animation](ARTICULATED-ANIMATION.md). New packs can include a version 2 continuous-limb atlas and custom joint tracks; original eight-image packs retain the pose renderer.

The existing PixiJS renderer uses one `PlaybackClock`. Pose blends, portal masks, glows and transforms are pure functions of recorded time, so pause, half speed, double speed, replay and backward seeking sample the same action.

`match-timeline.ts` owns the sequence:

`entrance → ready → anticipation → throw → release → bagFlight → landing → result → reset`

The 2.65-second entrance includes card impact, charge, emergence, landing and a character pose. Players enter 0.74 seconds apart. The clock waits for both asset readiness and completion of the setup dialog's closing transition, instead of racing the dialog or relying on a timeout.

Independent throw and celebration choices own cadence; the 24 starter profiles provide overridable defaults. At standard tempo Dan takes approximately 0.68 seconds to release, with a measured wind-up; Doug takes approximately 0.49 seconds, with a quicker forward motion. Small seeded variations are recorded. The profile controls pose anticipation, follow-through, result and reset without changing accuracy or target selection.

| Event | Recorded flight duration |
| --- | --- |
| Cornhole | 1.25 s, including a 0.28 s board slide |
| Football | 0.78 s |
| Beer pong | 1.25 s |
| Basketball | 1.38 s |

Release is the first 0.05 seconds of flight, not a pause before it. The release drawing is fully visible and its transform is neutral exactly when the saved prop trajectory begins at the palm. `motionSocket` applies the same foot anchors, blend and transform to a held prop as it applies to the character art.

The landing beat lasts 0.16 seconds. Scores, attempt counts and result sounds then resolve together. Commentary announces the active player, switches to the outcome at landing, and retains it through the reaction and reset. Dan's standard result/reset durations are 0.85/0.30 seconds; Doug's are 1.02/0.33 seconds. Scores resolve within about 2.3 seconds; complete turns allow up to 3.7 seconds so a gesture can finish naturally. The next player becomes active after the current player returns to their quiet waiting idle.

The projectile follows its saved trajectory with a linear endpoint correction that preserves one airborne parabola while meeting the illustrated equipment. A board bag settles its angle and size during the slide, then becomes one resting sprite at the same position. The existing responsive camera framing is retained, with no final-shot cinematic zoom.

New recordings use version `paper-arcade-2.0.4` and include immutable motion profiles. Scores, seeded targets and trajectory samples are unchanged. Historical recordings retain their saved durations and checksums; rendering their personality does not rewrite them or award points again. Omitted profiles receive compatible defaults.

See `CHARACTER-PERSONALITIES.md` for presets and extension points. Current built-in figures use continuous illustrated limb meshes with authored joint motion; the six full-body cutouts remain the compatibility format.
