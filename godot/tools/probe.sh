#!/usr/bin/env bash
# Re-run the recorded capability probes (see godot/PROBES.md). Prints result lines.
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
[ -x "$GODOT_BIN" ] || { echo "probe: run godot/tools/bootstrap.sh first" >&2; exit 2; }
G=(--path "$ARENA_GODOT_PROJECT")
echo "== API surface"; "$GODOT_BIN" --headless "${G[@]}" -s probes/introspect.gd 2>&1 | grep -E "^(VERSION|CLASSES|HAS)"
echo "== 2D IK behaviour"; "$GODOT_BIN" --headless "${G[@]}" -s probes/ik_probe.gd 2>&1 | grep -E "^IK|SCRIPT ERROR"
echo "== rendered probes (Xvfb + llvmpipe)"
timeout 300 xvfb-run -a -s "-screen 0 640x360x24" "$GODOT_BIN" "${G[@]}" res://probes/capability_probe.tscn \
  --rendering-driver opengl3 --audio-driver Dummy --resolution 640x360 2>&1 | grep -E "^(SKIN|ALPHA)|SCRIPT ERROR"
