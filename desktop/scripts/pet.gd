class_name DesktopPet
extends Node2D

signal action_finished(action_name: String)
signal walk_direction_changed(direction: int)

enum State {
	IDLE,
	TURNING,
	WALK_INTRO,
	WALK_LOOP,
	WALK_OUTRO,
	ACTION
}

var current_state: State = State.IDLE
var facing_direction: int = 1
var is_flipping: bool = false
var base_pos_y: float = 180.0

var walk_speed: float = 75.0
var current_speed: float = 0.0
var walk_timer: float = 0.0
var walk_duration: float = 4.0
var idle_time: float = 0.0
var next_walk_delay: float = 4.0
var auto_walk_enabled: bool = true
var is_stopping_walk: bool = false

var action_name: String = ""
var action_timer: float = 0.0
var action_duration: float = 3.0
var current_breath_y: float = 0.0

const ACTION_SCALE = Vector2(1.025, 1.07)
const ACTION_Y_OFFSET: float = 7.5
const IDLE_RETURN_FRAMES = preload("res://assets/sprites/shubao-idle-return/idle_returns.tres")
var action_tween: Tween
var click_tween: Tween

@export_group("地面阴影设置")
@export var shadow_width: float = 129.0
@export var shadow_height: float = 20.0
@export var shadow_center_y: float = 291.0
@export var shadow_offset_x: float = 1.0
@export_range(0.0, 1.0, 0.01) var shadow_opacity: float = 0.25
@export var shadow_walk_dynamic: bool = true
@export_range(0.0, 3.0, 0.1) var shadow_walk_intensity: float = 1.0

const FEET_METRICS: Array[Vector3] = [
	Vector3(0.0, 1.0, 0.0),
	Vector3(0.0, 1.0, -1.0), Vector3(0.0, 1.0, -1.0), Vector3(-0.5, 1.01, -1.0), Vector3(-0.5, 1.01, -1.0),
	Vector3(0.0, 1.01, 0.0), Vector3(0.5, 1.02, 1.0), Vector3(0.5, 1.02, 2.0), Vector3(1.0, 1.03, 2.0),
	Vector3(1.0, 1.01, 1.0), Vector3(0.5, 1.01, 1.0), Vector3(-0.5, 0.99, 1.0), Vector3(-1.0, 0.98, 0.0),
	Vector3(-1.0, 0.96, 0.0), Vector3(-1.5, 0.97, 0.0), Vector3(-1.0, 0.98, 0.0), Vector3(-0.5, 0.99, -1.0),
	Vector3(0.5, 1.01, -1.0), Vector3(0.5, 1.02, -1.0), Vector3(1.0, 1.03, 0.0), Vector3(1.0, 1.03, 0.0),
	Vector3(2.5, 1.06, 0.0), Vector3(1.0, 1.01, -1.0), Vector3(0.5, 1.01, -1.0), Vector3(0.5, 0.99, -2.0),
	Vector3(0.0, 0.98, -2.0),
	Vector3(0.0, 0.98, -2.0), Vector3(0.0, 1.0, 0.0), Vector3(0.5, 1.01, 1.0), Vector3(1.0, 1.01, 1.0),
	Vector3(1.0, 1.03, 2.0), Vector3(1.0, 1.03, 2.0), Vector3(1.5, 1.02, 2.0), Vector3(1.0, 1.01, 1.0),
	Vector3(0.5, 0.99, 0.0), Vector3(0.0, 0.98, 0.0), Vector3(-0.5, 0.97, 0.0), Vector3(0.0, 0.98, 0.0),
	Vector3(0.5, 1.01, -1.0), Vector3(1.0, 1.01, -1.0), Vector3(1.0, 1.03, 0.0), Vector3(1.0, 1.03, 0.0),
	Vector3(2.5, 1.06, 0.0), Vector3(0.5, 1.02, 0.0), Vector3(1.0, 1.01, -1.0), Vector3(1.0, 1.0, -1.0),
	Vector3(0.5, 0.99, -2.0), Vector3(0.0, 0.98, -2.0), Vector3(0.0, 0.98, -2.0),
	Vector3(0.5, 1.01, 0.0), Vector3(1.0, 1.01, 2.0), Vector3(1.0, 1.03, 2.0), Vector3(1.0, 1.03, 2.0),
	Vector3(1.0, 1.03, 2.0), Vector3(1.0, 1.03, 2.0), Vector3(0.0, 1.01, 1.0), Vector3(-0.5, 1.01, 1.0),
	Vector3(-0.5, 1.01, 0.0), Vector3(-0.5, 1.01, 0.0), Vector3(-0.5, 1.01, 0.0)
]

