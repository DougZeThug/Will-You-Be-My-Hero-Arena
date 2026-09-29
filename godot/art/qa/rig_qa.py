#!/usr/bin/env python3
"""Mask-based rig-QA gate: judges rendered poses of a character against the skeleton
contract. Engine-neutral: it reads PNGs and a manifest, nothing Godot-specific.

Per pose it needs (written by art/qa/render_battery.gd):
  <pose>_beauty.png   the character on a key-colour background
  <pose>_id.png       the same pose, every part a unique flat colour
  manifest.json       joints, sockets, planted feet, part colours, setup lengths

Metrics (thresholds in thresholds.json, registered before any result exists):
  components   the silhouette is ONE connected piece (no detached hand, no floating limb)
  under        the expected core (union of per-bone capsules, min radii) must be covered:
               catches see-through gaps at joints, tears, and thin-strip limbs
  over         no silhouette outside the max radii: catches stray or detached geometry
  holes        no enclosed see-through region inside the expected core (pockets between
               the legs or under an arm are anatomy and are only reported, not failed)
  adjacency    declared part pairs touch at their shared joint (hand meets forearm...); pairs whose
               joint is hidden by another part in this view are skipped and counted as occluded
  grounding    the lowest pixel of every planted foot sits on the ground line
  socket       a held object's socket stays on the evaluated palm (poses that hold one)
  limb_length  rigid segment lengths equal their setup lengths (squash is root-only)
  battery      every pose was reachable by the leg IK (an invalid pose invalidates a run)

Exit code 0 only if every metric passes on every pose.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB")).astype(np.int32)


def capsule(shape, a, b, r, inset_a=0.0, inset_b=0.0) -> np.ndarray:
    """Boolean mask of a capsule (segment a-b, radius r). inset_* shorten the segment at
    that end so the rounded cap stays inside the original span."""
    h, w = shape
    a = np.array(a, float)
    b = np.array(b, float)
    d = b - a
    length = float(np.linalg.norm(d))
    u = d / length if length > 1e-9 else np.array([1.0, 0.0])
    a2 = a + u * min(inset_a, length / 2)
    b2 = b - u * min(inset_b, length / 2)
    x0 = int(max(0, math.floor(min(a2[0], b2[0]) - r - 2)))
    x1 = int(min(w, math.ceil(max(a2[0], b2[0]) + r + 2)))
    y0 = int(max(0, math.floor(min(a2[1], b2[1]) - r - 2)))
    y1 = int(min(h, math.ceil(max(a2[1], b2[1]) + r + 2)))
    out = np.zeros(shape, bool)
    if x1 <= x0 or y1 <= y0:
        return out
    ys, xs = np.mgrid[y0:y1, x0:x1]
    px = xs + 0.5
    py = ys + 0.5
    ab = b2 - a2
    denom = max(float(ab @ ab), 1e-9)
    t = np.clip(((px - a2[0]) * ab[0] + (py - a2[1]) * ab[1]) / denom, 0.0, 1.0)
    cx = a2[0] + t * ab[0]
    cy = a2[1] + t * ab[1]
    out[y0:y1, x0:x1] = ((px - cx) ** 2 + (py - cy) ** 2) <= r * r
    return out


def largest_blob(mask: np.ndarray, structure=None) -> int:
    lab, n = ndi.label(mask, structure=structure)
    if n == 0:
        return 0
    return int(np.bincount(lab.ravel())[1:].max())


def part_mask(idimg: np.ndarray, rgb) -> np.ndarray:
    return np.all(np.abs(idimg - np.array(rgb, np.int32)) <= 2, axis=2)


def check_pose(pose, manifest, contract, th, folder: Path) -> dict:
    beauty = load_rgb(folder / f"{pose['name']}_beauty.png")
    idimg = load_rgb(folder / f"{pose['name']}_id.png")
    shape = beauty.shape[:2]
    key = np.array(th["mask"]["key_rgb"], np.int32)
    mask = np.sqrt(((beauty - key) ** 2).sum(axis=2)) > th["mask"]["key_tolerance"]
    joints = pose["joints"]
    scale = float(manifest.get("root_scale", 1.0)) or 1.0
    res = {}
    fails = []

    # components
    lab, n = ndi.label(mask, structure=np.ones((3, 3), int))
    sizes = np.bincount(lab.ravel())[1:] if n else np.array([], int)
    comps = int((sizes >= th["components"]["min_area_px"]).sum())
    res["components"] = comps
    if comps > th["components"]["max"]:
        fails.append(f"components={comps} (max {th['components']['max']})")

    # under / over coverage against the skeleton-derived expected occupancy
    core = np.zeros(shape, bool)
    allowed = np.zeros(shape, bool)
    margin = th["coverage"]["over_margin_px"]
    for bone in contract["bones"]:
        a, b = joints[bone["a"]], joints[bone["b"]]
        core |= capsule(shape, a, b, bone["min_r"] * scale, bone.get("inset_a", 0) * scale, bone.get("inset_b", 0) * scale)
        allowed |= capsule(shape, a, b, bone["max_r"] * scale + margin)
    uncovered = core & ~mask
    under_ratio = float(uncovered.sum()) / max(1, int(core.sum()))
    under_blob = largest_blob(uncovered, np.ones((3, 3), int))
    res["under_ratio"] = round(under_ratio, 5)
    res["under_blob_px"] = under_blob
    if under_ratio > th["coverage"]["under_ratio_max"]:
        fails.append(f"under_ratio={under_ratio:.4f} (max {th['coverage']['under_ratio_max']})")
    if under_blob > th["coverage"]["under_blob_max_px"]:
        fails.append(f"under_blob={under_blob}px (max {th['coverage']['under_blob_max_px']})")
    stray = mask & ~allowed
    over_blob = largest_blob(stray, np.ones((3, 3), int))
    res["over_blob_px"] = over_blob
    if over_blob > th["coverage"]["over_blob_max_px"]:
        fails.append(f"over_blob={over_blob}px (max {th['coverage']['over_blob_max_px']})")

    # enclosed see-through regions: a defect only where they overlap the expected core
    bg_lab, bn = ndi.label(~mask)
    border = set(np.unique(np.concatenate([bg_lab[0], bg_lab[-1], bg_lab[:, 0], bg_lab[:, -1]])).tolist())
    counts = np.bincount(bg_lab.ravel()) if bn else np.array([0])
    pockets = 0
    holes = 0
    for i in range(1, bn + 1):
        if i in border or counts[i] < th["holes"]["min_area_px"]:
            continue
        pockets += 1
        if (core & (bg_lab == i)).any():
            holes += 1
    res["pockets"] = pockets
    res["holes"] = holes
    if holes:
        fails.append(f"holes={holes} enclosed see-through region(s) inside the body core")

    # part adjacency
    k = th["adjacency"]["k"]
    occluded = 0
    groups = manifest.get("part_groups", {})
    masks = {}
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    for pa, pb, joint in contract["contact_pairs"]:
        for p in (pa, pb):
            if p not in masks:
                m = np.zeros(shape, bool)
                for member in groups.get(p, [p]):
                    m |= part_mask(idimg, manifest["parts"][member])
                masks[p] = m
        if masks[pa].sum() < th["adjacency"]["min_visible_px"] or masks[pb].sum() < th["adjacency"]["min_visible_px"]:
            occluded += 1  # a part that is (almost) hidden in this view cannot be judged from it
            continue
        jx, jy = joints[joint]
        disc = (xx + 0.5 - jx) ** 2 + (yy + 0.5 - jy) ** 2 <= th["adjacency"]["joint_probe_r_px"] ** 2
        if (disc & (masks[pa] | masks[pb])).sum() < 0.5 * disc.sum():
            occluded += 1  # something in front of the joint hides it in this view
            continue
        near = ndi.binary_dilation(masks[pb], iterations=k)
        touching = int((masks[pa] & near).sum())
        if touching < th["adjacency"]["min_px"]:
            fails.append(f"adjacency {pa}|{pb}={touching}px (min {th['adjacency']['min_px']})")
    res["adjacency_ok"] = not any(f.startswith("adjacency") for f in fails)
    res["adjacency_pairs_occluded"] = occluded

    # grounding
    ground = float(manifest["ground_y"])
    worst = 0.0
    for foot in pose["planted"]:
        fm = part_mask(idimg, manifest["parts"][contract["feet"][foot]])
        rows = np.where(fm.any(axis=1))[0]
        if len(rows) == 0:
            fails.append(f"grounding {foot}: part not visible")
            continue
        gap = abs(float(rows.max() + 1) - ground)
        worst = max(worst, gap)
        if gap > th["grounding"]["tol_px"]:
            fails.append(f"grounding {foot}: sole {gap:.1f}px off the ground (tol {th['grounding']['tol_px']})")
    res["grounding_worst_px"] = round(worst, 2)

    # held-object socket on the evaluated palm
    if pose.get("held_socket") is not None:
        dist = math.dist(pose["held_socket"], pose["palm"])
        res["socket_px"] = round(dist, 3)
        if dist > th["socket"]["tol_px"]:
            fails.append(f"socket {dist:.2f}px off the palm (tol {th['socket']['tol_px']})")

    # rigid segment lengths
    worst_len = 0.0
    for a, b in contract["rigid_limbs"]:
        cur = math.dist(joints[a], joints[b]) / scale
        setup = manifest["setup_lengths"][f"{a}>{b}"]
        worst_len = max(worst_len, abs(cur - setup))
        if abs(cur - setup) > th["limb_length"]["tol_px"]:
            fails.append(f"limb_length {a}>{b}: {cur:.2f} vs setup {setup:.2f}")
    res["limb_length_worst_px"] = round(worst_len, 3)

    res["fails"] = fails
    return res


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--contract", required=True)
    ap.add_argument("--thresholds", required=True)
    a = ap.parse_args()
    folder = Path(a.folder)
    manifest = json.loads((folder / "manifest.json").read_text())
    contract = json.loads(Path(a.contract).read_text())
    th = json.loads(Path(a.thresholds).read_text())

    report = {"inject": manifest.get("inject", ""), "poses": {}, "battery": {}}
    total_fails = 0
    if manifest.get("unreachable"):
        report["battery"]["unreachable"] = manifest["unreachable"]
        print(f"BATTERY INVALID: unreachable leg IK targets {manifest['unreachable']}")
        total_fails += len(manifest["unreachable"])

    print(f"{'pose':<22}{'comp':>5}{'under%':>8}{'ublob':>7}{'oblob':>7}{'holes':>6}{'ground':>8}{'limb':>7}  result")
    for pose in manifest["poses"]:
        r = check_pose(pose, manifest, contract, th, folder)
        report["poses"][pose["name"]] = r
        total_fails += len(r["fails"])
        print(f"{pose['name']:<22}{r['components']:>5}{r['under_ratio'] * 100:>8.2f}{r['under_blob_px']:>7}{r['over_blob_px']:>7}"
              f"{r['holes']:>6}{r['grounding_worst_px']:>8.2f}{r['limb_length_worst_px']:>7.2f}  "
              f"{'PASS' if not r['fails'] else 'FAIL'}")
        for f in r["fails"]:
            print(f"    - {f}")
    report["total_failures"] = total_fails
    (folder / "report.json").write_text(json.dumps(report, indent=1))
    print(f"GATE {'PASS' if total_fails == 0 else 'FAIL'} ({total_fails} failures, inject={manifest.get('inject') or 'none'})")
    return 0 if total_fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
