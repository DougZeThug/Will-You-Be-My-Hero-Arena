#!/usr/bin/env bash
# Run the GUT suite headless. Exit code is GUT's: 0 only if every test passed.
#   run_tests.sh              run res://tests
#   run_tests.sh --selftest   prove that a failing test makes this script fail
#                             (passes only if GUT ran res://tests_selftest and reported
#                             its deliberate failure; a crash does not count)
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
[ -x "$GODOT_BIN" ] || { echo "run_tests: run godot/tools/bootstrap.sh first" >&2; exit 2; }

run_gut() {
  "$GODOT_BIN" --headless --path "$ARENA_GODOT_PROJECT" \
    -s addons/gut/gut_cmdln.gd -gdir="$1" -gexit
}

if [ "${1:-}" = "--selftest" ]; then
  # A non-zero exit is not enough (a crash or a missing binary also exits non-zero): the
  # output must show that the deliberate assertion actually ran and failed.
  out="$(run_gut res://tests_selftest 2>&1)"; rc=$?
  clean="$(sed 's/\x1b\[[0-9;]*m//g' <<<"$out")"
  if [ "$rc" -eq 0 ]; then
    echo "selftest: FAIL - a deliberately failing test exited 0" >&2; exit 1
  fi
  if ! grep -q "test_deliberate_failure" <<<"$clean" || ! grep -q "\[Failed\]" <<<"$clean" \
     || ! grep -Eq "Failing Tests +1( |$)" <<<"$clean"; then
    echo "selftest: FAIL - exit status $rc, but GUT did not report the deliberate failure (crash or load error?)" >&2
    tail -15 <<<"$clean" >&2
    exit 1
  fi
  echo "selftest: OK - GUT ran the deliberate failure and it produced a non-zero exit code"
  exit 0
fi

run_gut res://tests
