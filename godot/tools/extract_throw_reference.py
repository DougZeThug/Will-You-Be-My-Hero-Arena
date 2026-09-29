#!/usr/bin/env python3
"""Copy the five compiled throw channels into godot/assets/doug/throw_reference.json.

res:// cannot reach outside godot/, so the prototype reads this derived copy. It is an
authored adaptation of motion-reference/cornhole/reference-throw.json (which is itself
filtered, time-warped monocular MediaPipe data). It is NOT measured motion and says so.
"""
import hashlib, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "..", "motion-reference", "cornhole", "reference-throw.json"))
DST = os.path.normpath(os.path.join(HERE, "..", "assets", "doug", "throw_reference.json"))
d = json.load(open(SRC))
out = {
    "schema": "arena-godot-throw-reference-v1",
    "label": "derived; authored adaptation of a compiled monocular reference, not measured motion",
    "source": "motion-reference/cornhole/reference-throw.json",
    "source_sha256": hashlib.sha256(open(SRC, "rb").read()).hexdigest(),
    "releaseFrame": d["releaseFrame"], "endFrame": d["endFrame"],
    "timeMapping": d["timeMapping"],
    "channels": {k: d["channels"][k] for k in ("upperRight", "elbowRight", "torsoPitch", "pelvisForward", "pelvisLoad")},
}
json.dump(out, open(DST, "w"))
print("wrote", DST)