var window_manager: WindowManager = null

@onready var anim_sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var ground_shadow: ColorRect = get_node_or_null("GroundShadow")

func _ready() -> void:
	anim_sprite.sprite_frames = anim_sprite.sprite_frames.duplicate()
	for animation in IDLE_RETURN_FRAMES.get_animation_names():
		anim_sprite.sprite_frames.add_animation(animation)
		anim_sprite.sprite_frames.set_animation_loop(animation, false)
		anim_sprite.sprite_frames.set_animation_speed(animation, IDLE_RETURN_FRAMES.get_animation_speed(animation))
		for frame in range(IDLE_RETURN_FRAMES.get_frame_count(animation)):
			anim_sprite.sprite_frames.add_frame(animation, IDLE_RETURN_FRAMES.get_frame_texture(animation, frame), IDLE_RETURN_FRAMES.get_frame_duration(animation, frame))
	anim_sprite.position = Vector2(160, base_pos_y)
	anim_sprite.animation_finished.connect(_on_animation_finished)
	anim_sprite.animation_looped.connect(_on_animation_looped)
	next_walk_delay = randf_range(3.0, 6.0)
	play_idle()

func _process(delta: float) -> void:
	match current_state:
		State.IDLE:
			_process_idle(delta)
		State.WALK_INTRO:
			_process_walk_intro(delta)
		State.WALK_LOOP:
			_process_walk_loop(delta)
		State.WALK_OUTRO:
			_process_walk_outro(delta)
		State.ACTION:
			_process_action(delta)
	
	_update_shadow()


func play_idle(keep_breath: bool = false) -> void:
	_stop_action_tween()
	current_state = State.IDLE
	current_speed = 0.0
	action_name = "idle"
	
	if not keep_breath:
		current_breath_y = 0.0
		idle_time = 0.0
		anim_sprite.position.y = base_pos_y
		anim_sprite.play("idle")
		
		if not is_flipping:
			anim_sprite.scale = Vector2(float(facing_direction), 1.0)
	else:
		if anim_sprite.animation != &"idle":
			anim_sprite.play("idle")
		next_walk_delay = idle_time + randf_range(3.0, 6.0)

func _update_breathing(delta: float) -> void:
	idle_time += delta
	
	if not is_flipping and (click_tween == null or not click_tween.is_running()):
		var breath = sin(idle_time * 2.5) * 0.016
		current_breath_y = breath
		anim_sprite.scale.y = 1.0 + breath
		anim_sprite.scale.x = float(facing_direction) * (1.0 - breath * 0.5)
		anim_sprite.position.y = base_pos_y - (112.0 * breath)
	else:
		current_breath_y = 0.0

func _process_idle(delta: float) -> void:
	_update_breathing(delta)
	
	if auto_walk_enabled and not is_flipping:
		if idle_time >= next_walk_delay:
			idle_time = 0.0
			start_random_walk()

var pending_walk_dir: int = 0


func paper_flip(target_dir: int, on_complete: Callable = Callable()) -> void:
	if is_flipping:
		if on_complete.is_valid():
			on_complete.call()
		return
		
	is_flipping = true
	var tween = create_tween().set_parallel(false)
	
	tween.tween_property(anim_sprite, "scale:x", 0.0, 0.08) \
		.set_trans(Tween.TRANS_QUAD) \
		.set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(anim_sprite, "scale:y", 1.08, 0.08)
	tween.parallel().tween_property(anim_sprite, "position:y", base_pos_y - 4.0, 0.08)
	
	tween.tween_callback(func():
		facing_direction = target_dir
		walk_direction_changed.emit(target_dir)
	)
	
	tween.tween_property(anim_sprite, "scale:x", float(target_dir) * 1.14, 0.10) \
		.set_trans(Tween.TRANS_BACK) \
		.set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(anim_sprite, "scale:y", 0.94, 0.10)
	tween.parallel().tween_property(anim_sprite, "position:y", base_pos_y + 2.0, 0.10)
	
	tween.tween_property(anim_sprite, "scale:x", float(target_dir) * 1.0, 0.05) \
		.set_trans(Tween.TRANS_SINE) \
		.set_ease(Tween.EASE_IN_OUT)
	tween.parallel().tween_property(anim_sprite, "scale:y", 1.0, 0.05)
	tween.parallel().tween_property(anim_sprite, "position:y", base_pos_y, 0.05)
	
	tween.tween_callback(func():
		is_flipping = false
		if pending_walk_dir != 0:
			var next_dir = pending_walk_dir
			pending_walk_dir = 0
			start_walk(next_dir)
		elif on_complete.is_valid():
			on_complete.call()
	)


