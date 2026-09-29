extends Node2D
## Rendered probe (needs Xvfb + software GL): per-vertex skin influence limit, and
## alpha-edge quality of mipmapped sprites at court scale. Prints one line per result.
##   tools/probe.sh   (runs this under Xvfb)


func _grab() -> Image:
	await RenderingServer.frame_post_draw
	return get_viewport().get_texture().get_image()


func _red_centroid_x(img: Image) -> float:
	var sx := 0.0
	var n := 0
	for y in range(img.get_height()):
		for x in range(img.get_width()):
			var c := img.get_pixel(x, y)
			if c.r > 0.8 and c.g < 0.3 and c.b < 0.3:
				sx += x
				n += 1
	return sx / n if n > 0 else -1.0


## A triangle whose 3 vertices share `weights` over N co-located bones; bone `moved`
## is translated by dx. Returns the rendered x-centroid of the triangle.
func _skin_centroid(weights: Array, moved: int, dx: float) -> float:
	var sk := Skeleton2D.new()
	add_child(sk)
	var bones: Array[Bone2D] = []
	for i in weights.size():
		var b := Bone2D.new()
		b.name = "b%d" % i
		sk.add_child(b)
		b.rest = Transform2D.IDENTITY
		b.set_autocalculate_length_and_angle(false)
		bones.append(b)
	var poly := Polygon2D.new()
	poly.polygon = PackedVector2Array([Vector2(280, 280), Vector2(320, 280), Vector2(300, 320)])
	poly.color = Color(1, 0, 0)
	add_child(poly)
	poly.skeleton = poly.get_path_to(sk)
	for i in weights.size():
		poly.add_bone(sk.get_path_to(bones[i]), PackedFloat32Array([weights[i], weights[i], weights[i]]))
	bones[moved].position = Vector2(dx, 0)
	var img: Image = await _grab()
	var cx := _red_centroid_x(img)
	sk.queue_free()
	poly.queue_free()
	return cx


func _alpha_edge(mode: String) -> void:
	var im := Image.create(256, 256, false, Image.FORMAT_RGBA8)
	for y in 256:
		for x in 256:
			var d := Vector2(x - 127.5, y - 127.5).length()
			var a: float = clampf((100.0 - d) / 3.0 + 0.5, 0.0, 1.0) if mode.begins_with("soft") else (1.0 if d < 100.0 else 0.0)
			im.set_pixel(x, y, Color(0.9, 0.7, 0.2, a) if a > 0.0 else Color(0, 0, 0, 0))
	if mode.ends_with("fix_alpha_edges"):
		im.fix_alpha_edges()
	im.generate_mipmaps()
	var bg := ColorRect.new()
	bg.color = Color(0.95, 0.85, 0.6)
	bg.size = Vector2(640, 360)
	add_child(bg)
	var sp := Sprite2D.new()
	sp.texture = ImageTexture.create_from_image(im)
	sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sp.scale = Vector2(0.25, 0.25)
	sp.position = Vector2(320, 180)
	add_child(sp)
	var out: Image = await _grab()
	var lum_in := 0.0
	var n_in := 0
	var darkest := 1.0
	for y in range(140, 221):
		for x in range(280, 361):
			var d2 := Vector2(x - 319.5, y - 179.5).length()
			var c := out.get_pixel(x, y)
			var lum := 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
			if d2 < 15.0:
				lum_in += lum
				n_in += 1
			elif d2 > 20.0 and d2 < 28.0:
				darkest = minf(darkest, lum)
	var bg_lum := 0.299 * 0.95 + 0.587 * 0.85 + 0.114 * 0.6
	print("ALPHA[%s] edge darker than both interior and background by %.3f" % [mode, maxf(0.0, minf(lum_in / n_in, bg_lum) - darkest)])
	sp.queue_free()
	bg.queue_free()


func _ready() -> void:
	await get_tree().process_frame
	var base: float = await _skin_centroid([0.3, 0.25, 0.2, 0.15, 0.1], 4, 0.0)
	var five_low_last: float = await _skin_centroid([0.3, 0.25, 0.2, 0.15, 0.1], 4, 100.0)
	var five_low_first: float = await _skin_centroid([0.1, 0.3, 0.25, 0.2, 0.15], 0, 100.0)
	var four: float = await _skin_centroid([0.4, 0.3, 0.2, 0.1, 0.0], 3, 100.0)
	print("SKIN 5 influences, moved bone is lowest weight and last : shift=%.3f px (full LBS would be 10.0)" % (five_low_last - base))
	print("SKIN 5 influences, moved bone is lowest weight and first: shift=%.3f px (0.0 means lowest weight dropped, not first-4-by-index)" % (five_low_first - base))
	print("SKIN 4 influences, moved bone weight 0.1                : shift=%.3f px (10.0 = honoured)" % (four - base))
	for mode in ["soft_black_rgb", "soft_fix_alpha_edges", "hard1bit_black_rgb", "hard1bit_fix_alpha_edges"]:
		await _alpha_edge(mode)
	get_tree().quit()
