#!/usr/bin/env python3
"""Generate the shared Doug prototype art (godot/assets/doug/) from scripted geometry.

Every part is one closed Catmull-Rom spline through anchor points, defined in the rig's
setup pose (Godot pixels, y down, root origin on the ground between the feet, character
faces +x, standing height 720). The same anchors feed all three prototype variants:

  * source/<part>.svg      vector master (what Scalable Vector Shapes 2D would import)
  * parts/<part>.png       supersampled raster, 8-bit alpha, colour bled into transparent texels
  * shapes.json            anchors + Bezier handles + flattened outline + weighting recipe

This is scripted geometry authored in-repo. It is NOT AI-generated imagery and NOT a
verified likeness; the legacy Doug art was used only as a colour/costume reference.
Run:  python3 godot/tools/gen_doug_art.py
"""
import hashlib
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "assets", "doug"))
SS = 4          # supersample factor for rasterisation
PAD = 6         # transparent margin around each part PNG

INK = (42, 31, 36)
SKIN = (238, 189, 148)
TEE = (246, 236, 214)
OVERSHIRT = (250, 250, 246)
SHORTS = (86, 88, 96)
SOCK = (34, 34, 38)
SHOE = (240, 240, 236)
BEARD = (196, 98, 44)
CAP = (52, 132, 214)
BRIM = (196, 44, 58)
LENS = (60, 130, 220)
PIZZA = (244, 168, 40)
BAG = (200, 60, 52)

parts = []

# The rig hangs the clavicles off the TIP of spine_upper, so the shoulder joint is at y=-576 (checked
# against the built skeleton), 90 px above where the arms were first drawn. All arm art is authored
# at the old height and shifted here.
ARM_DY = -90.0


def dy(pts, d=ARM_DY):
    return [(x, y + d) for x, y in pts]


def shade(c, k):
    return tuple(int(round(v * k)) for v in c)


def add(name, anchors, fill, z, bone=None, chain=None, blend=0.0, outline=INK, outline_w=3.0, tension=1.0, far=False, group=None):
    """bone -> rigid to one bone; chain -> skinned along that bone chain with a blend band (px)."""
    k = 0.82 if far else 1.0
    parts.append({
        "name": name, "anchors": [[float(x), float(y)] for x, y in anchors],
        "fill": list(shade(fill, k)), "outline": list(shade(outline, 1.0)), "outline_w": outline_w,
        "z": z, "bone": bone, "chain": chain or [], "blend": blend, "tension": tension,
        "group": group or name,
    })


def limb(cx, stations, cap_top=8.0, cap_bot=8.0):
    """stations: [(y, half_front, half_back)] top to bottom -> closed anchor loop."""
    a = [(cx, stations[0][0] - cap_top)]
    for y, hf, _ in stations:
        a.append((cx + hf, y))
    a.append((cx, stations[-1][0] + cap_bot))
    for y, _, hb in reversed(stations):
        a.append((cx - hb, y))
    return a


