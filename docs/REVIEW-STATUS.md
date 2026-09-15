# Current playable framework — September 11

The current implementation is the Phaser multi-event Play framework described in [PLAYABLE-ENGINE.md](PLAYABLE-ENGINE.md). Watch preserves the existing recorded events, results and ledger. Earlier GSAP and repair notes below are historical.

Final verification: TypeScript, production build, and 161,331 automated checks passed, including 2,000 historical/seeded contests and three complete interactive AI sessions. Browser checks exercised Play setup, charge/release, running controls, combat controls, pause/resume and return to Watch. The original 3 club points / 3 remaining entries were preserved. The final production game loaded with no browser error logs.

Three fresh 10-second Phaser sequences were exported and decoded: 900 rendered frames at 30 fps. Contact sheets were inspected for hand release, connected shoulders, jump grounding, obstacle traversal, hit/recovery poses and camera coverage. Equipment masking and camera edge exposure found during review were corrected. The videos and image sheets live in the adjacent `animation-review` output folder as `playable-cornhole`, `playable-running` and `playable-fighting`.

Limits: simple running course and initial combat balancing; only these three events are directly playable. Other sports remain in Watch. Physical gamepads were not available for hardware verification. The native connected mesh is active; Spine exports/runtime are not installed. Placeholder synthesized audio is optional.

---

# Current natural posture update

See [reference posture correction](NATURAL-POSTURE.md). The local build and card-to-character workflow now use the relaxed body proportions. Earlier repair notes follow as history.

# Current repair review

The September 11 joined-shoulder repair supersedes the earlier passes below. See [current review](CONNECTED-ANIMATION-REVIEW.md) and [animation architecture](ARTICULATED-ANIMATION.md). The local production build is updated; final review movies are in the adjacent animation-review folder.

# Paper-cutout review build status

## Current build: articulated paper animation

GSAP now drives twelve-part Dan and Doug characters, with independently moving heads, arms, hands, legs and feet. The 32 authored idle/entrance/reaction clips and eight wind-ups produce different limb sequences. Portable nine-image packs can supply custom joint tracks beyond the starter catalog. Original cards, six compatibility poses, court art and equipment remain intact. See [Articulated animation](ARTICULATED-ANIMATION.md).

The production build and TypeScript pass. The current automated report contains 39,834 checks across 2,000 seeded contests. Articulated checks cover backward seeking, joint continuity, exact release palms in every sport, custom tracks and malformed imports. Eleven packer checks cover legacy exact compatibility, nine-image round trips and immutable choreography revisions.

Desktop browser review compared Dan’s compact arm pump with Doug’s chest-tap/open-arm celebration, checked actual separate-limb movement and watched an unattended 3–5 cornhole finish with equal attempt budgets, no exhibition awards and no runtime errors. Review then corrected the hip overlaps and pelvis height above planted ankles. The extra custom-pack browser upload stalled in the file chooser and returned a file-read error; that end-to-end browser import check is not claimed as passed. Automated pack and image/geometry validation passed. No physical-device performance claim is made.

The sections below record earlier iterations; their six-frame-only limitations and older check counts describe those prior builds.

## Delivered redesign

Dan and Doug now use six authored full-body transparent paper poses each, based on the supplied illustrated cards. The scene, boards, event props, typography, controls, collection and result panels use the new printed backyard-sports direction. The original cards remain intact. The revised renderer replaces the earlier articulated cartoon rigs.

All four events retain deterministic precomputed paths and contact scoring. New recordings include their prepared character manifest snapshot, matching held palm sockets to recorded release coordinates. Playback controls do not resimulate or award points again. The local atomic repository, ownership checks, shared ranks, historical policy and append-only corrections remain implemented.

## Equipment refinement

The boards, hoops, target stands and pong tables now use authored cutout illustrations with the same ink, paper contour and worn paint as the characters. Bags, footballs, basketballs and ping-pong balls have dedicated illustrated sprites at roughly twice their previous display size. Board apertures, rim centers, target rings and tabletop cup positions are registered to the artwork. The original recorded paths and scores remain unchanged; the renderer maps their presentation from the authored palm to the illustrated contact point. Hoop front rims and nets overlay the ball at contact, and cups are ordered from back to front.

