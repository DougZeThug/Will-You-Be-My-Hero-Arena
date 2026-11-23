# What to submit for a new character

Written for the art owner. Everything here comes from putting Doug and Dan through the
Character Lab's drawn-views tools. Nothing below paints, generates or redraws a face, a
print or a likeness: the tools only cut, key, scale, pose and (for surfaces you never drew)
fill with flat colour, and every such fill is labelled a stand-in on screen.

## How the character is drawn

One 3D skeleton moves the character. Each body block (trunk, head, each arm, each leg) is
drawn with the hand-drawn sheet that best matches the angle it currently faces, posed from
the skeleton's joints. So the number of angles that look *drawn* equals the number of
angles you supply. Between supplied angles the tools narrow or mirror the nearest drawing.

## What exists today, and what each missing view costs

| Angle | Doug / Dan today | What you see | Drawing that fixes it |
|---|---|---|---|
| Side, facing right | **Drawn** (`*_source.png`) | Good. Stride, arm swing, lean and knee bend read well. | - |
| Side, facing left | Mirror of the right profile, with the rear-garment sheet (`*-rear-source.png`) so the chest print is never mirrored | Reads as a profile. Watch, cap and hair parting are mirrored; Doug's open shirt looks closed. | A left profile sheet, or keep prints/asymmetric details on separate layers so they can be placed unmirrored. |
| Front: body | **Drawn** (`puppet-v3.png` parts) | Good standing and for sideways arm/leg motion. | - |
| Front: head | Stand-in: the only front-ish head is a three-quarter head | A character facing the camera always looks a little to one side, and the head flips when he passes dead-on. | A dead-on front head. |
| Three-quarter front | Stand-in: front parts narrowed by the projection; the head is the real 3/4 head | Body reads as a thin front view, not a turned body. The change-over to the profile at about 45 degrees is a visible swap (two different silhouettes dissolve). This is the weakest part of the turn. | A 3/4-front parts sheet. Highest value of all missing views. |
| Back | Stand-in: front parts mirrored, shirt above the waist and the whole head flat-filled | Plain shirt slab, flat hair/cap blob, knees and toes face the wrong way. Recognisable only by silhouette and colours. | A back parts sheet. |
| Three-quarter back | Stand-in: the back stand-in narrowed | Same as back, thinner. | A 3/4-back parts sheet. |
| Limb pointing at the camera | No drawing | Arms and legs shrink to 30% length and stop (a stub with a hand or foot on it). A squat seen from the front is short legs, not bent knees. | Foreshortened forearm+hand ("reaching at you") and a bent-knee front thigh, if those actions matter from the front. |
| Hands | Three right-profile hands (grip, open, relaxed), all seen from the thumb side | Used on both arms in every view, turned and mirrored from the palm direction. A palm facing the camera, the back of a fist, or fingers pointing at the camera have no drawing. | Per hand pose: palm side, back side, and one finger-on (toward camera). |
| Feet | Side shoe, front shoe | Back view shows the front shoe. Tiptoe/heel-strike only in profile. | Back shoe on the back sheet. |

## The submission, for excellent results at every angle

Five sheets per character, same character, same outfit, same lighting, same line weight.
Angles are how far the character is turned from facing right (0) toward the camera (90).

1. **Side (0)**: whole figure standing relaxed, facing right, feet slightly apart so both
   legs are visible, arms hanging so the near arm does not hide the torso outline. On the
   same sheet, separately: the near arm bare (no sleeve) from shoulder to wrist, and the
   hands (below).
2. **Three-quarter front (45)**, 3. **Front (90)**, 4. **Three-quarter back (-45)**,
   5. **Back (-90)**: each as a **parts sheet**, the layout `puppet-v3.png` already uses:
   - trunk with the lower garment, **no arms**, neck stub with skin drawn to the top;
   - head with a little neck under the chin;
   - each arm hanging straight down, sleeve attached, hand relaxed;
   - each leg straight, with its own piece of the lower garment drawn 15-20% higher than
     the hem (it tucks under the trunk), foot flat.
   Parts must not touch each other or the sheet edge.

Rules that matter (each one is a defect we hit when it was broken):

- **Flat chroma background** (pure magenta `#ff00ff`), no gradients, no shadows on it,
  no divider lines. At least 12 px of background around every part.
- **One contour style on every sheet**: the dark outline only. No white sticker border
  (the front sheets have one; the tools remove it, which costs 2-3 px of edge quality).