func start_random_walk() -> void:
	if current_state != State.IDLE or is_flipping:
		return
		
	var can_left = true
	var can_right = true
	if window_manager != null:
		can_left = window_manager.can_move_left(40)
		can_right = window_manager.can_move_right(40)
	
	var chosen_dir = 1
	if can_left and can_right:
		chosen_dir = -1 if randf() < 0.5 else 1
	elif can_left:
		chosen_dir = -1
	elif can_right:
		chosen_dir = 1
	else:
		idle_time = 0.0
		next_walk_delay = 2.0
		return
		
	start_walk(chosen_dir)

func start_walk(direction: int) -> void:
	_stop_action_tween()
	var target_dir = -1 if direction < 0 else 1
	is_stopping_walk = false
	current_breath_y = 0.0
	anim_sprite.position.y = base_pos_y
	anim_sprite.scale = Vector2(float(target_dir), 1.0)
	
	if is_flipping:
		pending_walk_dir = target_dir
		return
		
	if facing_direction != target_dir:
		current_state = State.TURNING
		paper_flip(target_dir, func():
			_begin_walk_intro()
		)
	else:
		_begin_walk_intro()

func _begin_walk_intro() -> void:
	current_state = State.WALK_INTRO
	current_speed = 0.0
	anim_sprite.play("walk_intro")

func _process_walk_intro(delta: float) -> void:
	current_speed = lerp(current_speed, walk_speed, delta * 3.0)
	if window_manager != null and current_speed > 5.0:
		window_manager.move_window_x(facing_direction * current_speed * delta)

func _begin_walk_loop() -> void:
	current_state = State.WALK_LOOP
	current_speed = walk_speed
	walk_timer = 0.0
	walk_duration = randf_range(3.0, 6.0)
	anim_sprite.play("walk_loop")

func _process_walk_loop(delta: float) -> void:
	walk_timer += delta
	
	if window_manager != null:
		window_manager.move_window_x(facing_direction * current_speed * delta)
		
		if facing_direction == -1 and not window_manager.can_move_left(25):
			current_state = State.TURNING
			paper_flip(1, func():
				if current_state == State.TURNING:
					current_state = State.WALK_LOOP
			)
			return
		elif facing_direction == 1 and not window_manager.can_move_right(25):
			current_state = State.TURNING
			paper_flip(-1, func():
				if current_state == State.TURNING:
					current_state = State.WALK_LOOP
			)
			return
			
	if walk_timer >= walk_duration and not is_stopping_walk:
		stop_walk(false)

func stop_walk(immediate: bool = false) -> void:
	if immediate:
		if current_state == State.WALK_INTRO or current_state == State.WALK_LOOP:
			_enter_walk_outro()
	else:
		if current_state == State.WALK_LOOP or current_state == State.WALK_INTRO:
			is_stopping_walk = true

func _enter_walk_outro() -> void:
	is_stopping_walk = false
	current_state = State.WALK_OUTRO
	anim_sprite.play("walk_outro")

func _process_walk_outro(delta: float) -> void:
	current_speed = lerp(current_speed, 0.0, delta * 6.0)
	if window_manager != null and current_speed > 2.0:
		window_manager.move_window_x(facing_direction * current_speed * delta)

func interrupt_walk() -> void:
	is_stopping_walk = false
	current_speed = 0.0
	idle_time = 0.0
	next_walk_delay = randf_range(4.0, 8.0)
	play_idle()


func _on_animation_looped() -> void:
	if current_state == State.WALK_LOOP and is_stopping_walk and not is_flipping:
		_enter_walk_outro()

