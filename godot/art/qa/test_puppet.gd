class_name TestPuppet
extends Node2D
## Hand-assembled test skeleton for the rig-QA gate: a Skeleton2D + Bone2D hierarchy
## that follows the bone/joint names of art/SPEC.md, flat-coloured rigid parts with
## joint caps, and analytic two-bone leg IK. It exists to prove the gate can PASS a
## sound rig and FAIL specific defects (see `inject`); it is not character art.
##
## Angles are degrees, Godot convention (positive = clockwise on screen).

const HIP_HEIGHT := 400.0
const SOLE_BELOW_ANKLE := 30.0
const THIGH_LEN := 185.0
const SHIN_LEN := 185.0

## Defect to build in: "", "gap_elbow", "hand_detached", "foot_floating",
## "limb_stretch", "far_arm_strip", "socket_drift".
var inject := ""

var bones: Dictionary = {}          # bone name -> Bone2D
var parts: Dictionary = {}          # part name -> Polygon2D
var beauty_colors: Dictionary = {}  # part name -> Color
var id_colors: Dictionary = {}      # part name -> Color (unique, flat)
var setup_lengths: Dictionary = {}  # "a>b" joint pair -> setup distance in px
var bag_socket: Node2D
var unreachable: Array = []         # pose names whose IK target was out of reach

var _bone_len: Dictionary = {}
var _bone_world_deg: Dictionary = {}
var _rest_pos: Dictionary = {}
var _rest_rot: Dictionary = {}
var _skeleton: Skeleton2D
var _id_counter := 0


func _init(defect: String = "") -> void:
	inject = defect


func _ready() -> void:
	_build()


# ---------------------------------------------------------------- construction

func _bone(bone_name: String, parent_name: String, world_deg: float, length: float, offset := Vector2.ZERO, at_tip := true) -> Bone2D:
	var b := Bone2D.new()
	b.name = bone_name
	# Off before add_child: a leaf bone otherwise warns "No Bone2D children" on entering the tree
	# (GUT counts that as an unexpected error). Length and angle are set explicitly below.
	b.set_autocalculate_length_and_angle(false)
	var parent: Node2D = _skeleton if parent_name == "" else bones[parent_name]
	parent.add_child(b)
	var parent_deg: float = 0.0 if parent_name == "" else _bone_world_deg[parent_name]
	var base := Vector2.ZERO
	if parent_name != "" and at_tip:
		base = Vector2(_bone_len[parent_name], 0.0)
	b.position = base + offset
	b.rotation = deg_to_rad(world_deg - parent_deg)
	b.set_autocalculate_length_and_angle(false)
	b.set_length(length)
	b.set_bone_angle(0.0)
	bones[bone_name] = b
	_bone_len[bone_name] = length
	_bone_world_deg[bone_name] = world_deg
	return b


func _unique_id_color() -> Color:
	_id_counter += 1
	var i := _id_counter
	return Color8(30 + (i * 37) % 200, 30 + (i * 91) % 200, 30 + (i * 53) % 200)


func _register(part_name: String, poly: Polygon2D, bone_name: String, z: int, beauty: Color) -> void:
	bones[bone_name].add_child(poly)
	poly.z_as_relative = false
	poly.z_index = z
	poly.color = beauty
	parts[part_name] = poly
	beauty_colors[part_name] = beauty
	id_colors[part_name] = _unique_id_color()


func _rect(bone_name: String, part_name: String, half_w: float, length: float, z: int, beauty: Color, start_pad := 0.0, end_pad := 0.0, shift := Vector2.ZERO) -> void:
	var poly := Polygon2D.new()
	var x0 := -start_pad
	var x1 := length + end_pad
	poly.polygon = PackedVector2Array([
		Vector2(x0, -half_w) + shift, Vector2(x1, -half_w) + shift,
		Vector2(x1, half_w) + shift, Vector2(x0, half_w) + shift])
	_register(part_name, poly, bone_name, z, beauty)