The cornhole view now uses a board drawn along the left-to-right throwing direction. The back board is 25% smaller than the front board, with separate registered hole anchors. Bags keep their held size, taper to the rear-board perspective during flight, and lie flat when they reach the tabletop. The new board image is displayed through a contour mask measured from its cream paper edge; the original generated RGB image remains unchanged.

## Verified in this redesign pass

- TypeScript and the production static build pass.
- 27,920 assertions across 2,000 seeded contests pass, covering equal legal budgets, path/contact scoring, ownership, journal recovery, idempotent awards, exhibitions, historical policy, correction references, asset existence, release/socket alignment and immutable manifest snapshots. The equipment pass adds artwork/contact registration, scoring-ring boundaries, finite presentation coordinates and full equipment silhouettes within the court.
- All four equipment sets were inspected in the running browser. Cornhole also completed unattended at 3–5 with the new bags and board apertures. Final refinements separate the board silhouettes, spread the target labels and order the cups by depth. An independent visual review found no further important equipment defects. Basketball playback was observed with the final hoop art.
- Cornhole ran unattended from Start to a 3–5 finish with four bags each and a final Doug hole. Replay resolved to the same result. A motion preview contains actual browser screenshots of gameplay.
- Football, beer pong and basketball were visually checked with the new figures and props. Their playback and Skip to result controls showed respectively 3–6 (five attempts each), 2–2 (six each), and 1–1 (five each), with zero exhibition points. These three checks used the viewing skip control; they were not recorded as complete unattended visual playthroughs in this pass.
- Responsive checks used the in-app Chromium browser on Windows, including 360×800 and 390×844 portrait, 844×390 landscape, 1024×768 tablet and the normal desktop view. Phone header overflow and an obscuring lobby sign were fixed. The short landscape camera now contains the entire court within a dark matte rather than cropping the figures/boards. These are desktop viewport emulations, not physical phone tests.
- A fresh visual review and an independent follow-up review checked the running scene against the supplied cards. Likeness, paper contours and visual cohesion passed the follow-up review. No browser console errors were returned during the final inspection.

## Repeatable character workflow

The saved `arena-card-to-character` Codex skill now owns the repeatable generation brief, approved style references, registration recipe and tested packer. The Arena accepts complete `.arena-character.json` packs through The collection → Install character. It checks images and geometry, stores large pixel assets in IndexedDB, registers a new catalog entry and demo ownership, and resolves stable asset paths during playback. Original built-in characters and previously installed IDs cannot be overwritten.

Automated checks cover malformed packs, embedded image references, duplicate registration, manifest copying and owned-card recording across all four sports with an installed test character. An independent forward-test verified the packer’s eight embedded hashes, exact preservation of the original card and six pose PNGs, aligned atlas and useful malformed-input errors. No new person was generated for these technical tests; they use existing approved Dan art with a clearly labelled temporary identity.

Browser verification on an isolated local origin covered the finished-pack upload, six-pose review, installation into collection and match selection, basketball pose preview with a held ball, an unattended 3–6 cornhole match, reload retention and replay at the same 3–6 result. Incorrect-file handling and the installer at 390×844 were also checked. No console errors were returned. The temporary test identity was not installed into the user’s main collection.

## Animation and integration scope

Dan and Doug remain the two built-in characters. Additional reviewed human packs are supported through installation; the previously described pet/Secret roster has not been authored. The animation is a limited sequence of six drawings connected by short fades and small whole-paper motion. Dense hand-drawn in-between frames, actual walk cycles, facial reaction variants and a unique Secret competitor remain future work. Football uses its own cocked pose and a shared extended-arm release. Heat check is a cosmetic stage effect.

The local browser demo has no shared authentication or authoritative backend. Generation happens in Codex, using the uploaded card as identity reference; new poses are generated rather than recovered from unseen drawings. The installer accepts the resulting complete pack. New anatomy still requires authored assets and action support. Installed pack image paths are versioned; built-in or manually hosted assets also need versioned URLs in production. See `ADDING-CHARACTERS.md`.

