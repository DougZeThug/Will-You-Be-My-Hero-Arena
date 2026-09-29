extends SceneTree
## Headless: lists the skeleton/IK/marker API surface of the pinned Godot.
##   godot --headless --path godot -s probes/introspect.gd


func _init() -> void:
	print("VERSION ", Engine.get_version_info().string)
	var names := []
	for c in ClassDB.get_class_list():
		var s := String(c)
		if s.begins_with("SkeletonModification") or s in ["Skeleton2D", "Bone2D", "Polygon2D", "PhysicalBone2D"]:
			names.append(s)
	names.sort()
	print("CLASSES ", names)
	for cls in ["Polygon2D", "Skeleton2D"]:
		var ms := []
		for m in ClassDB.class_get_method_list(cls, true):
			if not String(m.name).begins_with("_"):
				ms.append(m.name)
		ms.sort()
		print(cls, " METHODS ", ms)
	print("HAS Polygon2D.get_bone_weights=", ClassDB.class_has_method("Polygon2D", "get_bone_weights"),
		" any skinned-vertex getter=", ClassDB.class_has_method("Polygon2D", "get_skinned_polygon"))
	quit()