func _cap(bone_name: String, part_name: String, radius: float, at_tip: bool, z: int, beauty: Color) -> void:
	var poly := Polygon2D.new()
	var pts := PackedVector2Array()
	var cx: float = _bone_len[bone_name] if at_tip else 0.0
	for i in 24:
		var a := TAU * float(i) / 24.0
		pts.append(Vector2(cx + cos(a) * radius, sin(a) * radius))
	poly.polygon = pts
	_register(part_name, poly, bone_name, z, beauty)


func _build() -> void:
	_skeleton = Skeleton2D.new()
	_skeleton.name = "Skeleton"
	add_child(_skeleton)

	_bone("root", "", 0.0, 0.0)
	_bone("pelvis", "root", -90.0, 20.0, Vector2(0, -HIP_HEIGHT), false)
	_bone("spine_lower", "pelvis", -90.0, 80.0)
	_bone("spine_upper", "spine_lower", -90.0, 90.0)
	_bone("neck", "spine_upper", -90.0, 20.0)
	_bone("head", "neck", -90.0, 110.0)
	# Local +x runs along the bone (up at rest), local +y is screen-right at rest.
	_bone("clavicle_near", "spine_upper", 0.0, 1.0, Vector2(-14, 6))
	_bone("clavicle_far", "spine_upper", 0.0, 1.0, Vector2(-14, -6))
	for side in ["near", "far"]:
		_bone("upper_arm_" + side, "clavicle_" + side, 90.0, 150.0, Vector2.ZERO, false)
		_bone("forearm_" + side, "upper_arm_" + side, 90.0, 130.0)
		_bone("hand_" + side, "forearm_" + side, 90.0, 45.0)
	for side in ["near", "far"]:
		var hip_off := Vector2(0, 6) if side == "near" else Vector2(0, -6)
		_bone("thigh_" + side, "pelvis", 90.0, THIGH_LEN, hip_off, false)
		_bone("shin_" + side, "thigh_" + side, 90.0, SHIN_LEN)
		_bone("foot_" + side, "shin_" + side, 0.0, 70.0)

	# Sockets: palm socket on the near hand, and the held-object socket that must
	# stay on it until release.
	var palm := Node2D.new()
	palm.name = "palm_near"
	bones["hand_near"].add_child(palm)
	palm.position = Vector2(38, 0)
	bag_socket = Node2D.new()
	bag_socket.name = "bag_socket"
	palm.add_child(bag_socket)
	if inject == "socket_drift":
		bag_socket.position = Vector2(0, 14)

	_build_parts()

	for bone_name in bones:
		var b: Bone2D = bones[bone_name]
		b.rest = b.transform
		_rest_pos[bone_name] = b.position
		_rest_rot[bone_name] = b.rotation
	_record_setup_lengths()


