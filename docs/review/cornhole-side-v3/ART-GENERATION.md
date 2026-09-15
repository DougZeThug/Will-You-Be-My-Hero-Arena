# Side-facing cornhole puppet art
Generated with the built-in image_gen tool. Site checkout and source art were not changed.

## Selected sheets
- dan-side-sheet-chroma.png
- doug-side-sheet-chroma.png

Both are 1254 × 1254, 24-bit RGB PNGs. They do NOT contain a transparent alpha channel. Two Dan transparency requests yielded RGB checkerboard images. Parent explicitly authorized a magenta-key fallback for the existing renderer; those selected sheets use magenta backgrounds with slight RGB variation. Use a magenta-distance/chroma threshold, not exact equality. No pixels were manually edited; scripts only inspect dimensions and bounds.

## Content
Near-profile, screen-right head/chest/hips/feet, narrow stagger with far left support foot ahead. Full body has its near right throwing arm absent under the retained near sleeve, with completed clothing beneath. Far left arm remains attached. Each sheet also has a continuous bare arm with rounded shoulder cap to wrist, and three right hands: cupped palm-up, palm-up opening release, relaxed recovery. Hands have wrist at left, fingers right. Anatomical scale is approximate: parent should fit arm cap under sleeve and normalize hands to wrist/forearm size.

Dan: tousled brown hair, moustache and stubble, white Pepperoni Cheesers shirt, black shorts, black flip-flops.
Doug: backward blue/red cap, white sunglasses, ginger beard, patterned open overshirt, white Pepperoni Cheesers shirt, charcoal shorts, black socks, gray shoes, black watch on attached far wrist.

## Exact measured non-chroma bounds
Numbers are x, y, width, height with top-left origin. Add 3–8 px transparent/key padding for antialiasing around crops. Scan used R>140, B>140, R-G>70 and B-G>70 as background predicate. Full details in sheet-inspection.json.

| Component | Dan | Doug |
|---|---|---|
| Body | 312,12,435,1223 | 325,19,426,1202 |
| Arm | 862,212,153,391 | 872,171,156,438 |
| Grip | 900,701,182,80 | 889,686,211,98 |
| Release | 898,829,203,93 | 886,820,232,109 |
| Recovery | 902,974,146,110 | 889,975,166,126 |

## Prompts and iteration records
- dan-prompt.txt — initial body + arm + three hands request, true transparency requested.
- dan-correction-prompt.txt — narrow near-profile correction and second alpha request.
- dan-chroma-prompt.txt — authorized magenta fallback and detached sleeve removal.
- doug-prompt.txt — Doug identity, same composition, magenta fallback.
- doug-correction-prompt.txt — torso/head orientation correction to match Dan.
- dan-side-sheet-v1.png and dan-side-sheet-v2.png are rejected RGB checkerboard stages.
- doug-side-sheet-chroma-v1.png is the superseded less side-facing Doug stage.

## Practical limits
Generation returned 1254-square despite higher-resolution request. No alpha was produced. Hands and arm need normal rig registration and scale adjustment. Identity and clothing are visually consistent with the references, but the shirt lettering naturally becomes partly occluded in profile. Both full figures remain entirely within the sheet, with no cut-off feet or head.

