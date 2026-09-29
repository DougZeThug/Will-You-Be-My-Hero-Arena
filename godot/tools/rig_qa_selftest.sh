#!/usr/bin/env bash
# Mutation test for the rig-QA gate: the clean test puppet must PASS, and every
# injected defect must FAIL on the metric that is supposed to catch it. A gate that
# has never been shown to fail proves nothing.
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
here="$ARENA_GODOT_TOOLS"
status=0

expect_pass() {
  if out="$(bash "$here/rig_qa.sh" 2>&1)"; then echo "OK   clean puppet passes"
  else echo "FAIL clean puppet must pass"; echo "$out" | tail -15; status=1; fi
}

# expect_fail <defect> <metric text that must appear in the failure list>
expect_fail() {
  local defect="$1" needle="$2"
  if out="$(bash "$here/rig_qa.sh" --inject "$defect" 2>&1)"; then
    echo "FAIL $defect: gate passed a defective rig"; status=1
  elif echo "$out" | grep -q -- "$needle"; then
    n="$(echo "$out" | grep -c -- "$needle")"
    echo "OK   $defect is caught by '$needle' ($n hits)"
  else
    echo "FAIL $defect failed, but not on '$needle':"; echo "$out" | grep -E "^    - " | sort | uniq -c | head -5; status=1
  fi
}

expect_pass
expect_fail gap_elbow      "under_"
expect_fail hand_detached  "components="
expect_fail foot_floating  "grounding"
expect_fail limb_stretch   "limb_length"
expect_fail far_arm_strip  "under_"
expect_fail socket_drift   "socket"
[ $status -eq 0 ] && echo "rig_qa selftest: all checks behave" || echo "rig_qa selftest: PROBLEMS FOUND"
exit $status
