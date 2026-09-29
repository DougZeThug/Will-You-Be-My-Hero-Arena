#!/usr/bin/env python3
"""Silhouette metrics for the anim_compare battery capture (work/qa/godot/<name>/).

For each of the 18 poses and each variant column: connected components of the non-key mask
(more than 1 means a tear) and enclosed key-coloured regions (see-through holes). Counts,
not verdicts: a legitimate gap between an arm and the torso also counts as a hole, so
compare variants against each other on the same pose.

  anim_compare_metrics.py <capture_dir> <out.json>
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

capture, out = sys.argv[1], sys.argv[2]
POSES = ['rest_setup', 'idle_relaxed', 'crouch_deep', 'stance_ready', 'windup_peak', 'plant_weight_shift', 'release',
         'follow_through', 'recovery', 'arms_overhead', 'arms_forward_reach', 'chest_tap', 'torso_twist_forward',
         'torso_lean_back', 'walk_contact', 'walk_passing', 'step_lunge', 'celebrate_jump']
VARIANTS = ['A_skinned', 'B_svs', 'C_hybrid']
MIN_AREA = 30
result = {}
for i, pose in enumerate(POSES):
    im = np.array(Image.open('%s/frame%08d.png' % (capture, 30 * i + 15)).convert('RGB')).astype(int)
    h, w, _ = im.shape
    zoom = w / 2300.0
    key_dist = np.abs(im - np.array([255, 0, 255])).sum(axis=2)
    mask = key_dist > 90
    mask[:60, :400] = False          # HUD label
    result[pose] = {n: {"components": 0, "holes": 0, "area_px": 0} for n in VARIANTS}
    centres = [w * 0.5 + (v - 1) * 760 * zoom for v in range(3)]

    def column_of(x):
        return int(np.argmin([abs(x - c) for c in centres]))

    # Label the whole frame so a hand reaching toward a neighbour is not split by a window edge.
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    for k in range(1, n + 1):
        ys, xs = np.nonzero(lab == k)
        if len(xs) >= MIN_AREA:
            col = VARIANTS[column_of(xs.mean())]
            result[pose][col]["components"] += 1
            result[pose][col]["area_px"] += int(len(xs))
    holes_lab, hn = ndimage.label(~mask)
    border = set(np.unique(np.concatenate([holes_lab[0], holes_lab[-1], holes_lab[:, 0], holes_lab[:, -1]])))
    for k in range(1, hn + 1):
        if k in border:
            continue
        ys, xs = np.nonzero(holes_lab == k)
        if len(xs) >= MIN_AREA:
            result[pose][VARIANTS[column_of(xs.mean())]]["holes"] += 1
json.dump(result, open(out, 'w'), indent=1)
tot = {n: {"tears": 0, "holes": 0} for n in VARIANTS}
for pose in POSES:
    for n in VARIANTS:
        r = result[pose][n]
        tot[n]["tears"] += max(0, r["components"] - 1)
        tot[n]["holes"] += r["holes"]
print(json.dumps(tot))
