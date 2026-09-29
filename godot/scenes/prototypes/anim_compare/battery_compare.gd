extends Node2D
## The three Doug variants through the 18-pose rig battery (art/pose_battery.json), one pose per
## 30 frames, on a flat key-colour background so silhouettes can be measured from the renders.
## The throw reference barely bends the elbow (about 4 degrees), so this is what actually
## exercises shoulder, elbow, knee and waist deformation. Presentation only.

const HOLD_FRAMES := 30
const KEY := Color(1.0, 0.0, 1.0)
const COLUMNS := [
	{"variant": DougRig.Variant.SKINNED, "x": -760.0},
	{"variant": DougRig.Variant.SVS, "x": 0.0},
	{"variant": DougRig.Variant.HYBRID, "x": 760.0},
]

var poses: Array = []
var rigs: Array[DougRig] = []
var frame := 0
var _label := Label.new()


func _ready() -> void:
	poses = (JSON.parse_string(FileAccess.get_file_as_string("res://art/pose_battery.json")) as Dictionary)["poses"]
	var vp := Vector2(get_viewport().size)
	var zoom := vp.x / 2300.0            # three native-scale columns (+ arm reach) across the frame
	var ground_y := vp.y * 0.90
	var camera := Camera2D.new()
	camera.zoom = Vector2(zoom, zoom)
	camera.position = Vector2(0.0, -(ground_y - vp.y * 0.5) / zoom)
	add_child(camera)
	var layer := CanvasLayer.new()
	layer.layer = -1
	add_child(layer)
	var bg := ColorRect.new()
	bg.color = KEY
	bg.size = vp
	layer.add_child(bg)
	var hud := CanvasLayer.new()
	hud.layer = 10
	add_child(hud)
	_label.position = Vector2(16.0, 8.0)
	_label.add_theme_color_override("font_color", Color.BLACK)
	_label.add_theme_font_size_override("font_size", 24)
	hud.add_child(_label)
	for c in COLUMNS:
		var rig := DougRig.new(c["variant"])
		rig.position = Vector2(c["x"], 0.0)
		add_child(rig)
		rig._bag.visible = false      # the bag is a throw prop; it would only pollute silhouettes here
		rigs.append(rig)
	_apply()


func _process(_delta: float) -> void:
	frame += 1
	_apply()


func _apply() -> void:
	var pose: Dictionary = poses[(frame / HOLD_FRAMES) % poses.size()]
	for r in rigs:
		r.apply_pose(pose)
		for s in r._svs_shapes:
			s._update_curve()
	_label.text = "%d  %s" % [(frame / HOLD_FRAMES) % poses.size(), pose["name"]]
