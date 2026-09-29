extends Node2D
## Side-by-side prototype: the same Doug throw (ThrowMotion) on three rig variants.
## The clock is a fixed 1/60 s counter (never wall time), so a capture is reproducible and
## seeking is just assigning `clock`. Presentation only; nothing here scores or simulates.
##
## Rigs stay at native scale (TestPuppet's leg IK measures global distances in native
## units, so an ancestor scale would bend the knees); a Camera2D zoom fits them on screen.

const LOOP_SECONDS := 5.0
const COLUMNS := [
	{"variant": DougRig.Variant.SKINNED, "x": -680.0, "label": "A  Skeleton2D + skinned mesh"},
	{"variant": DougRig.Variant.SVS, "x": 0.0, "label": "B  Skeleton2D + Scalable Vector Shapes"},
	{"variant": DougRig.Variant.HYBRID, "x": 680.0, "label": "C  A + SpriteFrames hands"},
]
const ZOOM := 0.54
const GROUND_SCREEN_Y := 660.0

## Set to freeze on one moment (seconds). Negative means play the loop.
@export var hold_time := -1.0

var clock := 0.0
var rigs: Array[DougRig] = []
var t := 0.0
var _label := Label.new()
var _backdrop := Node2D.new()


func _ready() -> void:
	var camera := Camera2D.new()
	camera.zoom = Vector2(ZOOM, ZOOM)
	camera.position = Vector2(0.0, -(GROUND_SCREEN_Y - 360.0) / ZOOM)
	add_child(camera)
	var layer := CanvasLayer.new()
	layer.layer = -1
	add_child(layer)
	_backdrop.draw.connect(_draw_backdrop)
	layer.add_child(_backdrop)
	var hud := CanvasLayer.new()
	hud.layer = 10
	add_child(hud)
	for c in COLUMNS:
		var rig := DougRig.new(c["variant"])
		rig.position = Vector2(c["x"], 0.0)
		add_child(rig)
		rigs.append(rig)
		var title := Label.new()
		title.text = c["label"]
		title.position = Vector2(640.0 + c["x"] * ZOOM - 190.0, 14.0)
		title.add_theme_color_override("font_color", Color(0.15, 0.12, 0.14))
		title.add_theme_font_size_override("font_size", 20)
		hud.add_child(title)
	_label.position = Vector2(20.0, 690.0)
	_label.add_theme_color_override("font_color", Color(0.15, 0.12, 0.14))
	hud.add_child(_label)
	_apply()


func _process(_delta: float) -> void:
	clock += 1.0 / 60.0
	_apply()


func _apply() -> void:
	t = hold_time if hold_time >= 0.0 else fmod(clock, LOOP_SECONDS)
	for r in rigs:
		r.set_time(t)
	var release := ThrowMotion.release_time()
	var tag := "  RELEASE" if absf(t - release) < 0.05 else ""
	_label.text = "t=%.2fs  frame %.1f  hand=%s%s" % [t, ThrowMotion.time_to_frame(t), rigs[2].hand_state, tag]


func _draw_backdrop() -> void:
	_backdrop.draw_rect(Rect2(0, 0, 1280, 720), Color(0.99, 0.90, 0.72))
	_backdrop.draw_rect(Rect2(0, GROUND_SCREEN_Y, 1280, 60), Color(0.80, 0.62, 0.42))
	for c in COLUMNS:
		var x: float = 640.0 + c["x"] * ZOOM
		_backdrop.draw_line(Vector2(x - 180.0, GROUND_SCREEN_Y), Vector2(x + 180.0, GROUND_SCREEN_Y), Color(0.25, 0.2, 0.2), 3.0)
