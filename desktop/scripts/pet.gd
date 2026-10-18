class_name DesktopPet
extends Node2D

signal action_finished(action_name: String)

enum State {
	IDLE,
	EAT_BURGER,
	DRINK_COKE,
	CELEBRATE,
	SLEEP,
	WAVE
}

var current_state: State = State.IDLE
var anim_time: float = 0.0
var action_timer: float = 0.0
var action_duration: float = 0.0
var is_blinking: bool = false
var blink_timer: float = 2.0

# Procedural animation offsets
var body_offset_y: float = 0.0
var ear_angle: float = 0.0
var arm_angle: float = 0.0
var mouth_open: float = 0.0

@onready var sprite: Sprite2D = get_node_or_null("Sprite2D")

func _ready() -> void:
	play_idle()

func _process(delta: float) -> void:
	anim_time += delta

	# Periodic blink in idle state
	blink_timer -= delta
	if blink_timer <= 0.0:
		is_blinking = true
		if blink_timer <= -0.15:
			is_blinking = false
			blink_timer = randf_range(2.5, 5.0)

	# Action timeout handling
	if current_state != State.IDLE:
		action_timer += delta
		if action_timer >= action_duration:
			var finished_action = get_current_action_name()
			play_idle()
			action_finished.emit(finished_action)

	_update_procedural_animations(delta)
	queue_redraw()

func _update_procedural_animations(_delta: float) -> void:
	match current_state:
		State.IDLE:
			# Gentle breathing / floating bob
			body_offset_y = sin(anim_time * 3.0) * 4.0
			ear_angle = sin(anim_time * 2.0) * 0.08
			arm_angle = sin(anim_time * 1.5) * 0.05
			mouth_open = 0.0

		State.EAT_BURGER:
			# Chewing bounce
			body_offset_y = sin(anim_time * 8.0) * 3.0
			mouth_open = (sin(anim_time * 10.0) + 1.0) * 0.5
			ear_angle = sin(anim_time * 6.0) * 0.12
			arm_angle = 0.4 + sin(anim_time * 8.0) * 0.1

		State.DRINK_COKE:
			# Gentle sipping tilt
			body_offset_y = sin(anim_time * 4.0) * 2.0
			mouth_open = 0.2
			ear_angle = -0.1
			arm_angle = 0.5 + sin(anim_time * 5.0) * 0.05

		State.CELEBRATE:
			# Excited jumping and cheering
			body_offset_y = -abs(sin(anim_time * 8.0)) * 18.0
			ear_angle = sin(anim_time * 12.0) * 0.25
			arm_angle = -0.8 + sin(anim_time * 12.0) * 0.3
			mouth_open = 0.8

		State.SLEEP:
			# Slow sleepy breathing
			body_offset_y = sin(anim_time * 1.2) * 2.0
			ear_angle = 0.15
			arm_angle = 0.1
			mouth_open = 0.0

		State.WAVE:
			# Friendly greeting wave
			body_offset_y = sin(anim_time * 3.0) * 3.0
			ear_angle = sin(anim_time * 4.0) * 0.1
			arm_angle = -0.6 + sin(anim_time * 10.0) * 0.4
			mouth_open = 0.3

func play_action_by_name(action_name: String, duration: float = 3.0) -> void:
	action_duration = duration
	action_timer = 0.0
	match action_name:
		"eat_burger":
			current_state = State.EAT_BURGER
		"drink_coke":
			current_state = State.DRINK_COKE
		"celebrate":
			current_state = State.CELEBRATE
		"sleep":
			current_state = State.SLEEP
		"wave":
			current_state = State.WAVE
		_:
			play_idle()

func play_idle() -> void:
	current_state = State.IDLE
	action_duration = 0.0
	action_timer = 0.0

func get_current_action_name() -> String:
	match current_state:
		State.EAT_BURGER: return "eat_burger"
		State.DRINK_COKE: return "drink_coke"
		State.CELEBRATE: return "celebrate"
		State.SLEEP: return "sleep"
		State.WAVE: return "wave"
		_: return "idle"

