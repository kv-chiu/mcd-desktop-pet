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

# 基础状态
var current_state: State = State.IDLE
var facing_direction: int = 1 # 1: 右, -1: 左
var is_flipping: bool = false
var base_pos_y: float = 180.0

# 行走参数
var walk_speed: float = 75.0 # 像素/秒
var current_speed: float = 0.0
var walk_timer: float = 0.0
var walk_duration: float = 4.0
var idle_time: float = 0.0
var next_walk_delay: float = 4.0
var auto_walk_enabled: bool = true
var is_stopping_walk: bool = false

# 动作计时
var action_name: String = ""
var action_timer: float = 0.0
var action_duration: float = 3.0
var current_breath_y: float = 0.0

# 阴影尺寸与中心配置（可在属性面板或脚本直接调整）
@export_group("地面阴影设置")
@export var shadow_width: float = 129.0 # 椭圆宽度
@export var shadow_height: float = 20.0 # 椭圆高度
@export var shadow_center_y: float = 291.0 # 椭圆垂直中心位置 (Y，脚底接地线)
@export var shadow_offset_x: float = 1.0 # 椭圆水平中心偏移 (X，正数偏右，负数偏左)
@export_range(0.0, 1.0, 0.01) var shadow_opacity: float = 0.25 # 阴影不透明度 (0.0 完全透明 ~ 1.0 最浓)
@export var shadow_walk_dynamic: bool = true # 角色移动时影子是否随人物动作变化
@export_range(0.0, 3.0, 0.1) var shadow_walk_intensity: float = 1.0 # 动作变化幅度/强度 (1.0 为标准幅度)

# 60 帧动画步态特征表 (dx: 脚底水平摆动, sx: 跨步宽度缩放, dy: 触地起伏)
const FEET_METRICS: Array[Vector3] = [
	Vector3(0.0, 1.0, 0.0), # 01: idle
	Vector3(0.0, 1.0, -1.0), Vector3(0.0, 1.0, -1.0), Vector3(-0.5, 1.01, -1.0), Vector3(-0.5, 1.01, -1.0), # 02-05
	Vector3(0.0, 1.01, 0.0), Vector3(0.5, 1.02, 1.0), Vector3(0.5, 1.02, 2.0), Vector3(1.0, 1.03, 2.0), # 06-09
	Vector3(1.0, 1.01, 1.0), Vector3(0.5, 1.01, 1.0), Vector3(-0.5, 0.99, 1.0), Vector3(-1.0, 0.98, 0.0), # 10-13
	Vector3(-1.0, 0.96, 0.0), Vector3(-1.5, 0.97, 0.0), Vector3(-1.0, 0.98, 0.0), Vector3(-0.5, 0.99, -1.0), # 14-17
	Vector3(0.5, 1.01, -1.0), Vector3(0.5, 1.02, -1.0), Vector3(1.0, 1.03, 0.0), Vector3(1.0, 1.03, 0.0), # 18-21
	Vector3(2.5, 1.06, 0.0), Vector3(1.0, 1.01, -1.0), Vector3(0.5, 1.01, -1.0), Vector3(0.5, 0.99, -2.0), # 22-25
	Vector3(0.0, 0.98, -2.0), # 26: end of intro
	Vector3(0.0, 0.98, -2.0), Vector3(0.0, 1.0, 0.0), Vector3(0.5, 1.01, 1.0), Vector3(1.0, 1.01, 1.0), # 27-30: loop start
	Vector3(1.0, 1.03, 2.0), Vector3(1.0, 1.03, 2.0), Vector3(1.5, 1.02, 2.0), Vector3(1.0, 1.01, 1.0), # 31-34
	Vector3(0.5, 0.99, 0.0), Vector3(0.0, 0.98, 0.0), Vector3(-0.5, 0.97, 0.0), Vector3(0.0, 0.98, 0.0), # 35-38
	Vector3(0.5, 1.01, -1.0), Vector3(1.0, 1.01, -1.0), Vector3(1.0, 1.03, 0.0), Vector3(1.0, 1.03, 0.0), # 39-42
	Vector3(2.5, 1.06, 0.0), Vector3(0.5, 1.02, 0.0), Vector3(1.0, 1.01, -1.0), Vector3(1.0, 1.0, -1.0), # 43-46
	Vector3(0.5, 0.99, -2.0), Vector3(0.0, 0.98, -2.0), Vector3(0.0, 0.98, -2.0), # 47-49: loop end
	Vector3(0.5, 1.01, 0.0), Vector3(1.0, 1.01, 2.0), Vector3(1.0, 1.03, 2.0), Vector3(1.0, 1.03, 2.0), # 50-53: outro
	Vector3(1.0, 1.03, 2.0), Vector3(1.0, 1.03, 2.0), Vector3(0.0, 1.01, 1.0), Vector3(-0.5, 1.01, 1.0), # 54-57
	Vector3(-0.5, 1.01, 0.0), Vector3(-0.5, 1.01, 0.0), Vector3(-0.5, 1.01, 0.0) # 58-60
]

