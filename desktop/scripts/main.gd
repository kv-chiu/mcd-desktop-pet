extends Control

@onready var pet: DesktopPet = $Pet
@onready var speech_bubble: Control = $SpeechBubble
@onready var ws_client: PetWsClient = $WsClient
@onready var window_mgr: WindowManager = $WindowManager
const ThemeLoader = preload("res://scripts/theme_loader.gd")
const NoteManager = preload("res://scripts/note_manager.gd")
const ThemedContextMenu = preload("res://scripts/context_menu.gd")

var behavior_ctrl: BehaviorController
var note_mgr: Node = null
var context_menu: ThemedContextMenu = null
var is_desktop_visible: bool = true
var pet_container: Control = null

func _ready() -> void:
	# Wrap pet and speech bubble inside a dedicated container so they can be scaled
	# without changing root viewport stretch, ensuring context menus and subwindows
	# always remain at crisp 100% standard size and perfect readability.
	pet_container = Control.new()
	pet_container.name = "PetContainer"
	pet_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(pet_container)
	pet.reparent(pet_container)
	speech_bubble.reparent(pet_container)

	pet.window_manager = window_mgr
	
	behavior_ctrl = BehaviorController.new()
	behavior_ctrl.name = "BehaviorController"
	add_child(behavior_ctrl)
	behavior_ctrl.setup(pet, speech_bubble)

	# Initialize NoteManager
	note_mgr = NoteManager.new()
	note_mgr.name = "NoteManager"
	add_child(note_mgr)
	note_mgr.setup(ws_client)

	# Initialize ThemedContextMenu
	context_menu = ThemedContextMenu.new()
	context_menu.name = "ThemedContextMenu"
	add_child(context_menu)
	context_menu.action_triggered.connect(_on_menu_action)

	window_mgr.pet_clicked.connect(_on_pet_clicked)
	window_mgr.open_context_menu.connect(_on_open_context_menu)
	window_mgr.drag_started.connect(_on_drag_started)

	ws_client.connected.connect(_on_ws_connected)
	ws_client.disconnected.connect(_on_ws_disconnected)
	ws_client.pet_action_received.connect(_on_pet_action_received)
	ws_client.pet_speech_received.connect(_on_pet_speech_received)
	ws_client.pet_state_received.connect(_on_pet_state_received)

	# Connect Theme, Visibility, Scale, and Notes signals
	ws_client.theme_changed.connect(_on_theme_changed)
	ws_client.visibility_changed.connect(_on_visibility_changed)
	ws_client.pet_scale_changed.connect(_on_pet_scale_changed)
	ws_client.note_created.connect(_on_note_created)
	ws_client.note_archived.connect(_on_note_archived)
	ws_client.note_deleted.connect(_on_note_deleted)
	ws_client.note_restored.connect(_on_note_restored)

	window_mgr.scale_requested.connect(_on_scale_requested)

	# Keep root content_scale_mode DISABLED so all popups and context menus
	# stay at crisp, standard 100% desktop scale and readability.
	get_tree().root.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	get_tree().root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_IGNORE

	var init_scale = PetConfig.get_pet_scale()
	if init_scale != 1.0:
		window_mgr.apply_scale(init_scale, false)
		pet_container.scale = Vector2(init_scale, init_scale)

	# Initialize mouse passthrough matching pet entity (no air wall)
	update_passthrough()
	speech_bubble.bubble_opened.connect(update_passthrough)
	speech_bubble.bubble_closed.connect(update_passthrough)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_IN:
		if not is_desktop_visible:
			_toggle_visibility()

func _gui_input(event: InputEvent) -> void:
	window_mgr.handle_input(event)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey:
		window_mgr.handle_key_input(event)

func _on_drag_started() -> void:
	pet.interrupt_walk()

func _on_open_context_menu(screen_pos: Vector2i) -> void:
	if not is_desktop_visible:
		return
	context_menu.position = screen_pos
	context_menu.popup()

func _on_menu_action(action: String) -> void:
	match action:
		"new_note":
			_request_create_note()
		"history":
			OS.shell_open(PetConfig.get_http_base_url())
		"toggle_theme":
			_toggle_theme()
		"toggle_visibility":
			_toggle_visibility()
		"settings":
			OS.shell_open(PetConfig.get_http_base_url() + "?openSettings=1")
		"exit":
			_request_exit()

func _request_exit() -> void:
	visible = false
	if note_mgr:
		note_mgr.set_all_visible(false)
	var req = HTTPRequest.new()
	add_child(req)
	var has_quit = false
	var do_quit = func():
		if not has_quit:
			has_quit = true
			get_tree().quit()
	req.request_completed.connect(func(_res, _code, _h, _b):
		do_quit.call()
	)
	var err = req.request(PetConfig.get_http_url("/api/system/exit"), PackedStringArray(), HTTPClient.METHOD_POST, "")
	if err != OK:
		do_quit.call()
	else:
		get_tree().create_timer(0.25).timeout.connect(func():
			do_quit.call()
		)

func _request_create_note() -> void:
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, _code, _h, _b):
		req.queue_free()
	)
	var body = JSON.stringify({
		"title": "新建便签",
		"content": "记录一下灵感或待办事项~📝"
	})
	var headers = PackedStringArray(["Content-Type: application/json"])
	req.request(PetConfig.get_http_url("/api/notes"), headers, HTTPClient.METHOD_POST, body)
	behavior_ctrl.request_menu_action("wave", "好的！新便签已经贴到桌面上啦~📝✨", 3.0)