def build_parts():
    for side, cx, far in (("far", -6.0, True), ("near", 6.0, False)):
        zb = 10 if far else 50
        zl = 20 if far else 40
        # legs: skin from hip to ankle (continuous), shorts leg, sock, shoe
        add(f"leg_{side}", limb(cx, [(-408, 30, 30), (-330, 27, 28), (-290, 25, 26), (-250, 22, 24),
                                     (-215, 20, 22), (-180, 20, 21), (-110, 18, 18), (-60, 15, 15), (-34, 14, 14)], 6, 8),
            SKIN, zl, chain=[f"thigh_{side}", f"shin_{side}"], blend=44, far=far)
        add(f"sock_{side}", limb(cx, [(-104, 20, 20), (-70, 17, 17), (-40, 15, 15)], 4, 4),
            SOCK, zl + 1, chain=[f"shin_{side}"], far=far)
        add(f"shoe_{side}", [(cx - 26, -50), (cx + 16, -54), (cx + 26, -34), (cx + 62, -22), (cx + 80, -12),
                              (cx + 80, 0), (cx - 24, 0), (cx - 30, -22)],
            SHOE, zl + 2, bone=f"foot_{side}", far=far)
        add(f"shorts_{side}", [(cx - 46, -440), (cx + 8, -446), (cx + 52, -438), (cx + 58, -362), (cx + 46, -298),
                                (cx - 2, -294), (cx - 36, -298), (cx - 50, -366)],
            SHORTS, zl + 3, chain=["pelvis", f"thigh_{side}"], blend=50, far=far)
        # arms: sleeve, continuous skin arm (shoulder -> wrist), hand (rigid drawings)
        add(f"arm_{side}", dy(limb(cx, [(-490, 21, 21), (-440, 20, 20), (-390, 19, 19), (-350, 18, 18), (-320, 17, 17),
                                     (-290, 16, 16), (-250, 14, 14), (-214, 13, 13), (-198, 12, 12)], 16, 8)),
            # ^ the skin arm runs 16 px past the wrist into the hand drawing (hidden under it) so a rotated
            #   wrist never opens a gap; the hand drawings are drawn above the arm
            SKIN, zb, chain=[f"upper_arm_{side}", f"forearm_{side}"], blend=44, far=far)
        add(f"sleeve_{side}", dy([(cx - 26, -498), (cx + 2, -514), (cx + 30, -500), (cx + 34, -452), (cx + 32, -404),
                                (cx, -398), (cx - 30, -404), (cx - 32, -452)]),
            OVERSHIRT, zb + 1, chain=[f"clavicle_{side}", f"upper_arm_{side}"], blend=20, far=far)
        add(f"sleeve_cuff_{side}", dy([(cx - 32, -414), (cx + 32, -414), (cx + 33, -400), (cx, -396), (cx - 33, -400)]),
            (214, 214, 208), zb + 2, bone=f"upper_arm_{side}", far=far, outline_w=2.0)
        # hand drawings, registered so the wrist joint sits at (cx, -206); bone is hand_<side>
        add(f"hand_relaxed_{side}", dy([(cx - 12, -214), (cx + 12, -214), (cx + 18, -196), (cx + 20, -176), (cx + 12, -160),
                                      (cx - 2, -156), (cx - 12, -166), (cx - 16, -190)]),
            SKIN, zb + 3, bone=f"hand_{side}", far=far, group="hand_relaxed")
        add(f"hand_grip_{side}", dy([(cx - 12, -214), (cx + 12, -214), (cx + 24, -198), (cx + 28, -180), (cx + 18, -160),
                                   (cx + 2, -158), (cx - 10, -168), (cx - 16, -190)]),
            SKIN, zb + 3, bone=f"hand_{side}", far=far, group="hand_grip")
        add(f"hand_open_{side}", dy([(cx - 12, -214), (cx + 12, -214), (cx + 16, -190), (cx + 24, -168), (cx + 18, -146),
                                   (cx + 6, -140), (cx - 4, -150), (cx - 10, -172), (cx - 16, -194)]),
            SKIN, zb + 3, bone=f"hand_{side}", far=far, group="hand_open")

    # trunk, neck, head. Trunk chain runs pelvis -> spine_lower -> spine_upper -> neck.
    add("torso_tee", [(-50, -590), (0, -602), (48, -588), (58, -542), (54, -482), (50, -430), (0, -424), (-48, -428),
                      (-56, -474), (-54, -542)],
        TEE, 30, chain=["pelvis", "spine_lower", "spine_upper"], blend=44)
    add("overshirt_front", [(30, -594), (62, -574), (66, -520), (60, -450), (54, -402), (34, -400), (40, -470), (34, -540)],
        OVERSHIRT, 32, chain=["pelvis", "spine_lower", "spine_upper"], blend=44, outline_w=2.5)
    add("logo", [(-6, -540), (16, -556), (34, -542), (30, -516), (8, -502), (-10, -518)],
        PIZZA, 33, bone="spine_upper", outline_w=2.5)
    add("neck", [(-14, -620), (18, -620), (24, -590), (-20, -590)], SKIN, 29, bone="neck")
    add("head", [(-36, -692), (-22, -716), (10, -722), (36, -704), (44, -676), (56, -664), (44, -650), (42, -630),
                 (22, -614), (-12, -610), (-34, -628), (-42, -662)], SKIN, 35, bone="head")
    add("beard", [(-20, -650), (2, -656), (30, -654), (46, -648), (44, -628), (24, -608), (-8, -606), (-26, -626)],
        BEARD, 36, bone="head", outline_w=2.5)
    add("sunglasses", [(18, -684), (52, -684), (54, -666), (46, -660), (24, -660), (16, -668)],
        LENS, 37, bone="head", outline=(255, 255, 255), outline_w=4.0)
    add("cap_crown", [(-46, -690), (-38, -716), (-8, -734), (26, -728), (42, -706), (46, -690), (-4, -698)],
        CAP, 38, bone="head")
    add("cap_brim", [(-44, -690), (-90, -686), (-96, -672), (-46, -676)], BRIM, 39, bone="head", outline_w=2.5)
    add("bag", [(-14, -14), (14, -16), (18, 12), (-4, 18), (-16, 6)], BAG, 60, bone=None)  # placed by the scene