# 外部组件引用
var window_manager: WindowManager = null

@onready var anim_sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var ground_shadow: ColorRect = get_node_or_null("GroundShadow")

func _ready() -> void:
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

# ==================== IDLE 状态 ====================

func play_idle() -> void:
	current_state = State.IDLE
	current_speed = 0.0
	current_breath_y = 0.0
	action_name = "idle"
	anim_sprite.position.y = base_pos_y
	anim_sprite.play("idle")
	
	# 如果朝向依然是朝左，在进入待机正面时优雅翻回正向 (1)
	if facing_direction != 1 and not is_flipping:
		paper_flip(1)
	else:
		anim_sprite.scale = Vector2(1.0, 1.0)

func _process_idle(delta: float) -> void:
	idle_time += delta
	
	# 自然微呼吸律动（保持脚底稳贴地面，身体舒展与影子呼吸严格同步）
	if not is_flipping:
		var breath = sin(idle_time * 2.5) * 0.016
		current_breath_y = breath
		anim_sprite.scale.y = 1.0 + breath
		anim_sprite.scale.x = float(facing_direction) * (1.0 - breath * 0.5)
		# 脚底贴地锁定补偿（消除中心缩放导致的脚部悬空，仅头部胸部起伏）
		anim_sprite.position.y = base_pos_y - (112.0 * breath)
	else:
		current_breath_y = 0.0
	
	# 自动随机漫步计时
	if auto_walk_enabled and not is_flipping:
		if idle_time >= next_walk_delay:
			idle_time = 0.0
			start_random_walk()

var pending_walk_dir: int = 0

# ==================== 纸片翻转特效 ====================

func paper_flip(target_dir: int, on_complete: Callable = Callable()) -> void:
	if is_flipping:
		if on_complete.is_valid():
			on_complete.call()
		return
		
	is_flipping = true
	var tween = create_tween().set_parallel(false)
	
	# 阶段 1：向中线收缩变窄为纸片侧面 (0.08s)，伴随微小跳起
	tween.tween_property(anim_sprite, "scale:x", 0.0, 0.08) \
		.set_trans(Tween.TRANS_QUAD) \
		.set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(anim_sprite, "scale:y", 1.08, 0.08)
	tween.parallel().tween_property(anim_sprite, "position:y", base_pos_y - 4.0, 0.08)
	
	# 纸片折叠至0瞬间：翻转朝向
	tween.tween_callback(func():
		facing_direction = target_dir
		walk_direction_changed.emit(target_dir)
	)
	
	# 阶段 2：向目标方向弹出展开 (0.10s)，Q弹 Overshoot
	tween.tween_property(anim_sprite, "scale:x", float(target_dir) * 1.14, 0.10) \
		.set_trans(Tween.TRANS_BACK) \
		.set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(anim_sprite, "scale:y", 0.94, 0.10)
	tween.parallel().tween_property(anim_sprite, "position:y", base_pos_y + 2.0, 0.10)
	
	# 阶段 3：平复回归稳定尺寸 (0.05s)
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