func _on_animation_finished() -> void:
	match anim_sprite.animation:
		"walk_intro":
			if current_state == State.WALK_INTRO:
				_begin_walk_loop()
		"walk_outro":
			if current_state == State.WALK_OUTRO:
				play_idle()
				next_walk_delay = randf_range(3.5, 7.5)
				action_finished.emit("walk")
		"jump", "wave":
			if current_state == State.ACTION:
				_begin_idle_return()
		"jump_return", "wave_return":
			if current_state == State.ACTION:
				var finished_name := action_name
				play_idle()
				next_walk_delay = randf_range(3.0, 6.0)
				action_finished.emit(finished_name)

func _begin_idle_return() -> void:
	_stop_action_tween()
	var return_scale := anim_sprite.scale / ACTION_SCALE
	var return_y := anim_sprite.position.y + return_scale.y * ACTION_Y_OFFSET
	anim_sprite.scale = return_scale
	anim_sprite.position.y = return_y
	anim_sprite.play(action_name + "_return")
	var target_scale := Vector2(float(facing_direction), 1.0)
	if not return_scale.is_equal_approx(target_scale) or not is_equal_approx(return_y, base_pos_y):
		var frames := anim_sprite.sprite_frames
		var duration := float(frames.get_frame_count(anim_sprite.animation)) / frames.get_animation_speed(anim_sprite.animation)
		action_tween = create_tween().set_parallel(true)
		action_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		action_tween.tween_property(anim_sprite, "scale", target_scale, duration)
		action_tween.tween_property(anim_sprite, "position:y", base_pos_y, duration)

func _stop_action_tween() -> void:
	if action_tween != null:
		action_tween.kill()
		action_tween = null
	if click_tween != null and click_tween.is_valid():
		click_tween.kill()
		click_tween = null


func play_jump() -> void:
	play_action_by_name("jump", 1.2)

func play_wave() -> void:
	play_action_by_name("wave", 1.8)

func play_action_by_name(act_name: String, duration: float = 3.0) -> void:
	_stop_action_tween()
	is_stopping_walk = false
	current_breath_y = 0.0
	action_name = act_name
	action_duration = duration
	action_timer = 0.0
	current_speed = 0.0
	current_state = State.ACTION
	

	if anim_sprite.sprite_frames != null and anim_sprite.sprite_frames.has_animation(act_name):
		anim_sprite.stop()
		anim_sprite.play(act_name)
		if act_name == "jump" or act_name == "wave":
			anim_sprite.scale = Vector2(float(facing_direction) * ACTION_SCALE.x, ACTION_SCALE.y)
			anim_sprite.position.y = base_pos_y - ACTION_Y_OFFSET
			if act_name == "jump":
				_trigger_jump_bounce(base_pos_y - ACTION_Y_OFFSET)
		else:
			anim_sprite.scale = Vector2(float(facing_direction), 1.0)
			anim_sprite.position.y = base_pos_y
	else:
		anim_sprite.scale = Vector2(float(facing_direction), 1.0)
		anim_sprite.position.y = base_pos_y
		anim_sprite.play("idle")
		idle_time = 0.0
		_trigger_action_bounce(act_name)

func _trigger_jump_bounce(target_base_y: float = base_pos_y) -> void:
	action_tween = create_tween().set_parallel(false)
	var tween := action_tween
	tween.tween_interval(0.38)
	tween.tween_property(anim_sprite, "position:y", target_base_y - 20.0, 0.18) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "position:y", target_base_y, 0.16) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)

func _trigger_action_bounce(_act_name: String) -> void:
	action_tween = create_tween().set_parallel(false)
	var tween := action_tween
	tween.tween_property(anim_sprite, "position:y", base_pos_y - 12.0, 0.12)
	tween.tween_property(anim_sprite, "position:y", base_pos_y, 0.12)
	tween.finished.connect(func():
		if action_tween == tween:
			action_tween = null
	)

func _process_action(delta: float) -> void:
	if anim_sprite.animation in [&"jump", &"wave", &"jump_return", &"wave_return"]:
		return

	if anim_sprite.animation == &"idle":
		if action_tween == null or not action_tween.is_running():
			_update_breathing(delta)

	action_timer += delta
	if action_timer >= action_duration:
		var finished_name = action_name
		var keep_breath := (anim_sprite.animation == &"idle" and not is_flipping)
		play_idle(keep_breath)
		action_finished.emit(finished_name)