func _draw() -> void:
	# Beautiful stylized procedural McDonald's pet mascot
	var center = Vector2(160, 185 + body_offset_y)

	# Colors
	var col_mcd_yellow = Color("#FFBC0D") # Golden Arches yellow
	var col_mcd_red = Color("#DA291C")    # McDonald's red
	var col_body = Color("#FFE57F")       # Soft warm creamy golden
	var col_belly = Color("#FFF8E1")      # Creamy white belly
	var col_dark = Color("#2C2A29")       # Soft dark eyes
	var col_blush = Color(1.0, 0.5, 0.5, 0.45)

	# 1. Shadow underneath
	var shadow_y = 265.0
	var shadow_scale = max(0.5, 1.0 - abs(body_offset_y) / 40.0)
	draw_circle(Vector2(160, shadow_y), 38.0 * shadow_scale, Color(0, 0, 0, 0.15))

	# 2. Left and Right Ears (with McDonald's Golden Arches accent)
	var left_ear_pos = center + Vector2(-36, -55)
	var right_ear_pos = center + Vector2(36, -55)
	draw_circle(left_ear_pos, 16.0, col_body)
	draw_circle(right_ear_pos, 16.0, col_body)
	draw_circle(left_ear_pos, 9.0, col_mcd_yellow)
	draw_circle(right_ear_pos, 9.0, col_mcd_yellow)

	# 3. Main Chubby Body / Face
	draw_circle(center, 54.0, col_body)
	# Soft belly
	draw_circle(center + Vector2(0, 16), 34.0, col_belly)

	# 4. McDonald's Red Cap / Headband with "M"
	var cap_center = center + Vector2(0, -42)
	draw_circle(cap_center, 22.0, col_mcd_red)
	# Golden "M"
	draw_arc(cap_center + Vector2(-5, 2), 6.0, -PI, 0, 16, col_mcd_yellow, 3.0, true)
	draw_arc(cap_center + Vector2(5, 2), 6.0, -PI, 0, 16, col_mcd_yellow, 3.0, true)

	# 5. Cheeks (Blush)
	draw_circle(center + Vector2(-32, 6), 9.0, col_blush)
	draw_circle(center + Vector2(32, 6), 9.0, col_blush)

	# 6. Eyes
	var left_eye = center + Vector2(-20, -6)
	var right_eye = center + Vector2(20, -6)

	if current_state == State.SLEEP:
		# Sleepy closed eyes (arcs)
		draw_arc(left_eye, 7.0, 0.1, PI - 0.1, 16, col_dark, 2.5, true)
		draw_arc(right_eye, 7.0, 0.1, PI - 0.1, 16, col_dark, 2.5, true)
		# Floating "Zzz"
		var z_offset = fmod(anim_time * 16.0, 36.0)
		var z1 = center + Vector2(36, -30 - z_offset)
		var z_col = Color(0.3, 0.4, 0.85, max(0.0, 1.0 - z_offset / 36.0))
		draw_line(z1, z1 + Vector2(7, 0), z_col, 1.8)
		draw_line(z1 + Vector2(7, 0), z1 + Vector2(0, 8), z_col, 1.8)
		draw_line(z1 + Vector2(0, 8), z1 + Vector2(7, 8), z_col, 1.8)
	elif current_state == State.CELEBRATE or mouth_open > 0.6:
		# Happy crescent eyes
		draw_arc(left_eye, 7.0, -PI + 0.3, -0.3, 16, col_dark, 3.0, true)
		draw_arc(right_eye, 7.0, -PI + 0.3, -0.3, 16, col_dark, 3.0, true)
	elif is_blinking:
		# Blinking line
		draw_line(left_eye + Vector2(-6, 0), left_eye + Vector2(6, 0), col_dark, 2.5)
		draw_line(right_eye + Vector2(-6, 0), right_eye + Vector2(6, 0), col_dark, 2.5)
	else:
		# Big cute anime eyes with light highlights
		draw_circle(left_eye, 7.0, col_dark)
		draw_circle(right_eye, 7.0, col_dark)
		draw_circle(left_eye + Vector2(-2, -2), 2.5, Color.WHITE)
		draw_circle(right_eye + Vector2(-2, -2), 2.5, Color.WHITE)

	# 7. Nose & Mouth
	var nose_pos = center + Vector2(0, 3)
	draw_circle(nose_pos, 2.5, col_dark)

	var mouth_y = center.y + 12.0
	if mouth_open > 0.2:
		# Open mouth (eating / happy)
		var mouth_rect = Rect2(center.x - 9, mouth_y, 18, 10 * mouth_open)
		draw_rect(mouth_rect, Color("#C2185B"), true, 5.0)
		# Tongue
		draw_circle(Vector2(center.x, mouth_y + 8 * mouth_open), 4.0, Color("#F06292"))
	else:
		# Cat mouth curve (w)
		draw_arc(Vector2(center.x - 4, mouth_y), 4.0, 0.1, PI * 0.9, 12, col_dark, 2.0, true)
		draw_arc(Vector2(center.x + 4, mouth_y), 4.0, 0.1, PI * 0.9, 12, col_dark, 2.0, true)

	# 8. Hands & Props
	_draw_props_and_hands(center, col_body, col_mcd_red, col_mcd_yellow)

