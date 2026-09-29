extends GutTest
## camera_spike: the same shot list with a plain Camera2D and with Phantom Camera (manual mode).
## Pins what the prototype found about determinism so a future Godot or addon bump that changes it
## shows up here, not in Watch. See godot/PROTOTYPES.md.

const SAMPLES := [0.9, 1.5, 2.0, 2.4, 2.6, 3.0, 3.4, 4.2]


func _spike(mode: int, step := CameraSpike.STEP) -> CameraSpike:
	var s := CameraSpike.new()
	s.mode = mode
	s.step_seconds = step
	s.hold_time = 0.0            # stay parked; the test drives the clock
	add_child_autofree(s)
	await wait_until(func(): return s.live, 2.0)
	return s


func _state(s: CameraSpike) -> Array:
	return [s.camera_position(), s.camera_zoom()]


func test_plain_camera_is_a_pure_function_of_time() -> void:
	var forward := await _spike(CameraSpike.Mode.PLAIN)
	var jumper := await _spike(CameraSpike.Mode.PLAIN)
	var expected := {}
	for t in SAMPLES:
		await forward.seek(t)
		expected[t] = _state(forward)
	var order := SAMPLES.duplicate()
	order.reverse()
	for t in order:
		await jumper.seek(t)
		assert_eq(_state(jumper), expected[t], "plain camera at t=%s does not depend on how it got there" % t)


func test_plain_camera_does_not_depend_on_the_step_size() -> void:
	var fine := await _spike(CameraSpike.Mode.PLAIN, 1.0 / 60.0)
	var coarse := await _spike(CameraSpike.Mode.PLAIN, 1.0 / 30.0)
	for t in SAMPLES:
		await fine.seek(t)
		await coarse.seek(t)
		assert_almost_eq(fine.camera_position().x, coarse.camera_position().x, 1e-3, "x at t=%s" % t)
		assert_almost_eq(fine.camera_position().y, coarse.camera_position().y, 1e-3, "y at t=%s" % t)
		assert_almost_eq(fine.camera_zoom(), coarse.camera_zoom(), 1e-5, "zoom at t=%s" % t)


func test_phantom_seek_by_replay_equals_continuous_play() -> void:
	var played := await _spike(CameraSpike.Mode.PHANTOM)
	var replayed := await _spike(CameraSpike.Mode.PHANTOM)
	await replayed.seek(4.2)
	for t in SAMPLES:
		await played.seek(t)                 # forward only: never rebuilt
		await replayed.seek(t)               # backwards after the first jump: rebuild and replay
		assert_eq(_state(replayed), _state(played), "phantom replay at t=%s equals continuous play" % t)


func test_phantom_measured_deviation_and_step_dependence() -> void:
	var plain := await _spike(CameraSpike.Mode.PLAIN)
	var p60 := await _spike(CameraSpike.Mode.PHANTOM, 1.0 / 60.0)
	var p30 := await _spike(CameraSpike.Mode.PHANTOM, 1.0 / 30.0)
	var worst_vs_plain := 0.0
	var worst_step := 0.0
	for t in SAMPLES:
		await plain.seek(t)
		await p60.seek(t)
		await p30.seek(t)
		worst_vs_plain = maxf(worst_vs_plain, p60.camera_position().distance_to(plain.camera_position()))
		worst_step = maxf(worst_step, p60.camera_position().distance_to(p30.camera_position()))
		gut.p("t=%.1f plain=%s phantom60=%s phantom30=%s" % [t, plain.camera_position(), p60.camera_position(), p30.camera_position()])
	gut.p("MEASURED worst phantom-vs-plain distance %.3f px; worst 60Hz-vs-30Hz phantom distance %.3f px" % [worst_vs_plain, worst_step])
	# Pinned findings (measured 2026-09-29, Phantom Camera 0.11.0.3, Godot 4.7.2): Phantom's camera is
	# history-dependent, so a different step gives a visibly different camera, and its tween starts a
	# frame after the priority switch, so it trails the plain reference. If either flips after an
	# upgrade, re-read godot/PROTOTYPES.md before relaxing these.
	assert_gt(worst_step, 1.0, "phantom camera depends on the step size (60 Hz vs 30 Hz)")
	assert_lt(worst_vs_plain, 60.0, "phantom stays within a shot-width fraction of the plain reference")
