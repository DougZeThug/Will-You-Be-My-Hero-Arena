extends GutTest
## Pins the toolchain assumptions the Godot plan depends on. If one of these fails
## after a Godot upgrade, re-read godot/PROBES.md before changing the test.


func test_engine_version_is_the_pinned_one() -> void:
	assert_true(Engine.get_version_info().string.begins_with("4.7.2-stable"), "pinned in tools/env.sh")


func test_script_floats_are_float64_like_js_numbers() -> void:
	# The TypeScript sim uses JS doubles; parity checks compare script-side float64.
	assert_eq(0.1 + 0.2, 0.30000000000000004)


func test_vector2_is_float32_so_never_compare_parity_on_node_transforms() -> void:
	# Node transforms are single precision in the official build. Parity thresholds
	# tighter than ~1e-4 px must be evaluated on script-side float64 values.
	assert_eq(Vector2(16777217.0, 0.0).x, 16777216.0)


func _build_player() -> Array:
	var holder := Node2D.new()
	add_child_autofree(holder)
	var target := Node2D.new()
	target.name = "Target"
	holder.add_child(target)
	var anim := Animation.new()
	anim.length = 2.0
	var track := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(track, NodePath("Target:position"))
	anim.track_set_interpolation_type(track, Animation.INTERPOLATION_CUBIC)
	anim.track_insert_key(track, 0.0, Vector2(0, 0))
	anim.track_insert_key(track, 0.7, Vector2(120.5, -33.25))
	anim.track_insert_key(track, 1.3, Vector2(300.125, 10.0))
	anim.track_insert_key(track, 2.0, Vector2(500, 0))
	anim.add_marker("release", 1.3)
	var lib := AnimationLibrary.new()
	lib.add_animation("throw", anim)
	var player := AnimationPlayer.new()
	holder.add_child(player)
	player.root_node = player.get_path_to(holder)
	player.add_animation_library("", lib)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	player.assigned_animation = "throw"
	return [player, target, anim]


func test_manual_animation_seek_is_deterministic_and_matches_advance() -> void:
	var built := _build_player()
	var player: AnimationPlayer = built[0]
	var target: Node2D = built[1]
	var anim: Animation = built[2]
	var times := [1.9, 0.2, 1.3, 0.7, 0.0, 1.31, 0.35, 1.9]
	var first := {}
	for pass_index in 2:
		for t in times:
			player.seek(t, true)
			if pass_index == 0:
				first[t] = target.position
			else:
				assert_eq(target.position, first[t], "seek(%s) differs after other seeks" % t)
	player.seek(0.0, true)
	for i in 84:
		player.advance(1.0 / 60.0)
	var advanced := target.position
	player.seek(84.0 / 60.0, true)
	assert_eq(advanced, target.position, "advance() and seek() must agree (pure function of the clock)")
	assert_almost_eq(anim.get_marker_time("release"), 1.3, 1e-6)