func _toggle_theme() -> void:
	var next_theme = "pure" if ThemeLoader.get_theme() == "mcdonalds" else "mcdonalds"
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, _code, _h, _b):
		req.queue_free()
	)
	var body = JSON.stringify({"theme": next_theme})
	var headers = PackedStringArray(["Content-Type: application/json"])
	req.request(PetConfig.get_http_url("/api/config/theme"), headers, HTTPClient.METHOD_POST, body)

func _toggle_visibility() -> void:
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, _code, _h, _b):
		req.queue_free()
	)
	req.request(PetConfig.get_http_url("/api/pet/visibility/toggle"), PackedStringArray(), HTTPClient.METHOD_POST, "")

func _on_pet_clicked() -> void:
	ws_client.notify_pet_clicked()

func _on_ws_connected() -> void:
	pass

func _on_ws_disconnected() -> void:
	behavior_ctrl.request_system_notice("中枢服务已断开，重连中...", 2.5, true)

func _on_pet_action_received(action: String, duration: float, speech: String, _sound: String) -> void:
	behavior_ctrl.request_remote_action(action, duration, speech)

func _on_pet_speech_received(text: String, duration: float) -> void:
	behavior_ctrl.request_remote_speech(text, duration)

func _on_pet_state_received(state: Dictionary) -> void:
	var is_vis = state.get("visible", true)
	_on_visibility_changed(is_vis)

func _on_theme_changed(new_theme: String) -> void:
	ThemeLoader.set_theme(new_theme)
	context_menu.set_theme_name(new_theme)
	if note_mgr:
		note_mgr.apply_theme_all()
	var theme_msg = "已切换为【麦当劳小票】限定主题🍟" if new_theme == "mcdonalds" else "已切换为【极简纯净】办公主题📋"
	behavior_ctrl.request_system_notice(theme_msg, 2.5)

func _on_visibility_changed(is_vis: bool) -> void:
	is_desktop_visible = is_vis
	pet.visible = is_vis
	speech_bubble.visible = is_vis
	if note_mgr:
		note_mgr.set_all_visible(is_vis)
	update_passthrough()

func _on_note_created(data: Dictionary) -> void:
	if note_mgr:
		note_mgr.spawn_note(data)

func _on_note_archived(data: Dictionary) -> void:
	var id = data.get("id", "")
	if note_mgr and id != "":
		note_mgr.remove_note(id)

func _on_note_deleted(id: String) -> void:
	if note_mgr and id != "":
		note_mgr.remove_note(id)

func _on_note_restored(data: Dictionary) -> void:
	if note_mgr:
		note_mgr.spawn_note(data)

var _save_scale_timer: Timer = null

func _on_scale_requested(new_scale: float) -> void:
	_apply_scale_internal(new_scale, true)

func _on_pet_scale_changed(new_scale: float) -> void:
	_apply_scale_internal(new_scale, false)

func _apply_scale_internal(new_scale: float, notify_server: bool) -> void:
	new_scale = clampf(new_scale, 0.5, 2.0)
	var rounded_scale = snappedf(new_scale, 0.05)
	if abs(window_mgr.current_scale - rounded_scale) < 0.01:
		return

	window_mgr.apply_scale(rounded_scale, true)
	if pet_container:
		pet_container.scale = Vector2(rounded_scale, rounded_scale)
	PetConfig.set_pet_scale(rounded_scale)
	update_passthrough()
	if notify_server:
		_debounce_save_scale(rounded_scale)

func _debounce_save_scale(_s: float) -> void:
	if _save_scale_timer == null:
		_save_scale_timer = Timer.new()
		_save_scale_timer.one_shot = true
		_save_scale_timer.wait_time = 0.35
		add_child(_save_scale_timer)
		_save_scale_timer.timeout.connect(func():
			ws_client.notify_pet_scale_changed(window_mgr.current_scale)
		)
	_save_scale_timer.start(0.35)

func update_passthrough() -> void:
	if not is_desktop_visible:
		DisplayServer.window_set_mouse_passthrough(PackedVector2Array([
			Vector2(-10, -10), Vector2(-5, -10), Vector2(-5, -5), Vector2(-10, -5)
		]))
		return
	
	# Clean 8-point symmetrical contour closely matching pet sprite entity (no air wall!)
	var pet_poly = PackedVector2Array([
		Vector2(100, 60),
		Vector2(220, 60),
		Vector2(245, 120),
		Vector2(240, 250),
		Vector2(220, 290),
		Vector2(100, 290),
		Vector2(80, 250),
		Vector2(75, 120)
	])
	
	if speech_bubble and speech_bubble.visible and speech_bubble.modulate.a > 0.05:
		var b_pos = speech_bubble.position
		var b_size = speech_bubble.size
		var bubble_poly = PackedVector2Array([
			b_pos,
			Vector2(b_pos.x + b_size.x, b_pos.y),
			Vector2(b_pos.x + b_size.x, b_pos.y + b_size.y),
			Vector2(b_pos.x, b_pos.y + b_size.y)
		])
		var merged = Geometry2D.merge_polygons(pet_poly, bubble_poly)
		if merged.size() > 0:
			pet_poly = merged[0]

	var cur_scale = window_mgr.current_scale if window_mgr else 1.0
	var scaled_poly = PackedVector2Array()
	for pt in pet_poly:
		scaled_poly.append(pt * cur_scale)
			
	DisplayServer.window_set_mouse_passthrough(scaled_poly)