# --------------------------------------------------------------------- geometry

def bezier_handles(anchors, tension):
    n = len(anchors)
    pts = np.array(anchors)
    out = []
    for i in range(n):
        d = (pts[(i + 1) % n] - pts[(i - 1) % n]) / 6.0 * tension
        out.append(d)
    return pts, np.array(out)


def flatten(anchors, tension, steps=8):
    pts, h = bezier_handles(anchors, tension)
    n = len(pts)
    poly = []
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        c0, c1 = p0 + h[i], p1 - h[(i + 1) % n]
        for s in range(steps):
            t = s / steps
            u = 1 - t
            poly.append(u ** 3 * p0 + 3 * u * u * t * c0 + 3 * u * t * t * c1 + t ** 3 * p1)
    return np.array(poly)


def offset_outline(poly, dist):
    """Push every vertex outward along its normal so a textured polygon keeps the whole baked stroke
    (a polygon edge on the stroke's centre line would clip the outer half and thin the outline)."""
    n = len(poly)
    area = 0.5 * sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    sign = 1.0 if area > 0 else -1.0     # outward normal = (dy, -dx) for CCW in y-down... resolved by sign
    out = []
    for i in range(n):
        t = poly[(i + 1) % n] - poly[(i - 1) % n]
        norm = np.array([t[1], -t[0]])
        L = np.linalg.norm(norm)
        out.append(poly[i] + (norm / L if L > 0 else norm) * dist * sign)
    return np.array(out)


def svg_path(anchors, tension):
    pts, h = bezier_handles(anchors, tension)
    n = len(pts)
    d = ["M %.2f %.2f" % tuple(pts[0])]
    for i in range(n):
        p1 = pts[(i + 1) % n]
        c0, c1 = pts[i] + h[i], p1 - h[(i + 1) % n]
        d.append("C %.2f %.2f %.2f %.2f %.2f %.2f" % (*c0, *c1, *p1))
    return " ".join(d) + " Z"


def rgb(c):
    return "#%02x%02x%02x" % tuple(c)


def bleed(img):
    """Copy colour of the nearest opaque texel into transparent texels (SPEC: no dark fringe)."""
    a = np.array(img)
    opaque = a[..., 3] > 0
    if not opaque.any() or opaque.all():
        return img
    idx = ndimage.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    rgbn = a[..., :3][idx[0], idx[1]]
    a[..., :3] = np.where(opaque[..., None], a[..., :3], rgbn)
    return Image.fromarray(a, "RGBA")


