class_name ThrowMotion
extends RefCounted
## Authored adaptation of the compiled cornhole throw reference (derived copy in
## assets/doug/throw_reference.json). Everything here is a PURE FUNCTION OF TIME: no
## state, no random numbers, no physics. It is not measured motion; the far arm and the
## hand states are authored, and the bag flight is a presentation placeholder (the
## authoritative landing comes from the TypeScript recording, not from here).
##
## Angles: degrees, Godot convention (positive = clockwise on screen, character faces +x),
## so a positive arm angle swings the hanging arm BACK and a positive trunk pitch leans FORWARD.

const REF_PATH := "res://assets/doug/throw_reference.json"
const PELVIS_FORWARD_PX := 65.0   # legacy authoring scale for the pelvisForward channel
const PELVIS_LOAD_PX := 82.0      # legacy authoring scale for the pelvisLoad channel (squat, +y down)
const STANCE_KNEE_BEND_PX := 8.0  # balanced stance (SPEC): knees never fully locked, so the planted feet are reachable
const FLIGHT_SECONDS := 0.9
const FLIGHT_ARC_PX := 170.0

static var _ref: Dictionary = {}


static func _data() -> Dictionary:
	if _ref.is_empty():
		_ref = JSON.parse_string(FileAccess.get_file_as_string(REF_PATH))
	return _ref


## Editorial time (seconds) -> source frame, piecewise linear over the reference's timeMapping.
static func time_to_frame(t: float) -> float:
	var m: Array = _data()["timeMapping"]
	if t <= m[0][0]:
		return m[0][1]
	for i in range(1, m.size()):
		if t <= m[i][0]:
			var a: Array = m[i - 1]
			var b: Array = m[i]
			return lerpf(a[1], b[1], (t - a[0]) / (b[0] - a[0]))
	return m[m.size() - 1][1]


static func frame_to_time(frame: float) -> float:
	var m: Array = _data()["timeMapping"]
	for i in range(1, m.size()):
		if frame <= m[i][1]:
			var a: Array = m[i - 1]
			var b: Array = m[i]
			return lerpf(a[0], b[0], (frame - a[1]) / (b[1] - a[1]))
	return m[m.size() - 1][0]


static func release_time() -> float:
	return frame_to_time(float(_data()["releaseFrame"]))


static func end_time() -> float:
	return frame_to_time(float(_data()["endFrame"]))


static func sample(channel: String, frame: float) -> float:
	var keys: Array = _data()["channels"][channel]
	if frame <= keys[0][0]:
		return keys[0][1]
	for i in range(1, keys.size()):
		if frame <= keys[i][0]:
			var a: Array = keys[i - 1]
			var b: Array = keys[i]
			return lerpf(a[1], b[1], (frame - a[0]) / (b[0] - a[0]))
	return keys[keys.size() - 1][1]


## Pose dictionary in the format of TestPuppet.apply_pose.
static func pose_at(t: float) -> Dictionary:
	var f := time_to_frame(t)
	var pitch := sample("torsoPitch", f)
	var pelvis_rot := pitch * 0.15
	var lower := pitch * 0.35
	var upper := pitch * 0.50
	var lean := pelvis_rot + lower + upper
	var upper_right := sample("upperRight", f)
	return {
		"name": "throw",
		"pelvis": {
			"tx": sample("pelvisForward", f) * PELVIS_FORWARD_PX,
			"ty": sample("pelvisLoad", f) * PELVIS_LOAD_PX + STANCE_KNEE_BEND_PX,
			"rot": pelvis_rot,
		},
		"spine_lower": lower,
		"spine_upper": upper,
		# Near arm: measured-channel adaptation, made trunk-relative so the arm keeps its swing.
		"arm_near": {"shoulder": upper_right - lean, "elbow": sample("elbowRight", f), "wrist": 0.0},
		# Far arm is hidden in the source: authored counterbalance, not extracted motion.
		"arm_far": {"shoulder": -0.25 * upper_right - 0.5 * lean, "elbow": -8.0, "wrist": 0.0},
		"foot_near": {"dx": 22.0, "lift": 0.0},
		"foot_far": {"dx": -16.0, "lift": 0.0},
	}


## "relaxed" -> "grip" (backswing starts) -> "open" (at release) -> "relaxed". Authored.
static func hand_state_at(t: float) -> String:
	var f := time_to_frame(t)
	var rel := float(_data()["releaseFrame"])
	if f >= 12.0 and f < rel:
		return "grip"
	if f >= rel and f < rel + 15.0:
		return "open"
	return "relaxed"


## Bag position once released: presentation-only arc from the release palm to the target.
static func bag_flight(t: float, start: Vector2, target: Vector2) -> Vector2:
	var u := clampf((t - release_time()) / FLIGHT_SECONDS, 0.0, 1.0)
	var p := start.lerp(target, u)
	p.y -= FLIGHT_ARC_PX * 4.0 * u * (1.0 - u)
	return p


static func landed_time() -> float:
	return release_time() + FLIGHT_SECONDS
