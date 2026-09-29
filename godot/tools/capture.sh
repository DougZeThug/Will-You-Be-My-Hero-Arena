#!/usr/bin/env bash
# Render a scene to a PNG sequence under Xvfb with Mesa software GL (Movie Maker
# mode, fixed 60 fps), then build a contact sheet. --headless draws nothing, so
# capture always needs Xvfb. Output: work/qa/godot/<name>/ (git-ignored).
#
#   capture.sh <res://scene.tscn> <name> [frames=120] [WxH=1280x720]
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
[ -x "$GODOT_BIN" ] || { echo "capture: run godot/tools/bootstrap.sh first" >&2; exit 2; }

scene="${1:?scene, e.g. res://scenes/smoke/capture_smoke.tscn}"
name="${2:?capture name}"
frames="${3:-120}"
size="${4:-1280x720}"

out="$ARENA_QA_DIR/$name"
rm -rf "$out"
mkdir -p "$out"

timeout 600 xvfb-run -a -s "-screen 0 ${size}x24" "$GODOT_BIN" \
  --path "$ARENA_GODOT_PROJECT" "$scene" \
  --rendering-driver opengl3 --audio-driver Dummy --resolution "$size" \
  --write-movie "$out/frame.png" --fixed-fps 60 --quit-after "$frames" \
  >"$out/godot.log" 2>&1 || { echo "capture: Godot failed, see $out/godot.log" >&2; tail -20 "$out/godot.log" >&2; exit 1; }

python3 "$ARENA_GODOT_TOOLS/contact_sheet.py" "$out" "$out/contact.png" \
  --expect-frames "$frames" --expect-size "$size"
