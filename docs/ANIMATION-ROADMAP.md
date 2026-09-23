# Animation roadmap

Where character motion stands and what is next. The target style is between
NBA Jam and a Saturday-morning cartoon, leaning cartoon, on top of real sport
mechanics, with Dan and Doug still looking like their drawings. Current
runtime routing lives in [`ANIMATION-HANDOFF.md`](ANIMATION-HANDOFF.md).

## Where things stand

| Surface | Rig | View |
|---|---|---|
| Watch cornhole | side-v3 LoongBones performance rig (authored takes) | profile |
| Play cornhole | same rig, live throw clock | profile |
| Play running | side-v3 Human Motion animator (`PlayMotionRig`) | front at the start and finish, profile while running |
| Play fighting | same, combat vocabulary | front for the intro and result, profile while fighting |
| Watch basketball, football, beer pong | front-view cut-out puppet | front |
| Any character without side art | front-view cut-out puppet | front |

Shared polish: fixed-step interpolation, continuous curves and crossfades,
overlap springs, squash and stretch, cartoon impact effects, camera punch and
shake, Play hit-stop, paper-flip turns, foreshortened front-view knees and
elbows.

## Next

1. **Watch basketball, football and beer pong in profile.** The biggest
   remaining realism gap: a throw across the court drawn on a figure facing
   the camera. Needs:
   - a seek-safe side animator for Watch (stateless sampling, or a replay from
     the recording start on seek, like the cornhole performance controller);
   - authored side-rig takes for a football spiral and a beer-pong toss (the
     Human Motion basketball `shoot` is a starting point);
   - releases taken from the rig's evaluated hand with ballistic flight to the
     recorded target, as cornhole does (`ballisticFlight`), so recordings,
     scores and contacts stay unchanged.
2. **More views (art).** The view system (`CharacterView.ts`) supports more
   angles, but each needs drawings: a three-quarter front view (for throws
   toward the camera, or walking in depth) and a back view. The existing
   rear-garment material came from a separate image-generation pass;
   likeness-preserving new views need approved art from the owner.
3. **Fighting vocabulary.** A real two-hand guard and cross need an authored
   hidden far-arm layer; uppercut, finisher and grapple need their own takes;
   a knockdown/KO fall and a victory pose in profile.
4. **Motion capture.** Throws are take data (`arena-performance-take-v1`,
   see `lib/arena/engine/performance/takes/README.md`). Add an importer from a
   side-view capture (e.g. `scripts/motion-reference/extract.py` output or
   BVH) to the take schema, with steps in the foot channels, then a short
   cartoon exaggeration pass. The same pipeline should feed running and
   fighting takes for the side animator.
5. **Editor workflow.** Author and round-trip takes in the LoongBones editor
   instead of TypeScript tables; accept a returned export only through
   `assertPerformanceEditorRoundTrip`.
6. **NBA Jam extras.** Announcer-style callout pops, an "on fire" streak
   effect on top of the existing heat check, bigger celebration hops.
7. **Art polish (owner approval needed).** Blink/mouth/expression swaps for
   cartoon takes, more hand drawings (fist, point), higher-resolution atlases.
