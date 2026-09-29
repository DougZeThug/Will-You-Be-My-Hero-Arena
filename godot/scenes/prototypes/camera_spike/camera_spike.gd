class_name CameraSpike
extends Node2D
## The same four-shot beat (wide, push-in on the windup, bag follow after release, board settle)
## driven two ways: a plain Camera2D whose state is a pure function of time, and Phantom Camera
## in MANUAL interpolation mode. Presentation only.
##
## The clock is a fixed step (1/60 s by default). Phantom Camera integrates tweens by adding
## frame deltas, so its camera depends on the history of steps, not just on t; seek() therefore
## rebuilds it and replays from zero. Measured: its host only activates one engine frame after
## its cameras enter the tree, so that seek is a coroutine. The plain camera has no history, so
## its seek() is an assignment and returns at once.

enum Mode { PLAIN, PHANTOM }

const STEP := 1.0 / 60.0
const LOOP_SECONDS := 5.0
const BOARD_X := 780.0
const BAG_LANDING := Vector2(BOARD_X, -135.0)
## `blend` is the seconds spent moving into the shot from the previous one (sine in-out).
const SHOTS := [
	{"name": "wide", "start": 0.0, "center": Vector2(390.0, -330.0), "zoom": 0.52, "blend": 0.0},
	{"name": "push_in", "start": 1.2, "center": Vector2(70.0, -430.0), "zoom": 0.95, "blend": 0.6},
	{"name": "bag_follow", "start": 2.26, "follow_bag": true, "offset": Vector2(60.0, -40.0), "zoom": 0.7, "blend": 0.25},
	{"name": "board", "start": 3.16, "center": Vector2(BOARD_X - 30.0, -170.0), "zoom": 1.05, "blend": 0.5},
]

@export var mode: Mode = Mode.PLAIN
## Set to freeze on one moment (seconds). Negative means play the loop.
@export var hold_time := -1.0
## Simulation step. 1/60 for capture and play; tests vary it to expose history dependence.
var step_seconds := STEP

var rig: DougRig
var camera: Camera2D
var host: PhantomCameraHost
var pcams: Array[PhantomCamera2D] = []
var clock := 0.0
## False while a Phantom camera is being rebuilt (it cannot be stepped until a frame has passed).
var live := false
var _sim_t := -STEP
var _label := Label.new()
var _camera_root: Node2D


func _ready() -> void:
	rig = DougRig.new(DougRig.Variant.SKINNED)
	rig.bag_target = BAG_LANDING
	add_child(rig)
	var hud := CanvasLayer.new()
	hud.layer = 10
	add_child(hud)
	_label.position = Vector2(16.0, 8.0)
	_label.add_theme_font_size_override("font_size", 24)
	_label.add_theme_color_override("font_color", Color(0.1, 0.08, 0.1))
	hud.add_child(_label)
	await _reset()
	if hold_time >= 0.0:
		await seek(hold_time)


func _process(_delta: float) -> void:
	if not live or hold_time >= 0.0:
		return
	clock += step_seconds
	var t := fmod(clock, LOOP_SECONDS)
	if t < _sim_t - 1e-9:
		seek(t)          # the loop wrapped: reassign (plain) or rebuild and replay (Phantom)
	else:
		advance_to(t)


# ------------------------------------------------------------------ sequencing

func shot_index(t: float) -> int:
	var idx := 0
	for i in SHOTS.size():
		if t >= float(SHOTS[i]["start"]):
			idx = i
	return idx


func _shot_state(i: int) -> Dictionary:
	var s: Dictionary = SHOTS[i]
	if s.get("follow_bag", false):
		return {"pos": rig._bag.global_position + s["offset"], "zoom": s["zoom"]}
	return {"pos": s["center"], "zoom": s["zoom"]}


func _plain_state(t: float) -> Dictionary:
	var i := shot_index(t)
	var cur := _shot_state(i)
	var blend: float = SHOTS[i]["blend"]
	if i == 0 or blend <= 0.0:
		return cur
	var u := clampf((t - float(SHOTS[i]["start"])) / blend, 0.0, 1.0)
	var e := 0.5 - 0.5 * cos(PI * u)
	var prev := _shot_state(i - 1)
	return {"pos": (prev["pos"] as Vector2).lerp(cur["pos"], e), "zoom": lerpf(prev["zoom"], cur["zoom"], e)}


