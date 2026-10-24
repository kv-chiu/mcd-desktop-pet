class_name NoteWindow
extends Window

const ThemeLoader = preload("res://scripts/theme_loader.gd")

signal note_updated(id: String, content: String, pos: Vector2i, size: Vector2i, media: Array)
signal note_archived(id: String)
signal note_deleted(id: String)
signal position_changed(id: String, pos: Vector2i, size: Vector2i)

var note_id: String = ""
var order_number: String = "#042"
var is_pinned: bool = false
var is_dragging: bool = false
var drag_start_mouse: Vector2i = Vector2i.ZERO
var drag_start_window: Vector2i = Vector2i.ZERO

var is_resizing: bool = false
var resize_start_mouse: Vector2i = Vector2i.ZERO
var resize_start_size: Vector2i = Vector2i.ZERO

var auto_save_timer: float = 0.0
var content_dirty: bool = false
var media_list: Array = []

@onready var panel_bg: Panel = $RootControl/PanelBg
@onready var header_bar: Control = $RootControl/HeaderBar
@onready var title_label: Label = $RootControl/HeaderBar/TitleLabel
@onready var order_label: Label = $RootControl/HeaderBar/OrderLabel
@onready var pin_btn: Button = $RootControl/HeaderBar/PinButton
@onready var archive_btn: Button = $RootControl/HeaderBar/ArchiveButton
@onready var close_btn: Button = $RootControl/HeaderBar/CloseButton
@onready var text_edit: TextEdit = $RootControl/BodyContainer/TextEdit
@onready var media_container: VBoxContainer = $RootControl/BodyContainer/MediaContainer
@onready var footer_bar: Control = $RootControl/FooterBar
@onready var barcode_rect: ColorRect = $RootControl/FooterBar/BarcodeRect
@onready var resize_handle: Control = $RootControl/FooterBar/ResizeHandle
@onready var stamp_overlay: Control = $RootControl/StampOverlay
@onready var stamp_label: Label = $RootControl/StampOverlay/StampLabel

func _ready() -> void:
	borderless = true
	always_on_top = true
	transparent = true
	transparent_bg = true
	min_size = Vector2i(200, 200)
	max_size = Vector2i(600, 800)
	
	header_bar.gui_input.connect(_on_header_gui_input)
	resize_handle.gui_input.connect(_on_resize_gui_input)
	pin_btn.pressed.connect(_on_pin_pressed)
	archive_btn.pressed.connect(_on_archive_pressed)
	close_btn.pressed.connect(_on_close_pressed)
	text_edit.text_changed.connect(_on_text_changed)
	text_edit.gui_input.connect(_on_text_edit_gui_input)
	
	apply_theme()

func setup_note(data: Dictionary) -> void:
	note_id = data.get("id", "")
	order_number = data.get("order_number", "#042")
	var content = data.get("content", "")
	var note_title = data.get("title", "")
	is_pinned = data.get("pinned", false)
	
	order_label.text = order_number
	title_label.text = note_title if note_title != "" else "便利贴"
	text_edit.text = content
	
	# Position & Size
	var pos_arr = data.get("position", [100, 100])
	var size_arr = data.get("size", [280, 320])
	if typeof(pos_arr) == TYPE_ARRAY and pos_arr.size() == 2:
		position = Vector2i(int(pos_arr[0]), int(pos_arr[1]))
	if typeof(size_arr) == TYPE_ARRAY and size_arr.size() == 2:
		size = Vector2i(int(size_arr[0]), int(size_arr[1]))
	
	# Load existing media
	media_list = []
	var media_data = data.get("media", [])
	if typeof(media_data) == TYPE_ARRAY:
		for m in media_data:
			if typeof(m) == TYPE_STRING and m != "":
				media_list.append(m)
	
	for child in media_container.get_children():
		child.queue_free()
	for filename in media_list:
		_load_remote_media(filename)
	
	_update_pin_visual()
	apply_theme()

func apply_theme() -> void:
	if not is_inside_tree():
		return
		
	var bg_color = ThemeLoader.get_note_bg_color()
	var text_primary = ThemeLoader.get_text_primary()
	var text_secondary = ThemeLoader.get_text_secondary()
	var accent_color = ThemeLoader.get_accent_color()
	var border_color = ThemeLoader.get_border_color()
	
	# Background style
	var style = StyleBoxFlat.new()
	style.bg_color = bg_color
	style.border_color = border_color
	style.set_border_width_all(1)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	style.shadow_color = Color(0, 0, 0, 0.08)
	style.shadow_size = 8
	panel_bg.add_theme_stylebox_override("panel", style)
	
	# Text colors
	order_label.add_theme_color_override("font_color", accent_color)
	title_label.add_theme_color_override("font_color", text_primary)
	text_edit.add_theme_color_override("font_color", text_primary)
	
	# Barcode in footer (only visible in McDonald's theme)
	if ThemeLoader.get_theme() == ThemeLoader.THEME_MCDONALDS:
		barcode_rect.visible = true
		barcode_rect.color = text_secondary
	else:
		barcode_rect.visible = false
	
	# Stamp styling
	stamp_label.text = ThemeLoader.get_stamp_text()
	stamp_label.add_theme_color_override("font_color", ThemeLoader.get_stamp_color())

