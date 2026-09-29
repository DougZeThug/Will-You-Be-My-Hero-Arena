class_name DougRig
extends TestPuppet
## Doug prototype rig for the animation comparison. It reuses TestPuppet's skeleton, bone
## names, leg IK and palm socket, and replaces the flat test parts with the shared Doug art
## (assets/doug/shapes.json) built three ways:
##
##   SKINNED  Skeleton2D + weighted, textured Polygon2D meshes (continuous limbs, blended joints)
##   SVS      Skeleton2D + Scalable Vector Shapes 2D (curve points assigned to bones)
##   HYBRID   SKINNED body + SpriteFrames hand drawings that swap at the release marker
##
## Presentation only. Pose comes from ThrowMotion.pose_at(t), a pure function of time, so
## set_time() can be called in any order and gives the same picture.

enum Variant { SKINNED, SVS, HYBRID }

const ASSET_DIR := "res://assets/doug/"
const MESH_SPACING := 16.0
const MESH_EDGE_CLEARANCE := 7.0

## Where the bag lands, relative to the rig root (presentation placeholder).
var bag_target := Vector2(300.0, -70.0)
var variant: int = Variant.SKINNED

var _shapes: Dictionary = {}
var _skin_root: Node2D
var _svs_shapes: Array = []
var _skinned_polys: Array = []
var _hand_sprite: AnimatedSprite2D
var _bag: Node2D
var _release_local := Vector2.ZERO
var _have_release := false
var hand_state := "relaxed"


func _init(v: int = Variant.SKINNED) -> void:
	super("")
	variant = v


func _ready() -> void:
	super()
	for s in _svs_shapes:
		s._update_curve()


# ------------------------------------------------------------------ construction

func _load_shapes() -> void:
	var doc: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ASSET_DIR + "shapes.json"))
	for p in doc["parts"]:
		_shapes[p["name"]] = p


func _build_parts() -> void:
	_load_shapes()
	_skin_root = Node2D.new()
	_skin_root.name = "Skin"
	add_child(_skin_root)
	var ordered: Array = _shapes.values()
	ordered.sort_custom(func(a, b): return a["z"] < b["z"])
	for p: Dictionary in ordered:
		var pname: String = p["name"]
		if pname == "bag":
			_build_bag(p)
			continue
		if pname.begins_with("hand_"):
			_build_hand(p)
			continue
		var skinned: bool = (p["bone"] == null)
		match variant:
			Variant.SVS:
				if skinned:
					_add_svs(p, null)
				else:
					_add_svs(p, bones[p["bone"]])
			_:
				if skinned:
					_add_skinned(p)
				else:
					_add_rigid(p, bones[p["bone"]])


func _setup_xform(bone: Bone2D) -> Transform2D:
	# Bone transform in skeleton space, valid while the rig is still in its setup pose.
	return _skeleton_node().global_transform.affine_inverse() * bone.global_transform


func _skeleton_node() -> Skeleton2D:
	return get_node("Skeleton") as Skeleton2D