func _draw_props_and_hands(center: Vector2, col_body: Color, col_red: Color, col_yellow: Color) -> void:
	match current_state:
		State.EAT_BURGER:
			# Burger in hands
			var burger_pos = center + Vector2(0, 30)
			# Bottom bun
			draw_rect(Rect2(burger_pos.x - 18, burger_pos.y + 6, 36, 6), Color("#D7A15C"), true, 2.0)
			# Patty
			draw_rect(Rect2(burger_pos.x - 17, burger_pos.y + 2, 34, 4), Color("#5D4037"), true)
			# Cheese & Lettuce
			draw_rect(Rect2(burger_pos.x - 19, burger_pos.y, 38, 3), col_yellow, true)
			draw_rect(Rect2(burger_pos.x - 18, burger_pos.y - 2, 36, 2), Color("#4CAF50"), true)
			# Top bun
			draw_arc(burger_pos + Vector2(0, -2), 18.0, -PI, 0, 16, Color("#D7A15C"), 10.0, true)
			# Paws holding burger
			draw_circle(burger_pos + Vector2(-18, 2), 7.0, col_body)
			draw_circle(burger_pos + Vector2(18, 2), 7.0, col_body)

		State.DRINK_COKE:
			# McDonald's Red Cup with straw
			var cup_pos = center + Vector2(18, 24)
			# Straw
			draw_line(cup_pos + Vector2(0, -18), cup_pos + Vector2(10, -32), Color("#FFEB3B"), 3.0)
			# Cup body
			var points = PackedVector2Array([
				cup_pos + Vector2(-12, -18),
				cup_pos + Vector2(12, -18),
				cup_pos + Vector2(9, 14),
				cup_pos + Vector2(-9, 14),
			])
			draw_colored_polygon(points, col_red)
			# Golden Arches on cup
			draw_arc(cup_pos + Vector2(-3, 0), 4.0, -PI, 0, 12, col_yellow, 2.0, true)
			draw_arc(cup_pos + Vector2(3, 0), 4.0, -PI, 0, 12, col_yellow, 2.0, true)
			# Paws
			draw_circle(cup_pos + Vector2(-12, 0), 7.0, col_body)
			draw_circle(center + Vector2(-28, 26), 7.0, col_body)

		State.CELEBRATE:
			# Confetti / sparkle stars
			for i in 4:
				var star_angle = anim_time * 4.0 + i * PI / 2.0
				var star_pos = center + Vector2(cos(star_angle), sin(star_angle)) * 65.0
				draw_circle(star_pos, 4.0, col_yellow if i % 2 == 0 else col_red)
			# Paws in air
			draw_circle(center + Vector2(-36, -18), 7.0, col_body)
			draw_circle(center + Vector2(36, -18), 7.0, col_body)

		State.WAVE:
			# Left hand waving high
			var waving_hand = center + Vector2(-42, -16 + sin(anim_time * 10.0) * 8.0)
			draw_circle(waving_hand, 7.5, col_body)
			# Right hand resting
			draw_circle(center + Vector2(34, 28), 7.0, col_body)

		_:
			# Cute default resting paws
			draw_circle(center + Vector2(-28, 28), 7.0, col_body)
			draw_circle(center + Vector2(28, 28), 7.0, col_body)