func play_click_bounce() -> void:
	if click_tween != null and click_tween.is_valid():
		click_tween.kill()
	click_tween = create_tween().set_parallel(false)
	var tween := click_tween
	tween.tween_property(anim_sprite, "scale", Vector2(float(facing_direction) * 1.15, 0.85), 0.09) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "scale", Vector2(float(facing_direction) * 0.92, 1.12), 0.12) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "position:y", base_pos_y - 14.0, 0.12) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "position:y", base_pos_y, 0.12) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.tween_property(anim_sprite, "scale", Vector2(float(facing_direction) * 1.0, 1.0), 0.08)
	tween.finished.connect(func():
		if click_tween == tween:
			click_tween = null
			idle_time = 0.0
	)

func get_current_action_name() -> String:
	match current_state:
		State.WALK_INTRO, State.WALK_LOOP, State.WALK_OUTRO:
			return "walk"
		State.ACTION:
			return action_name
		_:
			return "idle"

func _get_current_frame_index() -> int:
	match anim_sprite.animation:
		"idle":
			return 0
		"walk_intro":
			return clampi(1 + anim_sprite.frame, 1, 25)
		"walk_loop":
			return clampi(26 + anim_sprite.frame, 26, 48)
		"walk_outro":
			return clampi(49 + anim_sprite.frame, 49, 59)
		_:
			return 0


func _update_shadow() -> void:
	if ground_shadow == null:
		return
	
	ground_shadow.size = Vector2(shadow_width, shadow_height)
	ground_shadow.pivot_offset = Vector2(shadow_width * 0.5, shadow_height * 0.5)
	
	var walk_dx: float = 0.0
	var walk_dy: float = 0.0
	var walk_sx: float = 1.0
	var walk_sy: float = 1.0
	
	if shadow_walk_dynamic and (current_state == State.WALK_INTRO or current_state == State.WALK_LOOP or current_state == State.WALK_OUTRO):
		var frame_idx = _get_current_frame_index()
		if frame_idx >= 0 and frame_idx < FEET_METRICS.size():
			var m = FEET_METRICS[frame_idx]
			walk_dx = m.x * float(facing_direction) * shadow_walk_intensity
			walk_sx = 1.0 + (m.y - 1.0) * shadow_walk_intensity * 1.5
			walk_dy = m.z * shadow_walk_intensity * 0.6
			walk_sy = 1.0 + (m.z * 0.03) * shadow_walk_intensity
	
	ground_shadow.position.x = anim_sprite.position.x + shadow_offset_x + walk_dx - (shadow_width * 0.5)
	ground_shadow.position.y = shadow_center_y + walk_dy - (shadow_height * 0.5)
	
	var has_action_alignment := current_state == State.ACTION \
		and anim_sprite.animation in [&"jump", &"wave"]
	var is_idle_breathing := (current_state == State.IDLE) or (
		current_state == State.ACTION and anim_sprite.animation == &"idle" and (action_tween == null or not action_tween.is_running())
	)
	var jump_height = 0.0
	if not is_idle_breathing:
		var ground_y = base_pos_y
		if has_action_alignment:
			ground_y = base_pos_y - ACTION_Y_OFFSET
		jump_height = maxf(0.0, ground_y - anim_sprite.position.y)
	var jump_ratio = clamp(jump_height / 35.0, 0.0, 1.0)
	
	var height_scale = lerp(1.0, 0.65, jump_ratio)
	var alpha_factor = lerp(1.0, 0.35, jump_ratio)
	
	var idle_shadow_sy = 1.0 - (current_breath_y * 0.6)
	var idle_shadow_alpha = 1.0 - (current_breath_y * 0.3)
	
	var body_scale_x = abs(anim_sprite.scale.x)
	if has_action_alignment:
		body_scale_x /= ACTION_SCALE.x
	ground_shadow.scale.x = body_scale_x * walk_sx * height_scale
	ground_shadow.scale.y = idle_shadow_sy * walk_sy * height_scale
	
	ground_shadow.modulate.a = shadow_opacity * alpha_factor * idle_shadow_alpha