func _vec_array(list: Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for v in list:
		out.append(Vector2(v[0], v[1]))
	return out


func _texture(p: Dictionary) -> Texture2D:
	return load(ASSET_DIR + String(p["png"])) as Texture2D


func _part_origin(p: Dictionary) -> Vector2:
	return Vector2(p["origin"][0], p["origin"][1])


func _add_rigid(p: Dictionary, bone: Bone2D) -> Polygon2D:
	var inv := _setup_xform(bone).affine_inverse()
	var setup := _vec_array(p["polygon"])
	var poly := Polygon2D.new()
	poly.name = p["name"]
	var local := PackedVector2Array()
	for v in setup:
		local.append(inv * v)
	poly.polygon = local
	poly.texture = _texture(p)
	var uv := PackedVector2Array()
	for v in setup:
		uv.append(v - _part_origin(p))
	poly.uv = uv
	bone.add_child(poly)
	poly.z_as_relative = false
	poly.z_index = int(p["z"])
	return poly


# ------------------------------------------------------------ skinned polygon meshes

func _outline_distance(pt: Vector2, outline: PackedVector2Array) -> float:
	var best := INF
	for i in outline.size():
		var a := outline[i]
		var b := outline[(i + 1) % outline.size()]
		best = minf(best, pt.distance_to(Geometry2D.get_closest_point_to_segment(pt, a, b)))
	return best


func _mesh_points(outline: PackedVector2Array) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in range(0, outline.size(), 2):
		pts.append(outline[i])
	var bounds := Rect2(outline[0], Vector2.ZERO)
	for v in outline:
		bounds = bounds.expand(v)
	var row := 0
	var y := bounds.position.y + MESH_SPACING * 0.5
	while y < bounds.end.y:
		var x := bounds.position.x + MESH_SPACING * (0.5 + 0.5 * float(row % 2))
		while x < bounds.end.x:
			var pt := Vector2(x, y)
			if Geometry2D.is_point_in_polygon(pt, outline) and _outline_distance(pt, outline) > MESH_EDGE_CLEARANCE:
				pts.append(pt)
			x += MESH_SPACING
		y += MESH_SPACING
		row += 1
	return pts


func _joint_axis(chain: Array) -> float:
	# Trunk chains run up the screen (decreasing y); limb chains run down it.
	var last := String(chain[chain.size() - 1])
	return -1.0 if (last.begins_with("spine") or last.begins_with("neck")) else 1.0


func _chain_weights(chain: Array, blend: float, pts: PackedVector2Array) -> Array:
	## Returns one PackedFloat32Array per chain bone (weights per vertex, at most 2 non-zero
	## except where blend bands of adjacent joints overlap, never more than 3).
	var axis := _joint_axis(chain)
	var joints: Array[float] = []
	for b in chain:
		joints.append(_setup_xform(bones[b]).origin.y * axis)
	var columns: Array = []
	for i in chain.size():
		columns.append([])
	for v in pts:
		var s := v.y * axis
		var cover: Array[float] = []
		for i in chain.size():
			var h_in := 1.0 if i == 0 else smoothstep(joints[i] - blend * 0.5, joints[i] + blend * 0.5, s)
			var h_out := 0.0 if i == chain.size() - 1 else smoothstep(joints[i + 1] - blend * 0.5, joints[i + 1] + blend * 0.5, s)
			cover.append(maxf(h_in - h_out, 0.0))
		var total := 0.0
		for c in cover:
			total += c
		for i in chain.size():
			columns[i].append(cover[i] / total if total > 0.0 else (1.0 if i == 0 else 0.0))
	var out: Array = []
	for col in columns:
		out.append(PackedFloat32Array(col))
	return out


func _add_skinned(p: Dictionary) -> Polygon2D:
	var outline := _vec_array(p["polygon"])
	var pts := _mesh_points(outline)
	var tri_flat := Geometry2D.triangulate_delaunay(pts)
	var polys: Array = []
	for i in range(0, tri_flat.size(), 3):
		var a := pts[tri_flat[i]]
		var b := pts[tri_flat[i + 1]]
		var c := pts[tri_flat[i + 2]]
		if Geometry2D.is_point_in_polygon((a + b + c) / 3.0, outline):
			polys.append(PackedInt32Array([tri_flat[i], tri_flat[i + 1], tri_flat[i + 2]]))
	var poly := Polygon2D.new()
	poly.name = p["name"]
	_skin_root.add_child(poly)
	poly.polygon = pts
	poly.polygons = polys
	poly.texture = _texture(p)
	var uv := PackedVector2Array()
	for v in pts:
		uv.append(v - _part_origin(p))
	poly.uv = uv
	poly.z_index = int(p["z"])
	poly.skeleton = poly.get_path_to(_skeleton_node())
	var chain: Array = p["chain"]
	var weights := _chain_weights(chain, float(p["blend"]), pts)
	for i in chain.size():
		poly.add_bone(_skeleton_node().get_path_to(bones[chain[i]]), weights[i])
	_skinned_polys.append(poly)
	return poly


# --------------------------------------------------------- Scalable Vector Shapes

func _add_svs(p: Dictionary, rigid_bone: Bone2D) -> ScalableVectorShape2D:
	var anchors := _vec_array(p["anchors"])
	var handles := _vec_array(p["handles"])
	var basis_inv := Transform2D.IDENTITY
	var parent: Node = _skin_root
	if rigid_bone != null:
		basis_inv = _setup_xform(rigid_bone).affine_inverse()
		parent = rigid_bone
	var s := ScalableVectorShape2D.new()
	s.name = p["name"]
	s.update_curve_at_runtime = true
	s.polygon = Polygon2D.new()
	s.line = Line2D.new()
	parent.add_child(s)
	s.add_child(s.polygon)
	s.add_child(s.line)
	s.fill_color = Color8(p["fill"][0], p["fill"][1], p["fill"][2])
	s.stroke_color = Color8(p["outline"][0], p["outline"][1], p["outline"][2])
	s.stroke_width = p["outline_w"]
	s.line.joint_mode = Line2D.LINE_JOINT_ROUND
	var curve := Curve2D.new()
	for i in anchors.size():
		var h := basis_inv.basis_xform(handles[i])
		curve.add_point(basis_inv * anchors[i], -h, h)
	var h0 := basis_inv.basis_xform(handles[0])
	curve.add_point(basis_inv * anchors[0], -h0, h0)   # first == last closes the shape
	s.curve = curve
	if rigid_bone == null:
		var chain: Array = p["chain"]
		var axis := _joint_axis(chain)
		var joint_s: Array[float] = []
		for b in chain:
			joint_s.append(_setup_xform(bones[b]).origin.y * axis)
		var map: Dictionary[int, Bone2D] = {}
		for i in curve.point_count:
			var pos: Vector2 = anchors[i % anchors.size()]
			var pick := 0
			for j in range(1, chain.size()):
				if pos.y * axis >= joint_s[j]:
					pick = j
			map[i] = bones[chain[pick]]
		s.skeleton = _skeleton_node()
		s.deformation_map = map
	s.z_index = int(p["z"])
	_svs_shapes.append(s)
	return s


# ------------------------------------------------------------- hands, bag, palm

func _build_hand(p: Dictionary) -> void:
	var pname: String = p["name"]
	var side := "near" if pname.ends_with("_near") else "far"
	var bone: Bone2D = bones["hand_" + side]
	if pname.begins_with("hand_relaxed"):
		if variant == Variant.SVS:
			_add_svs(p, bone)
		elif variant == Variant.HYBRID and side == "near":
			_build_hand_sprite(bone)
		else:
			_add_rigid(p, bone)
	# grip/open drawings only exist for the hybrid's SpriteFrames; SKINNED/SVS keep one hand.


func _build_hand_sprite(bone: Bone2D) -> void:
	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	var reference: Dictionary = _shapes["hand_relaxed_near"]
	for state in ["relaxed", "grip", "open"]:
		frames.add_animation(state)
		frames.set_animation_loop(state, false)
		frames.add_frame(state, _texture(_shapes["hand_%s_near" % state]))
	_hand_sprite = AnimatedSprite2D.new()
	_hand_sprite.name = "HandFrames"
	_hand_sprite.sprite_frames = frames
	_hand_sprite.centered = false
	_hand_sprite.transform = _setup_xform(bone).affine_inverse() * Transform2D(0.0, _part_origin(reference))
	bone.add_child(_hand_sprite)
	_hand_sprite.z_as_relative = false
	_hand_sprite.z_index = int(reference["z"])
	_hand_sprite.animation = "relaxed"


func _build_bag(p: Dictionary) -> void:
	_bag = Node2D.new()
	_bag.name = "Bag"
	add_child(_bag)
	var poly := Polygon2D.new()
	var pts := _vec_array(p["polygon"])
	poly.polygon = pts
	poly.texture = _texture(p)
	var uv := PackedVector2Array()
	for v in pts:
		uv.append(v - _part_origin(p))
	poly.uv = uv
	_bag.add_child(poly)
	_bag.z_index = int(p["z"])


# ----------------------------------------------------------------------- clock

func release_palm_local() -> Vector2:
	if not _have_release:
		apply_pose(ThrowMotion.pose_at(ThrowMotion.release_time()))
		_release_local = to_local(bag_socket.global_position)
		_have_release = true
	return _release_local


## Poses the whole rig for time t (seconds). Pure function of t.
func set_time(t: float) -> void:
	var start := release_palm_local()
	apply_pose(ThrowMotion.pose_at(t))
	hand_state = ThrowMotion.hand_state_at(t)
	if _hand_sprite != null:
		_hand_sprite.animation = hand_state
	if t < ThrowMotion.release_time():
		_bag.position = to_local(bag_socket.global_position)
	else:
		_bag.position = ThrowMotion.bag_flight(t, start, bag_target)
	for s in _svs_shapes:
		s._update_curve()
