class_name WindowManager
extends Node

var is_dragging: bool = false
var drag_start_mouse: Vector2i = Vector2i.ZERO
var drag_start_window: Vector2i = Vector2i.ZERO
var click_start_pos: Vector2i = Vector2i.ZERO

signal pet_clicked
signal open_context_menu(screen_pos: Vector2i)

func _ready() -> void:
	_setup_window()
	_position_window_at_bottom_right()

func _setup_window() -> void:
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_BORDERLESS, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_ALWAYS_ON_TOP, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_TRANSPARENT, true)
	DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_RESIZE_DISABLED, true)
	get_viewport().transparent_bg = true

func _position_window_at_bottom_right() -> void:
	var screen_rect = DisplayServer.screen_get_usable_rect()
	var win_size = DisplayServer.window_get_size()
	# Place at bottom-right corner with 40px margin
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
			else:
				is_dragging = false
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
