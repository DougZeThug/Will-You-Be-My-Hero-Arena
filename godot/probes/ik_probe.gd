extends SceneTree
## Headless: does Skeleton2D two-bone IK actually place a foot on a target, and does
## flipping the bend direction move the knee to the other side?
##   godot --headless --path godot -s probes/ik_probe.gd


func _solve(flip: bool, target_pos: Vector2) -> Dictionary:
	# Skeleton2D builds its bone list on the next frame, so wait before solving.
	var root := Node2D.new()
	get_root().add_child(root)
	var sk := Skeleton2D.new()
	root.add_child(sk)
	var thigh := Bone2D.new()
	thigh.name = "thigh"
	sk.add_child(thigh)
	thigh.rest = Transform2D.IDENTITY
	thigh.set_autocalculate_length_and_angle(false)
	thigh.set_length(60.0)
	thigh.set_bone_angle(0.0)
	var shin := Bone2D.new()
	shin.name = "shin"
	thigh.add_child(shin)
	shin.position = Vector2(60, 0)
	shin.rest = Transform2D(0.0, Vector2(60, 0))
	shin.set_autocalculate_length_and_angle(false)
	shin.set_length(60.0)
	shin.set_bone_angle(0.0)
	var target := Node2D.new()
	target.name = "Target"
	root.add_child(target)
	target.global_position = target_pos

	await process_frame
	await process_frame

	var ik := SkeletonModification2DTwoBoneIK.new()
	ik.target_nodepath = sk.get_path_to(target)
	ik.set_joint_one_bone_idx(0)
	ik.set_joint_two_bone_idx(1)
	ik.flip_bend_direction = flip
	var stack := SkeletonModificationStack2D.new()
	stack.enabled = true
	stack.modification_count = 1
	stack.set_modification(0, ik)
	sk.set_modification_stack(stack)
	stack.setup()
	sk.execute_modifications(1.0 / 60.0, 0)

	var foot := shin.global_position + Vector2(60, 0).rotated(shin.global_rotation)
	var out := {"bones": sk.get_bone_count(), "foot": foot, "knee": shin.global_position, "err": foot.distance_to(target_pos)}
	root.queue_free()
	return out


func _init() -> void:
	var a: Dictionary = await _solve(false, Vector2(20, 100))
	var b: Dictionary = await _solve(true, Vector2(20, 100))
	print("IK bones registered on skeleton: ", a.get("bones", -1))
	print("IK reach: foot error px (no flip)=%.3f (flip)=%.3f" % [a.err, b.err])
	print("IK bend: knee (no flip)=%s knee (flip)=%s -> opposite sides of hip-target line: %s" % [
		a.knee, b.knee, str(sign((a.knee - Vector2.ZERO).cross(Vector2(20, 100))) != sign((b.knee - Vector2.ZERO).cross(Vector2(20, 100))))])
	quit()
