class_name NoteManager
extends Node

const NoteWindowScene = preload("res://scenes/note_window.tscn")
const NoteWindow = preload("res://scripts/note_window.gd")
const ThemeLoader = preload("res://scripts/theme_loader.gd")

var active_notes: Dictionary = {} # id -> NoteWindow
var server_base_url: String = PetConfig.get_http_base_url()
var ws_client: PetWsClient = null
var http_request: HTTPRequest = null

func setup(client: PetWsClient) -> void:
	ws_client = client
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_http_completed)
	
	fetch_active_notes()

func fetch_active_notes() -> void:
	var err = http_request.request(server_base_url + "/api/notes?status=active")
	if err != OK:
		print("[NoteManager] Failed to request active notes: ", err)

func _on_http_completed(_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if response_code != 200:
		return
		
	var json = JSON.new()
	if json.parse(body.get_string_from_utf8()) == OK:
		var data = json.data
		if typeof(data) == TYPE_ARRAY:
			for item in data:
				if typeof(item) == TYPE_DICTIONARY:
					spawn_note(item)

func spawn_note(note_data: Dictionary) -> NoteWindow:
	var id = note_data.get("id", "")
	if id == "" or active_notes.has(id):
		return active_notes.get(id, null)
		
	var window = NoteWindowScene.instantiate() as NoteWindow
	add_child(window)
	
	active_notes[id] = window
	window.setup_note(note_data)
	
	# Connect signals
	window.position_changed.connect(_on_note_position_changed)
	window.note_updated.connect(_on_note_content_updated)
	window.note_archived.connect(_on_note_archived_locally)
	window.note_deleted.connect(_on_note_deleted_locally)
	
	window.show()
	return window

func remove_note(id: String) -> void:
	if active_notes.has(id):
		var win = active_notes[id]
		active_notes.erase(id)
		if is_instance_valid(win):
			win.queue_free()

func apply_theme_all() -> void:
	for id in active_notes:
		var win = active_notes[id]
		if is_instance_valid(win):
			win.apply_theme()

func set_all_visible(visible: bool) -> void:
	for id in active_notes:
		var win = active_notes[id]
		if is_instance_valid(win):
			win.visible = visible

func _on_note_position_changed(id: String, pos: Vector2i, size: Vector2i) -> void:
	if ws_client:
		ws_client.send_dict({
			"type": "note_position_sync",
			"timestamp": Time.get_datetime_string_from_system(),
			"payload": {
				"id": id,
				"position": [pos.x, pos.y],
				"size": [size.x, size.y]
			}
		})

func _on_note_content_updated(id: String, content: String, pos: Vector2i, size: Vector2i, media: Array) -> void:
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, _code, _h, _b):
		req.queue_free()
	)
	var body_dict = {
		"content": content,
		"position": [pos.x, pos.y],
		"size": [size.x, size.y],
		"media": media
	}
	var headers = PackedStringArray(["Content-Type: application/json"])
	req.request(server_base_url + "/api/notes/" + id, headers, HTTPClient.METHOD_PUT, JSON.stringify(body_dict))

func _on_note_archived_locally(id: String) -> void:
	active_notes.erase(id)
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, _code, _h, _b):
		req.queue_free()
	)
	req.request(server_base_url + "/api/notes/" + id + "/archive", PackedStringArray(), HTTPClient.METHOD_POST, "")

func _on_note_deleted_locally(id: String) -> void:
	active_notes.erase(id)
	var req = HTTPRequest.new()
	add_child(req)
	req.request_completed.connect(func(_res, _code, _h, _b):
		req.queue_free()
	)
	req.request(server_base_url + "/api/notes/" + id, PackedStringArray(), HTTPClient.METHOD_DELETE, "")
