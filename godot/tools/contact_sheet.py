#!/usr/bin/env python3
"""Summarise a PNG frame sequence and build a contact sheet an agent can view.

  contact_sheet.py <frames_dir> <out.png> [--cols 6] [--count 12] [--width 320]
                   [--expect-frames N] [--expect-size WxH]

Prints frame count, size, how many frames are non-uniform and how many are
distinct. Exits non-zero if an --expect-* check fails, so it can gate a capture.
"""
import argparse
import glob
import hashlib
import sys

from PIL import Image, ImageStat


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir")
    ap.add_argument("out")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--count", type=int, default=12)
    ap.add_argument("--width", type=int, default=320)
    ap.add_argument("--expect-frames", type=int)
    ap.add_argument("--expect-size")
    a = ap.parse_args()

    files = sorted(glob.glob(f"{a.frames_dir}/*.png"))
    if not files:
        print("contact_sheet: no PNG frames found", file=sys.stderr)
        return 2
    size = Image.open(files[0]).size
    non_uniform = 0
    digests = set()
    for f in files:
        im = Image.open(f).convert("RGB")
        if max(ImageStat.Stat(im).stddev) > 1.0:
            non_uniform += 1
        digests.add(hashlib.sha1(im.tobytes()).hexdigest())
    print(f"frames={len(files)} size={size[0]}x{size[1]} non_uniform={non_uniform} distinct={len(digests)}")

    step = max(1, len(files) // a.count)
    picks = files[::step][: a.count]
    w = a.width
    h = round(w * size[1] / size[0])
    rows = (len(picks) + a.cols - 1) // a.cols
    sheet = Image.new("RGB", (w * a.cols, h * rows), (24, 24, 24))
    for i, f in enumerate(picks):
        sheet.paste(Image.open(f).convert("RGB").resize((w, h)), ((i % a.cols) * w, (i // a.cols) * h))
    sheet.save(a.out)
    print(f"contact sheet: {a.out}")

    ok = True
    if a.expect_frames is not None and len(files) != a.expect_frames:
        print(f"FAIL: expected {a.expect_frames} frames", file=sys.stderr)
        ok = False
    if a.expect_size and f"{size[0]}x{size[1]}" != a.expect_size:
        print(f"FAIL: expected size {a.expect_size}", file=sys.stderr)
        ok = False
    if a.expect_frames is not None and non_uniform != len(files):
        print("FAIL: some frames are uniform (blank render)", file=sys.stderr)
        ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
