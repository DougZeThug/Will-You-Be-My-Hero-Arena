extends GutTest
## Invariants for the anim_compare prototype (godot/scenes/prototypes/anim_compare). These
## check the shared motion and all three rig variants against the rules in godot/AGENTS.md:
## clock as a pure function of time, bag on the palm until release, planted feet, at most 4
## skin influences, and no random numbers or physics bodies in the prototype code.

const VARIANTS := [DougRig.Variant.SKINNED, DougRig.Variant.SVS, DougRig.Variant.HYBRID]
## Fixed (not random) seek order, deliberately jumping backwards and across the release marker.
const SEEK_TIMES := [4.1, 0.3, 2.26, 1.9, 2.5, 0.0, 3.3, 2.1, 4.45, 1.2, 2.27, 0.9, 3.9, 2.0, 2.4, 1.0, 3.0, 0.65, 2.26, 4.4]


func _rig(variant: int) -> DougRig:
	var rig := DougRig.new(variant)
	add_child_autofree(rig)
	return rig


func _signature(rig: DougRig) -> Array:
	var sig: Array = []
	for bone_name in rig.bones:
		sig.append((rig.bones[bone_name] as Bone2D).global_transform)
	for s in rig._svs_shapes:
		sig.append((s as ScalableVectorShape2D).cached_outline.duplicate())
	sig.append(rig._bag.position)
	sig.append(rig.hand_state)
	return sig


func test_release_marker_is_frame_51_of_the_reference() -> void:
	assert_almost_eq(ThrowMotion.release_time(), 2.26, 1e-9)
	assert_almost_eq(ThrowMotion.time_to_frame(ThrowMotion.release_time()), 51.0, 1e-9)


func test_pose_is_a_pure_function_of_time() -> void:
	for t in SEEK_TIMES:
		assert_eq(ThrowMotion.pose_at(t), ThrowMotion.pose_at(t), "pose_at(%s) repeats" % t)


func test_seek_order_does_not_change_any_variant() -> void:
	for variant in VARIANTS:
		var forward := _rig(variant)
		var jumper := _rig(variant)
		var expected := {}
		for t in SEEK_TIMES:
			forward.set_time(t)
			expected[t] = _signature(forward)
		var order := SEEK_TIMES.duplicate()
		order.reverse()
		for t in order:
			jumper.set_time(t)
			assert_eq(_signature(jumper), expected[t], "variant %d at t=%s equals forward play" % [variant, t])


func test_bag_is_on_the_palm_until_release_then_leaves_it() -> void:
	for variant in VARIANTS:
		var rig := _rig(variant)
		for t in [0.0, 0.7, 1.5, 2.2, 2.25]:
			rig.set_time(t)
			assert_eq(rig._bag.position, rig.to_local(rig.bag_socket.global_position), "attached at t=%s (variant %d)" % [t, variant])
		rig.set_time(ThrowMotion.release_time() + 0.3)
		assert_gt(rig._bag.position.distance_to(rig.to_local(rig.bag_socket.global_position)), 20.0, "released bag has left the palm")
		rig.set_time(ThrowMotion.landed_time() + 0.5)
		assert_almost_eq(rig._bag.position.x, rig.bag_target.x, 1e-3)
		assert_almost_eq(rig._bag.position.y, rig.bag_target.y, 1e-3)


func test_feet_stay_planted_and_on_the_ground_through_the_throw() -> void:
	var rig := _rig(DougRig.Variant.SKINNED)
	var t := 0.0
	var first := {}
	while t <= ThrowMotion.end_time():
		rig.set_time(t)
		for side in ["near", "far"]:
			var foot: Bone2D = rig.bones["foot_" + side]
			var sole := foot.global_position + Vector2(0.0, TestPuppet.SOLE_BELOW_ANKLE)
			assert_almost_eq(sole.y, 0.0, 0.01, "%s sole on the ground at t=%.2f" % [side, t])
			if not first.has(side):
				first[side] = foot.global_position.x
			assert_almost_eq(foot.global_position.x, first[side], 0.01, "%s foot does not slide at t=%.2f" % [side, t])
		t += 1.0 / 30.0
	assert_eq(rig.unreachable, [], "no IK target was out of reach")


func test_skinned_meshes_use_at_most_four_influences_and_normalised_weights() -> void:
	var rig := _rig(DougRig.Variant.SKINNED)
	assert_gt(rig._skinned_polys.size(), 6, "the continuous limbs, torso and shorts are skinned meshes")
	for poly: Polygon2D in rig._skinned_polys:
		var count := poly.polygon.size()
		var per_vertex_total := PackedFloat32Array()
		per_vertex_total.resize(count)
		var influences := PackedInt32Array()
		influences.resize(count)
		for b in poly.get_bone_count():
			var w := poly.get_bone_weights(b)
			for i in count:
				per_vertex_total[i] += w[i]
				if w[i] > 0.0:
					influences[i] += 1
		for i in count:
			assert_lte(influences[i], 4, "%s vertex %d influences" % [poly.name, i])
			assert_almost_eq(per_vertex_total[i], 1.0, 1e-4, "%s vertex %d weights sum to 1" % [poly.name, i])


func test_variants_share_one_art_source() -> void:
	var doc: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/doug/shapes.json"))
	var names := {}
	for p in doc["parts"]:
		names[p["name"]] = true
		assert_true(FileAccess.file_exists("res://assets/doug/" + String(p["png"]) + ".import"), "%s texture is imported" % p["name"])
	for needed in ["arm_near", "leg_near", "sleeve_near", "shorts_near", "torso_tee", "head", "hand_grip_near", "hand_open_near"]:
		assert_true(names.has(needed), needed)
	assert_true(FileAccess.file_exists("res://assets/doug/PROVENANCE.json"), "provenance is recorded")


func test_hybrid_hand_swaps_at_the_release_marker() -> void:
	var rig := _rig(DougRig.Variant.HYBRID)
	# Grip starts at reference frame 12 (t=1.0 exactly), so sample either side of it.
	var expected := {0.1: "relaxed", 0.9: "relaxed", 1.5: "grip", 2.2: "grip", 2.3: "open", 3.5: "relaxed"}
	for t in expected:
		rig.set_time(t)
		assert_eq(rig._hand_sprite.animation, StringName(expected[t]), "hand drawing at t=%s" % t)


func _gd_files(path: String) -> Array:
	var out: Array = []
	for f in DirAccess.get_files_at(path):
		if f.ends_with(".gd"):
			out.append(path.path_join(f))
	for d in DirAccess.get_directories_at(path):
		out.append_array(_gd_files(path.path_join(d)))
	return out


func test_prototype_code_has_no_random_numbers_or_physics_bodies() -> void:
	var banned := ["randf", "randi", "RandomNumberGenerator", "RigidBody2D", "CharacterBody2D", "StaticBody2D", "PhysicsBody2D"]
	var files := _gd_files("res://scenes/prototypes")
	assert_gt(files.size(), 3, "found the prototype scripts")
	for f in files:
		var text := FileAccess.get_file_as_string(f)
		for word in banned:
			assert_false(text.contains(word), "%s must not use %s" % [f, word])
