class_name WindowManager
extends Node

signal pet_clicked
signal open_context_menu(screen_pos: Vector2i)
signal drag_started
signal drag_ended
signal scale_requested(new_scale: float)

var current_scale: float = 1.0
const BASE_WIN_SIZE = Vector2i(320, 320)

var is_dragging: bool = false
var drag_start_mouse: Vector2i = Vector2i.ZERO
var drag_start_window: Vector2i = Vector2i.ZERO
var click_start_pos: Vector2i = Vector2i.ZERO

var accumulated_x: float = 0.0

const FLAG_PATH = "/tmp/mcd_show_over_fullscreen.flag"
const CONFIG_PATH = "user://window_settings.cfg"

var show_over_fullscreen: bool = false

func _ready() -> void:
	_setup_window()
	_load_settings()
	_position_window_at_bottom_right()

func _load_settings() -> void:
	var cfg = ConfigFile.new()
	if cfg.load(CONFIG_PATH) == OK:
		show_over_fullscreen = cfg.get_value("window", "show_over_fullscreen", false)
	_sync_flag_file()

func is_fullscreen_overlay_enabled() -> bool:
	return show_over_fullscreen

func set_show_over_fullscreen(enable: bool) -> void:
	show_over_fullscreen = enable
	var cfg = ConfigFile.new()
	cfg.load(CONFIG_PATH)
	cfg.set_value("window", "show_over_fullscreen", enable)
	cfg.save(CONFIG_PATH)
	_sync_flag_file()

func _sync_flag_file() -> void:
	var f = FileAccess.open(FLAG_PATH, FileAccess.WRITE)
	if f:
		f.store_string("1" if show_over_fullscreen else "0")
		f.close()

func _setup_window() -> void:
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_BORDERLESS, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_ALWAYS_ON_TOP, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_TRANSPARENT, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_RESIZE_DISABLED, true)
	get_viewport().transparent_bg = true
	get_viewport().set_embedding_subwindows(false)

func _position_window_at_bottom_right() -> void:
	var screen_rect = DisplayServer.screen_get_usable_rect()
	var win_size = DisplayServer.window_get_size()
	var target_x = screen_rect.position.x + screen_rect.size.x - win_size.x - 40
	var target_y = screen_rect.position.y + screen_rect.size.y - win_size.y - 40
	DisplayServer.window_set_position(Vector2i(target_x, target_y))

func apply_scale(new_scale: float, anchor_to_floor: bool = true) -> void:
	new_scale = clampf(new_scale, 0.5, 2.0)
	var old_scale = current_scale
	current_scale = new_scale

	var old_pos = DisplayServer.window_get_position()
	var new_w = int(round(BASE_WIN_SIZE.x * new_scale))
	var new_h = int(round(BASE_WIN_SIZE.y * new_scale))
	var new_size = Vector2i(new_w, new_h)

	if anchor_to_floor and old_scale > 0.0:
		var feet_x = old_pos.x + 160.0 * old_scale
		var feet_y = old_pos.y + 290.0 * old_scale
		var new_x = int(round(feet_x - 160.0 * new_scale))
		var new_y = int(round(feet_y - 290.0 * new_scale))

		var screen_rect = get_screen_bounds()
		var min_y = -int(round(260.0 * new_scale))
		var max_y = screen_rect.position.y + screen_rect.size.y - int(round(100.0 * new_scale))
		var min_x = screen_rect.position.x - int(round(160.0 * new_scale))
		var max_x = screen_rect.position.x + screen_rect.size.x - int(round(160.0 * new_scale))
		new_x = clampi(new_x, min_x, max_x)
		new_y = clampi(new_y, min_y, max_y)
		DisplayServer.window_set_position(Vector2i(new_x, new_y))

	DisplayServer.window_set_size(new_size)