# ==================== WALK 流程 ====================

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
		# 无空间，稍后再试
		idle_time = 0.0
		next_walk_delay = 2.0
		return
		
	start_walk(chosen_dir)

func start_walk(direction: int) -> void:
	var target_dir = -1 if direction < 0 else 1
	is_stopping_walk = false
	current_breath_y = 0.0
	anim_sprite.position.y = base_pos_y
	anim_sprite.scale = Vector2(float(target_dir), 1.0)
	
	if is_flipping:
		pending_walk_dir = target_dir
		return
		
	# 如果当前朝向不一致，先执行纸片翻转，翻转完成后开始前奏
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
	# 前奏阶段逐渐加速起步
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
	
	# 窗口移动
	if window_manager != null:
		window_manager.move_window_x(facing_direction * current_speed * delta)
		
		# 碰壁边缘检测与翻转转向
		if facing_direction == -1 and not window_manager.can_move_left(25):
			# 碰到左边缘，纸片翻转掉头向右
			current_state = State.TURNING
			paper_flip(1, func():
				if current_state == State.TURNING:
					current_state = State.WALK_LOOP
			)
			return
		elif facing_direction == 1 and not window_manager.can_move_right(25):
			# 碰到右边缘，纸片翻转掉头向左
			current_state = State.TURNING
			paper_flip(-1, func():
				if current_state == State.TURNING:
					current_state = State.WALK_LOOP
			)
			return
			
	# 行走时间到，请求停步（等当前循环完整走完最后一帧再刹车）
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
	# 后奏平稳减速刹车
	current_speed = lerp(current_speed, 0.0, delta * 6.0)
	if window_manager != null and current_speed > 2.0:
		window_manager.move_window_x(facing_direction * current_speed * delta)

func interrupt_walk() -> void:
	# 用户拖拽或强制中断时调用
	is_stopping_walk = false
	current_speed = 0.0
	idle_time = 0.0
	next_walk_delay = randf_range(4.0, 8.0)
	play_idle()

# ==================== 动画完成/循环回调 ====================

func _on_animation_looped() -> void:
	# 当前行走循环结束时，如果已请求停步且未在翻转中，平滑无缝切入刹车后奏
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

# ==================== 其它动作/互动 ====================

func play_action_by_name(act_name: String, duration: float = 3.0) -> void:
	is_stopping_walk = false
	action_name = act_name
	action_duration = duration
	action_timer = 0.0
	current_speed = 0.0
	current_state = State.ACTION
	
	# 切回正视图作为动作底座
	anim_sprite.play("idle")
	if facing_direction != 1 and not is_flipping:
		paper_flip(1)
		
	# 活泼的动作弹跳反馈
	_trigger_action_bounce(act_name)

func _trigger_action_bounce(act_name: String) -> void:
	var tween = create_tween().set_parallel(false)
	match act_name:
		"celebrate":
			for i in 2:
				tween.tween_property(anim_sprite, "position:y", base_pos_y - 25.0, 0.15) \
					.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
				tween.tween_property(anim_sprite, "position:y", base_pos_y, 0.15) \
					.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		"eat_burger", "drink_coke":
			for i in 3:
				tween.tween_property(anim_sprite, "scale:y", 0.9, 0.12)
				tween.tween_property(anim_sprite, "scale:y", 1.05, 0.12)
			tween.tween_property(anim_sprite, "scale:y", 1.0, 0.1)
		"sleep":
			tween.tween_property(anim_sprite, "scale:y", 0.88, 0.3)
		_:
			tween.tween_property(anim_sprite, "position:y", base_pos_y - 12.0, 0.12)
			tween.tween_property(anim_sprite, "position:y", base_pos_y, 0.12)