func _build_parts() -> void:
	var skin := Color(0.93, 0.74, 0.58)
	var shirt := Color(0.20, 0.55, 0.62)
	var shorts := Color(0.88, 0.62, 0.18)
	var shoe := Color(0.25, 0.22, 0.30)
	var far_shade := 0.82
	# z groups: far arm 10/11, far leg 20/21, torso+head 30/31, near leg 40/41, near arm 50/51
	var strip := inject == "far_arm_strip"
	for side in ["far", "near"]:
		var arm_z := 10 if side == "far" else 50
		var leg_z := 20 if side == "far" else 40
		var k := far_shade if side == "far" else 1.0
		var shirt_c := shirt * Color(k, k, k, 1.0)
		var skin_c := skin * Color(k, k, k, 1.0)
		var shorts_c := shorts * Color(k, k, k, 1.0)
		var shoe_c := shoe * Color(k, k, k, 1.0)
		var arm_hw_up := 3.0 if (strip and side == "far") else 23.0
		var arm_hw_fore := 3.0 if (strip and side == "far") else 19.0
		_rect("upper_arm_" + side, "upper_arm_" + side, arm_hw_up, 150.0, arm_z, shirt_c)
		var fore_len := 130.0
		var fore_scale := 1.15 if (inject == "limb_stretch" and side == "near") else 1.0
		_rect("forearm_" + side, "forearm_" + side, arm_hw_fore, fore_len * fore_scale, arm_z, skin_c)
		var hand_shift := Vector2(46, 0) if (inject == "hand_detached" and side == "near") else Vector2.ZERO
		_rect("hand_" + side, "hand_" + side, 17.0, 45.0, arm_z, skin_c, 0.0, 0.0, hand_shift)
		if not (strip and side == "far"):
			_cap("upper_arm_" + side, "cap_shoulder_" + side, 30.0, false, arm_z + 1, shirt_c)
			if inject != "gap_elbow":
				_cap("forearm_" + side, "cap_elbow_" + side, 26.0, false, arm_z + 1, skin_c)
			_cap("hand_" + side, "cap_wrist_" + side, 20.0, false, arm_z + 1, skin_c)
		_rect("thigh_" + side, "thigh_" + side, 35.0, THIGH_LEN, leg_z, shorts_c)
		_rect("shin_" + side, "shin_" + side, 27.0, SHIN_LEN, leg_z, skin_c)
		var foot_shift := Vector2(0, -12) if (inject == "foot_floating" and side == "near") else Vector2.ZERO
		var foot := Polygon2D.new()
		foot.polygon = PackedVector2Array([
			Vector2(-25, -15) + foot_shift, Vector2(60, -15) + foot_shift, Vector2(75, 10) + foot_shift,
			Vector2(75, 30) + foot_shift, Vector2(-25, 30) + foot_shift])
		_register("foot_" + side, foot, "foot_" + side, leg_z, shoe_c)
		_cap("thigh_" + side, "cap_hip_" + side, 40.0, false, leg_z + 1, shorts_c)
		_cap("shin_" + side, "cap_knee_" + side, 32.0, false, leg_z + 1, skin_c)
		_cap("foot_" + side, "cap_ankle_" + side, 28.0, false, leg_z + 1, shoe_c)
	_rect("spine_lower", "torso_lower", 55.0, 80.0, 30, shirt)
	_rect("spine_upper", "torso_upper", 60.0, 90.0, 30, shirt)
	_cap("spine_upper", "cap_waist", 62.0, false, 31, shirt)
	_rect("neck", "neck", 20.0, 20.0, 30, skin)
	_cap("neck", "cap_neck", 22.0, false, 31, skin)
	_rect("head", "head", 50.0, 110.0, 35, skin)


func _record_setup_lengths() -> void:
	# Setup lengths come from the bind pose (before any pose is applied).
	var contract: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://art/qa/skeleton_contract.json"))
	var pos := joint_positions()
	for pair in contract["rigid_limbs"]:
		setup_lengths["%s>%s" % [pair[0], pair[1]]] = (pos[pair[0]] as Vector2).distance_to(pos[pair[1]] as Vector2)


# ------------------------------------------------------------------- posing

func _reset_pose() -> void:
	for bone_name in bones:
		var b: Bone2D = bones[bone_name]
		b.position = _rest_pos[bone_name]
		b.rotation = _rest_rot[bone_name]
	if inject == "limb_stretch":
		bones["hand_near"].position = Vector2(130.0 * 1.15, 0.0)


func _rot(bone_name: String, delta_deg: float) -> void:
	var b: Bone2D = bones[bone_name]
	b.rotation = _rest_rot[bone_name] + deg_to_rad(delta_deg)


func apply_pose(pose: Dictionary) -> void:
	_reset_pose()
	var pelvis: Dictionary = pose.get("pelvis", {})
	bones["pelvis"].position = _rest_pos["pelvis"] + Vector2(pelvis.get("tx", 0.0), pelvis.get("ty", 0.0))
	_rot("pelvis", pelvis.get("rot", 0.0))
	_rot("spine_lower", pose.get("spine_lower", 0.0))
	_rot("spine_upper", pose.get("spine_upper", 0.0))
	_rot("neck", pose.get("neck", 0.0))
	for side in ["near", "far"]:
		var arm: Dictionary = pose.get("arm_" + side, {})
		_rot("upper_arm_" + side, arm.get("shoulder", 0.0))
		_rot("forearm_" + side, arm.get("elbow", 0.0))
		_rot("hand_" + side, arm.get("wrist", 0.0))
	for side in ["near", "far"]:
		var f: Dictionary = pose.get("foot_" + side, {"dx": 0.0, "lift": 0.0})
		_solve_leg(side, f.get("dx", 0.0), f.get("lift", 0.0), String(pose.get("name", "?")))


