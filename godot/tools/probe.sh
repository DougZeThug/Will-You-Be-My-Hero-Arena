#!/usr/bin/env bash
# Re-run the recorded capability probes (see godot/PROBES.md). Prints result lines and
# exits non-zero if ANY probe crashed, raised a script error, or printed fewer result
# lines than expected, so one healthy probe can never hide a broken one.
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
[ -x "$GODOT_BIN" ] || { echo "probe: run godot/tools/bootstrap.sh first" >&2; exit 2; }
G=(--path "$ARENA_GODOT_PROJECT")
status=0

# run_probe <label> <result-line regex> <min result lines> <command...>
run_probe() {
  local label="$1" marker="$2" min="$3" out rc n
  shift 3
  echo "== $label"
  out="$("$@" 2>&1)"
  rc=$?
  grep -E "$marker|SCRIPT ERROR" <<<"$out" || true
  n="$(grep -cE "$marker" <<<"$out")"
  if [ "$rc" -ne 0 ]; then echo "probe: '$label' exited with status $rc" >&2; status=1; fi
  if grep -q "SCRIPT ERROR" <<<"$out"; then echo "probe: '$label' raised a script error" >&2; status=1; fi
  if [ "$n" -lt "$min" ]; then echo "probe: '$label' printed $n result lines, expected at least $min" >&2; status=1; fi
}

run_probe "API surface" "^(VERSION|CLASSES|HAS)" 3 \
  "$GODOT_BIN" --headless "${G[@]}" -s probes/introspect.gd
run_probe "2D IK behaviour" "^IK (reach|bend)" 2 \
  "$GODOT_BIN" --headless "${G[@]}" -s probes/ik_probe.gd
run_probe "rendered probes (Xvfb + llvmpipe)" "^(SKIN|ALPHA)" 7 \
  timeout 300 xvfb-run -a -s "-screen 0 640x360x24" "$GODOT_BIN" "${G[@]}" res://probes/capability_probe.tscn \
  --rendering-driver opengl3 --audio-driver Dummy --resolution 640x360

[ "$status" -eq 0 ] && echo "probe: all probes ran" || echo "probe: PROBLEMS FOUND" >&2
exit "$status"
