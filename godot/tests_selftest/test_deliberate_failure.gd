extends GutTest
## Only ever run by `tools/run_tests.sh --selftest`, which passes when THIS fails.
## It proves that a failing test produces a non-zero exit code.


func test_deliberate_failure() -> void:
	assert_eq(1, 2, "deliberate failure")