func _solve_leg(side: String, dx: float, lift: float, pose_name: String) -> void:
	var thigh: Bone2D = bones["thigh_" + side]
	var shin: Bone2D = bones["shin_" + side]
	var foot: Bone2D = bones["foot_" + side]
	var root_pos: Vector2 = bones["root"].global_position
	var hip: Vector2 = thigh.global_position
	var ankle_target := root_pos + Vector2(dx, -lift - SOLE_BELOW_ANKLE)
	var v := ankle_target - hip
	var reach := THIGH_LEN + SHIN_LEN - 0.01
	if v.length() > reach:
		unreachable.append("%s/%s" % [pose_name, side])
	var d := clampf(v.length(), 1.0, reach)
	var a := acos(clampf((THIGH_LEN * THIGH_LEN + d * d - SHIN_LEN * SHIN_LEN) / (2.0 * THIGH_LEN * d), -1.0, 1.0))
	var base := v.angle()
	var best_angle := base + a
	var best_knee := hip + Vector2.from_angle(best_angle) * THIGH_LEN
	var alt_angle := base - a
	var alt_knee := hip + Vector2.from_angle(alt_angle) * THIGH_LEN
	if alt_knee.x > best_knee.x:
		best_angle = alt_angle
		best_knee = alt_knee
	thigh.global_rotation = best_angle
	shin.global_rotation = (ankle_target - best_knee).angle()
	foot.global_rotation = 0.0


# ------------------------------------------------------------------- export

func _tip(bone_name: String) -> Vector2:
	return (bones[bone_name] as Bone2D).to_global(Vector2(_bone_len[bone_name], 0.0))


func _origin(bone_name: String) -> Vector2:
	return (bones[bone_name] as Bone2D).global_position


func joint_positions() -> Dictionary:
	var j := {
		"hip_c": _origin("pelvis"),
		"waist": _origin("spine_upper"),
		"chest_top": _origin("neck"),
		"neck_top": _origin("head"),
		"head_top": _tip("head"),
	}
	for side in ["near", "far"]:
		j["shoulder_" + side] = _origin("upper_arm_" + side)
		j["elbow_" + side] = _origin("forearm_" + side)
		j["wrist_" + side] = _origin("hand_" + side)
		j["hand_tip_" + side] = _tip("hand_" + side)
		j["hip_" + side] = _origin("thigh_" + side)
		j["knee_" + side] = _origin("shin_" + side)
		j["ankle_" + side] = _origin("foot_" + side)
		j["toe_" + side] = _tip("foot_" + side)
	return j


## Parts that count as one for the adjacency metric: a limb plus its joint cap.
func part_groups() -> Dictionary:
	var g := {}
	for part_name in parts:
		g[part_name] = [part_name]
	var owner := {"shoulder": "upper_arm", "elbow": "forearm", "wrist": "hand", "hip": "thigh", "knee": "shin", "ankle": "foot"}
	for part_name in parts:
		if not String(part_name).begins_with("cap_"):
			continue
		var bits: PackedStringArray = String(part_name).split("_")
		if bits.size() == 3:
			g[owner[bits[1]] + "_" + bits[2]].append(part_name)
		elif part_name == "cap_waist":
			g["torso_upper"].append(part_name)
		elif part_name == "cap_neck":
			g["neck"].append(part_name)
	return g


func palm_position() -> Vector2:
	return (bones["hand_near"] as Bone2D).get_node("palm_near").global_position


func set_pass(id_pass: bool) -> void:
	var table: Dictionary = id_colors if id_pass else beauty_colors
	for part_name in parts:
		(parts[part_name] as Polygon2D).color = table[part_name]
