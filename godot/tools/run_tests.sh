#!/usr/bin/env bash
# Run the GUT suite headless. Exit code is GUT's: 0 only if every test passed.
#   run_tests.sh              run res://tests
#   run_tests.sh --selftest   prove that a failing test makes this script fail
#                             (passes only if res://tests_selftest exits non-zero)
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
[ -x "$GODOT_BIN" ] || { echo "run_tests: run godot/tools/bootstrap.sh first" >&2; exit 2; }

run_gut() {
  "$GODOT_BIN" --headless --path "$ARENA_GODOT_PROJECT" \
    -s addons/gut/gut_cmdln.gd -gdir="$1" -gexit
}

if [ "${1:-}" = "--selftest" ]; then
  if run_gut res://tests_selftest >/dev/null 2>&1; then
    echo "selftest: FAIL - a deliberately failing test exited 0" >&2
    exit 1
  fi
  echo "selftest: OK - a failing test produces a non-zero exit code"
  exit 0
fi

run_gut res://tests