func _build_camera() -> void:
	camera = Camera2D.new()
	_camera_root.add_child(camera)
	if mode == Mode.PLAIN:
		return
	host = PhantomCameraHost.new()
	camera.add_child(host)
	host.interpolation_mode = PhantomCameraHost.InterpolationMode.MANUAL
	for s: Dictionary in SHOTS:
		var pcam := PhantomCamera2D.new()
		pcam.name = "Pcam_" + String(s["name"])
		pcam.priority = 0
		pcam.zoom = Vector2(s["zoom"], s["zoom"])
		pcam.tween_on_load = false
		var tween := PhantomCameraTween.new()
		tween.duration = maxf(float(s["blend"]), 0.0)
		tween.transition = PhantomCameraTween.TransitionType.SINE
		tween.ease = PhantomCameraTween.EaseType.EASE_IN_OUT
		pcam.tween_resource = tween
		_camera_root.add_child(pcam)
		if s.get("follow_bag", false):
			pcam.follow_mode = PhantomCamera2D.FollowMode.SIMPLE
			pcam.follow_target = rig._bag
			pcam.follow_offset = s["offset"]
		else:
			pcam.global_position = s["center"]
		pcams.append(pcam)
	pcams[0].priority = 10


func _step(t: float) -> void:
	rig.set_time(t)
	if mode == Mode.PLAIN:
		var st := _plain_state(t)
		camera.global_position = st["pos"]
		camera.zoom = Vector2(st["zoom"], st["zoom"])
	else:
		var active := shot_index(t)
		for i in pcams.size():
			pcams[i].priority = 10 if i == active else 0
		host.process(step_seconds)
	_label.text = "%s  t=%.2f  shot=%s" % ["PLAIN Camera2D" if mode == Mode.PLAIN else "PHANTOM CAMERA", t, SHOTS[shot_index(t)]["name"]]


## Steps forward at the fixed rate until the simulated time reaches t.
func advance_to(t: float) -> void:
	while _sim_t < t - 1e-9:
		_sim_t += step_seconds
		_step(_sim_t)


## Jump to t. Plain: pure assignment. Phantom: rebuild the camera, wait one frame for its host to
## register the cameras, and replay from zero at the fixed step.
func seek(t: float) -> void:
	if mode == Mode.PLAIN:
		_sim_t = t - step_seconds
		advance_to(t)
		return
	if t < _sim_t - 1e-9 or not live:
		await _reset()
	advance_to(t)


func _reset() -> void:
	live = false
	if is_instance_valid(_camera_root):
		_camera_root.queue_free()
	_camera_root = Node2D.new()
	add_child(_camera_root)
	pcams.clear()
	_build_camera()
	if mode == Mode.PHANTOM:
		await get_tree().process_frame
	_sim_t = -step_seconds
	_step(0.0)
	_sim_t = 0.0
	live = true


func camera_position() -> Vector2:
	return camera.global_position


func camera_zoom() -> float:
	return camera.zoom.x


func _draw() -> void:
	draw_rect(Rect2(-3000, -2400, 7000, 2400), Color(0.99, 0.90, 0.72))
	draw_rect(Rect2(-3000, 0, 7000, 900), Color(0.80, 0.62, 0.42))
	draw_line(Vector2(-3000, 0), Vector2(4000, 0), Color(0.25, 0.2, 0.2), 4.0)
	# cornhole board: low front edge, raised back edge, hole toward the back
	var bx := BOARD_X
	draw_colored_polygon(PackedVector2Array([Vector2(bx - 90, -30), Vector2(bx + 90, -30), Vector2(bx + 70, -150), Vector2(bx - 70, -150)]), Color(0.30, 0.55, 0.72))
	draw_polyline(PackedVector2Array([Vector2(bx - 90, -30), Vector2(bx + 90, -30), Vector2(bx + 70, -150), Vector2(bx - 70, -150), Vector2(bx - 90, -30)]), Color(0.16, 0.12, 0.14), 4.0)
	draw_circle(Vector2(bx, -118), 14.0, Color(0.16, 0.12, 0.14))
	draw_line(Vector2(bx - 60, -30), Vector2(bx - 70, 0), Color(0.16, 0.12, 0.14), 6.0)
	draw_line(Vector2(bx + 60, -30), Vector2(bx + 70, 0), Color(0.16, 0.12, 0.14), 6.0)
