#!/usr/bin/env bash
# Render the pose battery with the hand-assembled test puppet and run the mask-based
# rig-QA gate on it. Exit 0 only if the gate passes.
#   rig_qa.sh [--inject <defect>] [--name <out-name>]
# Defects: gap_elbow hand_detached foot_floating limb_stretch far_arm_strip socket_drift
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
[ -x "$GODOT_BIN" ] || { echo "rig_qa: run godot/tools/bootstrap.sh first" >&2; exit 2; }

inject=""
name=""
while [ $# -gt 0 ]; do
  case "$1" in
    --inject) inject="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    *) echo "rig_qa: unknown argument $1" >&2; exit 2 ;;
  esac
done
case "$inject" in ''|*[!a-z_]*) [ -z "$inject" ] || { echo "rig_qa: unsafe defect name '$inject'" >&2; exit 2; } ;; esac
[ -z "$name" ] || arena_qa_subdir "$name" >/dev/null || exit 2   # validate a user-supplied name on its own
name="${name:-testpuppet${inject:+-$inject}}"
out="$(arena_qa_subdir "rig-qa/$name")" || exit 2
rm -rf "$out"; mkdir -p "$out"

timeout 600 xvfb-run -a -s "-screen 0 900x1100x24" "$GODOT_BIN" \
  --path "$ARENA_GODOT_PROJECT" res://art/qa/render_battery.tscn \
  --rendering-driver opengl3 --audio-driver Dummy --resolution 900x1100 \
  -- "--out=$out" "--inject=$inject" >"$out/godot.log" 2>&1 \
  || { echo "rig_qa: render failed, see $out/godot.log" >&2; tail -20 "$out/godot.log" >&2; exit 1; }
grep -E "^render_battery|SCRIPT ERROR" "$out/godot.log" || true

python3 "$ARENA_GODOT_PROJECT/art/qa/rig_qa.py" "$out" \
  --contract "$ARENA_GODOT_PROJECT/art/qa/skeleton_contract.json" \
  --thresholds "$ARENA_GODOT_PROJECT/art/qa/thresholds.json"