func _process(delta: float) -> void:
	if is_dragging:
		var current_mouse = DisplayServer.mouse_get_position()
		position = drag_start_window + (current_mouse - drag_start_mouse)
		
	if is_resizing:
		var current_mouse = DisplayServer.mouse_get_position()
		var delta_size = current_mouse - resize_start_mouse
		var new_w = clampi(resize_start_size.x + delta_size.x, min_size.x, max_size.x)
		var new_h = clampi(resize_start_size.y + delta_size.y, min_size.y, max_size.y)
		size = Vector2i(new_w, new_h)
		
	if content_dirty:
		auto_save_timer += delta
		if auto_save_timer >= 1.0:
			content_dirty = false
			auto_save_timer = 0.0
			note_updated.emit(note_id, text_edit.text, position, size, media_list)

func _on_header_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				is_dragging = true
				drag_start_mouse = DisplayServer.mouse_get_position()
				drag_start_window = position
			else:
				if is_dragging:
					is_dragging = false
					position_changed.emit(note_id, position, size)

func _on_resize_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				is_resizing = true
				resize_start_mouse = DisplayServer.mouse_get_position()
				resize_start_size = size
			else:
				if is_resizing:
					is_resizing = false
					position_changed.emit(note_id, position, size)

func _on_text_changed() -> void:
	content_dirty = true
	auto_save_timer = 0.0

func _on_pin_pressed() -> void:
	is_pinned = !is_pinned
	always_on_top = is_pinned
	_update_pin_visual()
	note_updated.emit(note_id, text_edit.text, position, size, media_list)

func _update_pin_visual() -> void:
	pin_btn.text = "📌" if is_pinned else "📍"

func _on_archive_pressed() -> void:
	# Trigger stamp slam animation
	stamp_overlay.visible = true
	stamp_overlay.scale = Vector2(2.5, 2.5)
	stamp_overlay.rotation_degrees = -15.0
	stamp_overlay.modulate.a = 0.0
	
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(stamp_overlay, "scale", Vector2(1.0, 1.0), 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(stamp_overlay, "modulate:a", 1.0, 0.15)
	
	tween.chain().tween_interval(0.4)
	tween.chain().tween_property($RootControl, "modulate:a", 0.0, 0.25)
	tween.chain().tween_callback(func():
		note_archived.emit(note_id)
		queue_free()
	)

func _on_close_pressed() -> void:
	var tween = create_tween()
	tween.tween_property($RootControl, "modulate:a", 0.0, 0.15)
	tween.tween_callback(func():
		note_deleted.emit(note_id)
		queue_free()
	)

func _input(event: InputEvent) -> void:
	# Intercept paste on the entire window level before controls consume it
	if event is InputEventKey and event.pressed:
		var is_paste = (event.ctrl_pressed or event.meta_pressed) and event.keycode == KEY_V
		if is_paste:
			if DisplayServer.clipboard_has_image():
				_handle_clipboard_paste()
				get_viewport().set_input_as_handled()

func _on_text_edit_gui_input(event: InputEvent) -> void:
	# Secondary guard for TextEdit focus
	if event is InputEventKey and event.pressed:
		var is_paste = (event.ctrl_pressed or event.meta_pressed) and event.keycode == KEY_V
		if is_paste:
			if DisplayServer.clipboard_has_image():
				_handle_clipboard_paste()
				text_edit.accept_event()

func _handle_clipboard_paste() -> void:
	if not DisplayServer.clipboard_has_image():
		return
	var img = DisplayServer.clipboard_get_image()
	if img != null and not img.is_empty():
		_add_pasted_image(img, true)

func _add_pasted_image(img: Image, should_upload: bool = false) -> void:
	# Keep a sensible display size
	if img.get_width() > 400:
		var ratio = 400.0 / img.get_width()
		img.resize(400, int(img.get_height() * ratio))
	
	var texture = ImageTexture.create_from_image(img)
	var texture_rect = TextureRect.new()
	texture_rect.texture = texture
	texture_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	texture_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	texture_rect.custom_minimum_size = Vector2(0, 140)
	media_container.add_child(texture_rect)
	
	if should_upload:
		_upload_image_and_sync(img)

func _upload_image_and_sync(img: Image) -> void:
	var buffer = img.save_png_to_buffer()
	var b64 = Marshalls.raw_to_base64(buffer)
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, code, _headers, body):
		req.queue_free()
		if code == 200 or code == 201:
			var json = JSON.new()
			if json.parse(body.get_string_from_utf8()) == OK:
				var res_dict = json.data
				if typeof(res_dict) == TYPE_DICTIONARY:
					var filename = res_dict.get("filename", "")
					if filename != "":
						media_list.append(filename)
						note_updated.emit(note_id, text_edit.text, position, size, media_list)
	)
	var payload = JSON.stringify({"data": "data:image/png;base64," + b64})
	var headers = PackedStringArray(["Content-Type: application/json"])
	req.request(PetConfig.get_http_url("/api/notes/media"), headers, HTTPClient.METHOD_POST, payload)

func _load_remote_media(filename: String) -> void:
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, code, _headers, body):
		req.queue_free()
		if code == 200 and body.size() > 0:
			var img = Image.new()
			var err = img.load_png_from_buffer(body)
			if err != OK:
				err = img.load_jpg_from_buffer(body)
			if err == OK:
				_add_pasted_image(img, false)
	)
	req.request(PetConfig.get_http_url("/api/notes/media/") + filename)