Settings exposes measured frame intervals, draw calls and asset load time; texture memory is estimated from loaded image dimensions. No physical-device 60 fps guarantee is claimed. Audio remains a synthesized effects mix, and event contacts use documented arcade simplifications.

Each newly generated character should receive a likeness, silhouette and motion check as part of the Codex workflow before its finished pack is delivered.

## Animation timing polish

The current artwork, cards, equipment assets and stylesheet are unchanged from the horizontal-board build (33 archived art/style files compared byte for byte). The existing PixiJS renderer now samples an explicit shared timeline, with a 1.65-second entrance and 2.16–2.76-second attempts. Registered pose blending connects the held prop directly to release; the airborne path stays a single parabola; the scoreboard, attempt count and result sound wait 0.16 seconds after landing. A resting board bag is drawn once and its orientation matches the end of the slide. Players return to idle before the next turn. No new dependency, art, or skeletal animation was added.

TypeScript and production build pass. The expanded suite has 27,920 assertions, including animation state boundaries, hand registration for custom geometry, pause/speed/seek, a legacy recording, and identical outcome statistics across all 2,000 seeded contests. See `ANIMATION-TIMELINE.md` for timing and historical replay behavior.

Browser verification of the polished sequence used the isolated local preview: cornhole finished unattended at 3–5, football at 6–6, beer pong at 4–4, and basketball at 2–1, with equal completed budgets and no exhibition awards. Cornhole entrance, release, flight and score frames were captured for inspection; basketball shot frames were also checked. Pause produced identical consecutive screenshots; half/double speed and Skip to result preserved the replay result. The final browser error log was empty. These are desktop Chromium checks, not physical-device performance measurements.

## Character personality expansion

The current renderer gives Dan a focused, measured profile and Doug a showier, quicker profile. Cards slam into their existing anchor positions, charge with a warm or teal pulse, reveal a clipped figure through the card opening, and retain their source-card presence after each character lands. The setup dialog exits before the clock starts. Entrances take 2.65 seconds; each profile keeps full attempts within 2–3 seconds. Waiting idles use 16% amplitude. No character drawings, equipment or backgrounds were replaced.

The personality suite passes 29,670 checks across the existing 2,000 seeded contests, including distinct motion profiles, constrained custom settings, exact release-hand continuity, portal state, reduced motion, unchanged scores and immutable profile snapshots. The packer passed eight additional checks, including unchanged legacy output and pixel hashes, profile round-tripping, distinct immutable revisions when personality changes, and malformed-profile rejection. The generated test pack also passed the Arena importer contract. The saved Codex card-to-character skill was updated after validation.

## Expanded roster motion and grounding

The runtime now has 24 starter profiles and five independently selectable categories, with eight motions each. The Collection exposes preview-only mix controls. A fixed-seed 96-character test confirms distinct sampled motion from the actual choreography, and every selectable move has a distinct trace. The saved card workflow now authors named mixes, checks available recipes for repeated choreography, and packages immutable settings. Its shared catalog, authoring reference and tested packer are installed. Legacy omitted-profile and four-style recipes preserve their exact output. The packer passed 17 checks, and its mixed-profile result passed the Arena importer contract.

The 31,777-check suite and TypeScript pass, as does the production build. Mixed throw/celebration combinations retain 2–3-second turns and exact release-hand registration across all four sports. Tests also cover nested profile snapshots, invalid styles, actual sole contacts, matching card offsets and the shared court plane for every equipment set. Existing source artwork and the stylesheet remain unchanged. Warm tint and contact shadows are renderer treatments; card placement and equipment positioning reflect the user’s subsequent grounding request.

Browser checks on the isolated preview covered all four court layouts, the 24-style selector, individual movement overrides, automatic clip selection and return to the saved profile. Basketball completed without skipping at 3–3, with five shots each and zero exhibition awards. Earlier in this pass cornhole completed at 3–5 before the final grounding changes. Cornhole was rechecked visually with its final horizontal board placement. The browser error log was empty. The final equipment anchors exclude the eight-pixel transparent margin beneath the hoop, target and table assets. These are desktop browser observations, not physical-device performance measurements.