func _process_action(delta: float) -> void:
	action_timer += delta
	if action_timer >= action_duration:
		var finished_name = action_name
		play_idle()
		action_finished.emit(finished_name)

func play_click_bounce() -> void:
	# 点击小宝时的快乐弹性反馈
	var tween = create_tween().set_parallel(false)
	tween.tween_property(anim_sprite, "scale", Vector2(float(facing_direction) * 1.15, 0.85), 0.09) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "scale", Vector2(float(facing_direction) * 0.92, 1.12), 0.12) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "position:y", base_pos_y - 14.0, 0.12) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(anim_sprite, "position:y", base_pos_y, 0.12) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tween.tween_property(anim_sprite, "scale", Vector2(float(facing_direction) * 1.0, 1.0), 0.08)

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

# ==================== 地面动态阴影联动 ====================

func _update_shadow() -> void:
	if ground_shadow == null:
		return
	
	# 设置阴影底座基础尺寸与中心缩放锚点
	ground_shadow.size = Vector2(shadow_width, shadow_height)
	ground_shadow.pivot_offset = Vector2(shadow_width * 0.5, shadow_height * 0.5)
	
	# 行走动作动态联动偏移与形变
	var walk_dx: float = 0.0
	var walk_dy: float = 0.0
	var walk_sx: float = 1.0
	var walk_sy: float = 1.0
	
	if shadow_walk_dynamic and (current_state == State.WALK_INTRO or current_state == State.WALK_LOOP or current_state == State.WALK_OUTRO):
		var frame_idx = _get_current_frame_index()
		if frame_idx >= 0 and frame_idx < FEET_METRICS.size():
			var m = FEET_METRICS[frame_idx]
			# m.x: 脚底水平前后摆动偏移（随行走朝向翻转）
			walk_dx = m.x * float(facing_direction) * shadow_walk_intensity
			# m.y: 跨步宽度缩放（双脚迈开跨步时变宽，单脚收起离地时变窄）
			walk_sx = 1.0 + (m.y - 1.0) * shadow_walk_intensity * 1.5
			# m.z: 脚掌着地高低差微调与触地压扁反馈
			walk_dy = m.z * shadow_walk_intensity * 0.6
			walk_sy = 1.0 + (m.z * 0.03) * shadow_walk_intensity
	
	# 中心对齐：X 跟随精灵中心 + 水平微调 + 动作摆动，Y 保持在地面中心 + 步态微调
	ground_shadow.position.x = anim_sprite.position.x + shadow_offset_x + walk_dx - (shadow_width * 0.5)
	ground_shadow.position.y = shadow_center_y + walk_dy - (shadow_height * 0.5)
	
	# 计算起跳/浮空高度（相对默认地面 base_pos_y，排除待机微呼吸的脚底贴地补偿）
	var jump_height = 0.0
	if current_state != State.IDLE:
		jump_height = maxf(0.0, base_pos_y - anim_sprite.position.y)
	var jump_ratio = clamp(jump_height / 35.0, 0.0, 1.0)
	
	# 腾空越高：影子缩小、变淡
	var height_scale = lerp(1.0, 0.65, jump_ratio)
	var alpha_factor = lerp(1.0, 0.35, jump_ratio)
	
	# 待机微呼吸对影子的同步影响（吸气挺拔时影子微聚微敛，呼气下沉时影子横向舒展）
	var idle_shadow_sy = 1.0 - (current_breath_y * 0.6)
	var idle_shadow_alpha = 1.0 - (current_breath_y * 0.3)
	
	# 宽度联动角色本体翻转收缩与行走跨步形变
	var body_scale_x = abs(anim_sprite.scale.x)
	ground_shadow.scale.x = body_scale_x * walk_sx * height_scale
	ground_shadow.scale.y = idle_shadow_sy * walk_sy * height_scale
	
	# 动态透明度调整（基础不透明度 * 腾空淡化系数 * 待机微呼吸淡化）
	ground_shadow.modulate.a = shadow_opacity * alpha_factor * idle_shadow_alpha
