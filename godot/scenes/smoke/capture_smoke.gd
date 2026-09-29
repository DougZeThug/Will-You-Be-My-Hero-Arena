extends Node2D
## Toolchain smoke scene: a ball on a sine path over a ground line. Its only job is
## to prove that capture.sh renders distinct, non-blank frames in this environment.

var t := 0.0


func _process(delta: float) -> void:
	t += delta
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color(0.95, 0.85, 0.6))
	draw_circle(Vector2(200 + 800 * fmod(t, 2.0) / 2.0, 360 + 100 * sin(t * 6.0)), 60, Color(0.1, 0.5, 0.6))
	draw_rect(Rect2(100, 600, 1080, 8), Color(0.2, 0.2, 0.2))
