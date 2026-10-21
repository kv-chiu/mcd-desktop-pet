class_name WindowManager
extends Node

signal pet_clicked
signal open_context_menu(screen_pos: Vector2i)
signal drag_started
signal drag_ended

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

func handle_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
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

func _process(_delta: float) -> void:
	if is_dragging:
		var current_mouse = DisplayServer.mouse_get_position()
		var delta_pos = current_mouse - drag_start_mouse
		DisplayServer.window_set_position(drag_start_window + delta_pos)

func move_window_x(delta_x: float) -> void:
	if is_dragging:
		return
	accumulated_x += delta_x
	var step = int(accumulated_x)
	if step != 0:
		var current_pos = DisplayServer.window_get_position()
		var screen_rect = DisplayServer.screen_get_usable_rect()
		var win_size = DisplayServer.window_get_size()
		
		var new_x = clamp(
			current_pos.x + step,
			screen_rect.position.x,
			screen_rect.position.x + screen_rect.size.x - win_size.x
		)
		DisplayServer.window_set_position(Vector2i(new_x, current_pos.y))
		accumulated_x -= step

func can_move_left(margin: int = 20) -> bool:
	var screen_rect = DisplayServer.screen_get_usable_rect()
	var win_pos = DisplayServer.window_get_position()
	return win_pos.x > (screen_rect.position.x + margin)

func can_move_right(margin: int = 20) -> bool:
	var screen_rect = DisplayServer.screen_get_usable_rect()
	var win_pos = DisplayServer.window_get_position()
	var win_size = DisplayServer.window_get_size()
	return (win_pos.x + win_size.x) < (screen_rect.position.x + screen_rect.size.x - margin)

func get_window_position() -> Vector2i:
	return DisplayServer.window_get_position()

func get_screen_bounds() -> Rect2i:
	return DisplayServer.screen_get_usable_rect()