- **Same scale on a sheet**: all parts of one sheet drawn at the same size. (On the
  current front sheets the legs are about 15-25% larger than the trunk and the arms about
  30% smaller; the tools re-scale them, the arms lose sharpness.)
- **Resolution**: the standing figure about 1200 px tall on every sheet (what the side
  sheets have). Lab inspection is at about 600 px, the game at about 230 px.
- **Same proportions on every sheet**: head size, neck length, shoulder height, knee
  height. Doug's and Dan's front sheets have a shorter neck and higher knees than their
  side sheets; the tools stretch the front drawing 6-16% along the bones to match.
- **Neutral pose**: no twist, no lean, arms not crossing the body, fingers not over the
  garment.
- **Light from one side, the same side on all sheets**, soft; no cast shadows from one
  part onto another (they travel with the part when it moves).
- **Prints, watches, logos**: draw them where they are. If you want them correct on the
  mirrored (left-facing) side too, supply them as a separate layer.
- **Hands**, once per character, on the side sheet, fingers pointing right, wrist at the
  left with 20 px of forearm: grip, open, relaxed, each from the palm side and from the
  back; plus one open hand and one fist seen finger-on. (Today: three, thumb side only.)
- **Feet extras** (optional): a foot on tiptoe in profile if the shoe should bend.

Minimum useful submission (what Doug and Dan have): sheet 1, sheet 3 and the rear-garment
variant of sheet 1. Everything else is then a labelled stand-in.

## What the tools do (one command per view, same code for every character)

```
node prototype/motion/prep/build.mjs <id> --view side       # profile re-cut (+ head split off the trunk)
node prototype/motion/prep/build.mjs <id> --view sideRear   # same, from the rear-garment profile
node prototype/motion/prep/build.mjs <id> --view front      # front parts sheet -> layered skinned rig
node prototype/motion/prep/build.mjs <id> --view back       # STAND-IN built from the front parts
node prototype/motion/prep/build.mjs <id> --view all        # all four, then proportions.json + views.json
node prototype/character-lab/views/capture.mjs <id>         # contact sheets -> work/qa/character-lab/views/
```

Input: `prototype/character-lab/characters/<id>.json` (paths to the sheets and landmark
files). Output: `prototype/character-lab/rigs/<id>/<view>/{rig.json,atlas.png}`,
`rigs/<id>/proportions.json` (the skeleton's bone lengths, measured from your drawings)
and `rigs/<id>/views.json` (which views are drawn and which are stand-ins, with the
reason). Builds are deterministic; sources are only read, and their hashes are recorded.

Automatic: chroma keying; removing a sticker contour; splitting the figure into layers;
hidden surfaces behind joints (flat skin under the shorts, the far shorts leg, the cloth
under a sleeve); scaling the front parts to one figure (legs by matching the hem to the
trunk's leg opening, head by the side view's head height); placing shoulders, hips, hem
and crotch by reading the trunk's outline; skin weights for elbows, knees, wrists, ankles,
spine and the shorts following the thighs; atlas packing; measuring proportions.

## What still takes hand work

| Work | Per character | Notes |
|---|---|---|
| Side sheet landmarks | 37 clicks and 2 outlines in `prototype/motion/prep/mark.html`, about 15 minutes | Doug and Dan reuse their existing authoring JSON: zero new clicks. |
| Parts sheet rectangles and joints | 6 rectangles, elbow/wrist and knee/ankle as fractions of each limb's rectangle, about 15 minutes per parts sheet | Doug and Dan reuse `lib/arena/puppet-assets.json`: zero new numbers. No marking tool exists for this yet; today it is typed. |
| Corrections after looking at the result | Doug: none. Dan: one number (head seated 30 px lower, because his trunk piece ends in an empty collar instead of neck skin). Expect 0-3 numbers and about 30 minutes of looking per parts sheet. | Offered overrides: head position/scale, shoulder position, hem position, arm/leg scale. |
| Hand scale on the side sheet | 1 number (Doug 0.79, Dan 0.9, inherited) | Automatic estimate exists but is rough. |
| Visual review of the contact sheets | 30-60 minutes per character | This is the real acceptance step; numbers do not catch a bad joint. |

Not done by any tool, and not something more tuning will fix: drawing a view that does
not exist. A new 3/4 or back sheet goes through the same `--view` cut as the front sheet
(the cut itself is angle-agnostic), but choosing between more than front/side/back art
per block needs a small extension of the view-selection rule in `views/poser.ts`.