def rasterise(part, poly):
    lo = np.floor(poly.min(axis=0) - part["outline_w"] - PAD).astype(int)
    hi = np.ceil(poly.max(axis=0) + part["outline_w"] + PAD).astype(int)
    w, h = (hi - lo) * SS
    img = Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pp = [((x - lo[0]) * SS, (y - lo[1]) * SS) for x, y in poly]
    d.polygon(pp, fill=tuple(part["fill"]) + (255,))
    d.line(pp + [pp[0]], fill=tuple(part["outline"]) + (255,), width=int(part["outline_w"] * SS), joint="curve")
    # keep the stroke centred on the edge (as SVG does) by drawing it over the fill
    img = img.resize((int(w // SS), int(h // SS)), Image.LANCZOS)
    return bleed(img), lo


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main():
    build_parts()
    for d in ("source", "parts"):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    shapes, prov_files = [], {}
    for p in parts:
        poly = flatten(p["anchors"], p["tension"])
        mesh_poly = offset_outline(poly, p["outline_w"] * 0.5 + 0.5)
        pts, h = bezier_handles(p["anchors"], p["tension"])
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="820" viewBox="-640 -760 1280 820">'
               '<path id="%s" d="%s" fill="%s" stroke="%s" stroke-width="%.1f" stroke-linejoin="round"/></svg>\n'
               % (p["name"], svg_path(p["anchors"], p["tension"]), rgb(p["fill"]), rgb(p["outline"]), p["outline_w"]))
        sp = os.path.join(OUT, "source", p["name"] + ".svg")
        open(sp, "w").write(svg)
        img, lo = rasterise(p, poly)
        pp = os.path.join(OUT, "parts", p["name"] + ".png")
        img.save(pp, optimize=False)
        shapes.append({**p,
                       "origin": [int(lo[0]), int(lo[1])], "size": list(img.size),
                       "png": "parts/%s.png" % p["name"], "svg": "source/%s.svg" % p["name"],
                       "polygon": [[round(float(x), 2), round(float(y), 2)] for x, y in mesh_poly],
                       "handles": [[round(float(x), 3), round(float(y), 3)] for x, y in h]})
        prov_files[p["name"]] = {"svg_sha256": sha(sp), "png_sha256": sha(pp), "label": "generated"}
    json.dump({"schema": "arena-godot-doug-prototype-shapes-v1", "setup": "rig setup pose, y down, root at ground",
               "parts": shapes}, open(os.path.join(OUT, "shapes.json"), "w"), indent=1)
    prov = {
        "schema": "arena-provenance-v1",
        "subject": "Doug prototype parts for godot/scenes/prototypes/anim_compare",
        "label": "generated (scripted vector geometry, tools/gen_doug_art.py); not AI-image generation, not a verified likeness",
        "tool": "godot/tools/gen_doug_art.py (Python, Pillow, numpy, scipy)",
        "generator_sha256": sha(os.path.join(HERE, "gen_doug_art.py")),
        "references": ["public/assets/doug/character.png (colour and costume reference only; not copied or re-published)"],
        "cleanup_steps": ["4x supersampled rasterisation with Lanczos downsample",
                          "colour bled into transparent texels via nearest-opaque copy (SPEC: 8-bit alpha, no dark fringe)"],
        "manual_paint_over_repairs": 0,
        "files": prov_files,
        "notes": "Legacy Doug art under public/ and lab/ is untouched. Owner approved new art for godot/assets/ in the "
                 "session that produced this; likeness sign-off is still owed and no claim of likeness is made.",
    }
    json.dump(prov, open(os.path.join(OUT, "PROVENANCE.json"), "w"), indent=1)
    print("wrote %d parts to %s" % (len(parts), OUT))


if __name__ == "__main__":
    sys.exit(main())
