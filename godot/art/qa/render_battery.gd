extends Node2D
## Renders every pose in art/pose_battery.json twice (beauty + flat ID pass) on a
## key-colour background, and writes a manifest with joints, sockets and part colours
## for art/qa/rig_qa.py. Run through tools/rig_qa.sh (needs Xvfb + software GL).
##
## User args (after `--`): --out=<dir> [--inject=<defect>] [--ground=<y>] [--root-x=<x>]

const KEY := Color(1.0, 0.0, 1.0)
const GROUND_Y := 1000.0
const ROOT_X := 450.0

var out_dir := ""
var inject := ""


func _parse_args() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out_dir = a.trim_prefix("--out=")
		elif a.begins_with("--inject="):
			inject = a.trim_prefix("--inject=")


func _grab(path: String) -> void:
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(path)


func _ready() -> void:
	_parse_args()
	if out_dir == "":
		push_error("render_battery: --out=<dir> is required")
		get_tree().quit(2)
		return
	DirAccess.make_dir_recursive_absolute(out_dir)

	var bg := ColorRect.new()
	bg.color = KEY
	bg.size = Vector2(get_viewport().size)
	bg.z_as_relative = false
	bg.z_index = -100
	add_child(bg)

	var puppet := TestPuppet.new(inject)
	puppet.position = Vector2(ROOT_X, GROUND_Y)
	add_child(puppet)
	await get_tree().process_frame

	var battery: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://art/pose_battery.json"))
	var manifest := {
		"viewport": [get_viewport().size.x, get_viewport().size.y],
		"ground_y": GROUND_Y,
		"root": [ROOT_X, GROUND_Y],
		"root_scale": puppet.scale.x,
		"inject": inject,
		"godot": Engine.get_version_info().string,
		"parts": {},
		"setup_lengths": puppet.setup_lengths,
		"part_groups": puppet.part_groups(),
		"poses": [],
	}
	for part_name in puppet.id_colors:
		var c: Color = puppet.id_colors[part_name]
		manifest["parts"][part_name] = [c.r8, c.g8, c.b8]

	for pose in battery["poses"]:
		puppet.apply_pose(pose)
		var joints := {}
		var jp := puppet.joint_positions()
		for k in jp:
			joints[k] = [snappedf((jp[k] as Vector2).x, 0.001), snappedf((jp[k] as Vector2).y, 0.001)]
		var palm := puppet.palm_position()
		var socket := puppet.bag_socket.global_position
		var planted: Array = []
		for side in ["near", "far"]:
			var f: Dictionary = pose.get("foot_" + side, {})
			if float(f.get("lift", 0.0)) == 0.0:
				planted.append("foot_" + side)
		manifest["poses"].append({
			"name": pose["name"],
			"joints": joints,
			"palm": [palm.x, palm.y],
			"held_socket": [socket.x, socket.y] if pose.get("held_object", false) else null,
			"planted": planted,
		})
		puppet.set_pass(false)
		await _grab("%s/%s_beauty.png" % [out_dir, pose["name"]])
		puppet.set_pass(true)
		await _grab("%s/%s_id.png" % [out_dir, pose["name"]])

	manifest["unreachable"] = puppet.unreachable
	var f := FileAccess.open("%s/manifest.json" % out_dir, FileAccess.WRITE)
	f.store_string(JSON.stringify(manifest, "\t"))
	f.close()
	print("render_battery: wrote %d poses to %s (inject=%s, unreachable=%s)" % [battery["poses"].size(), out_dir, inject if inject != "" else "none", str(puppet.unreachable)])
	get_tree().quit(0)