func handle_input(event: InputEvent) -> void:
	# Mac trackpad pinch-to-zoom gesture
	if event is InputEventMagnifyGesture:
		var target_scale = clampf(current_scale * event.factor, 0.5, 2.0)
		scale_requested.emit(target_scale)
		return

	if event is InputEventMouseButton:
		var has_scale_modifier = event.is_command_or_control_pressed() or event.ctrl_pressed or event.meta_pressed or event.alt_pressed or event.shift_pressed

		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			if has_scale_modifier:
				scale_requested.emit(clampf(current_scale + 0.05, 0.5, 2.0))
				return
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			if has_scale_modifier:
				scale_requested.emit(clampf(current_scale - 0.05, 0.5, 2.0))
				return

		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				is_dragging = true
				drag_start_mouse = DisplayServer.mouse_get_position()
				drag_start_window = DisplayServer.window_get_position()
				click_start_pos = drag_start_mouse
				accumulated_x = 0.0
				drag_started.emit()
			else:
				if is_dragging:
					is_dragging = false
					drag_ended.emit()
				var release_mouse = DisplayServer.mouse_get_position()
				if click_start_pos.distance_to(release_mouse) < 6:
					pet_clicked.emit()

		elif event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
			open_context_menu.emit(DisplayServer.mouse_get_position())

	elif event is InputEventKey:
		handle_key_input(event)

func handle_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		var is_cmd_or_ctrl = event.is_command_or_control_pressed() or event.ctrl_pressed or event.meta_pressed
		if is_cmd_or_ctrl:
			if event.keycode == KEY_EQUAL or event.keycode == KEY_PLUS or event.physical_keycode == KEY_EQUAL:
				scale_requested.emit(clampf(current_scale + 0.1, 0.5, 2.0))
			elif event.keycode == KEY_MINUS or event.physical_keycode == KEY_MINUS:
				scale_requested.emit(clampf(current_scale - 0.1, 0.5, 2.0))
			elif event.keycode == KEY_0 or event.physical_keycode == KEY_0:
				scale_requested.emit(1.0)

func _process(_delta: float) -> void:
	if is_dragging:
		var current_mouse = DisplayServer.mouse_get_position()
		var delta_pos = current_mouse - drag_start_mouse
		var target_x = drag_start_window.x + delta_pos.x
		var target_y = drag_start_window.y + delta_pos.y

		var screen_rect = get_screen_bounds()
		var min_y = -int(round(260.0 * current_scale))
		var max_y = screen_rect.position.y + screen_rect.size.y - int(round(100.0 * current_scale))
		var min_x = screen_rect.position.x - int(round(160.0 * current_scale))
		var max_x = screen_rect.position.x + screen_rect.size.x - int(round(160.0 * current_scale))

		target_x = clampi(target_x, min_x, max_x)
		target_y = clampi(target_y, min_y, max_y)
		DisplayServer.window_set_position(Vector2i(target_x, target_y))

var _cached_usable_rect: Rect2i = Rect2i()
var _last_screen_query_msec: int = 0

func get_screen_bounds() -> Rect2i:
	var now = Time.get_ticks_msec()
	if _cached_usable_rect.size.x == 0 or (now - _last_screen_query_msec) > 1500:
		_cached_usable_rect = DisplayServer.screen_get_usable_rect()
		_last_screen_query_msec = now
	return _cached_usable_rect

func move_window_x(delta_x: float) -> void:
	if is_dragging:
		return
	accumulated_x += delta_x
	var step = int(accumulated_x)
	if step != 0:
		var current_pos = DisplayServer.window_get_position()
		var screen_rect = get_screen_bounds()
		var min_x = screen_rect.position.x - int(round(160.0 * current_scale))
		var max_x = screen_rect.position.x + screen_rect.size.x - int(round(160.0 * current_scale))
		
		var target_x = current_pos.x + step
		# Prevent teleporting: if already outside boundary or near boundary,
		# never abruptly clamp. Only prevent stepping further past boundary.
		if step < 0:
			target_x = max(target_x, min_x)
		elif step > 0:
			target_x = min(target_x, max_x)
			
		DisplayServer.window_set_position(Vector2i(target_x, current_pos.y))
		accumulated_x -= step

func can_move_left(margin: int = 20) -> bool:
	var screen_rect = get_screen_bounds()
	var win_pos = DisplayServer.window_get_position()
	var min_x = screen_rect.position.x - int(round(160.0 * current_scale))
	return win_pos.x > (min_x + margin)

func can_move_right(margin: int = 20) -> bool:
	var screen_rect = get_screen_bounds()
	var win_pos = DisplayServer.window_get_position()
	var max_x = screen_rect.position.x + screen_rect.size.x - int(round(160.0 * current_scale))
	return win_pos.x < (max_x - margin)

func get_window_position() -> Vector2i:
	return DisplayServer.window_get_position()

