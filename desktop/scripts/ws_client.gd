class_name PetWsClient
extends Node

signal connected
signal disconnected
signal pet_action_received(action: String, duration: float, speech: String, sound: String)
signal pet_speech_received(text: String, duration: float)
signal pet_state_received(state: Dictionary)

var socket: WebSocketPeer = WebSocketPeer.new()
var is_socket_connected: bool = false
var reconnect_timer: float = 0.0
var server_url: String = "ws://127.0.0.1:3001/ws"

func _ready() -> void:
	connect_to_server()

func connect_to_server() -> void:
	socket.close()
	is_socket_connected = false
	var err = socket.connect_to_url(server_url)
	if err != OK:
		print("[PetWsClient] Connect error: ", err)

func _process(delta: float) -> void:
	socket.poll()
	var state = socket.get_ready_state()

	if state == WebSocketPeer.STATE_OPEN:
		if not is_socket_connected:
			is_socket_connected = true
			reconnect_timer = 0.0
			print("[PetWsClient] Connected to server: ", server_url)
			_send_identify()
			connected.emit()

		while socket.get_available_packet_count() > 0:
			var packet = socket.get_packet()
			var text = packet.get_string_from_utf8()
			_handle_message(text)

	elif state == WebSocketPeer.STATE_CLOSED:
		if is_socket_connected:
			is_socket_connected = false
			print("[PetWsClient] Disconnected from server")
			disconnected.emit()

		reconnect_timer += delta
		if reconnect_timer >= 3.0:
			reconnect_timer = 0.0
			print("[PetWsClient] Attempting to reconnect...")
			connect_to_server()

func _send_identify() -> void:
	var msg = {
		"type": "identify",
		"timestamp": Time.get_datetime_string_from_system(),
		"payload": {
			"client": "desktop"
		}
	}
	send_dict(msg)

func send_dict(data: Dictionary) -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		var json_str = JSON.stringify(data)
		socket.send_text(json_str)

func notify_pet_clicked() -> void:
	var msg = {
		"type": "pet_click",
		"timestamp": Time.get_datetime_string_from_system()
	}
	send_dict(msg)

func notify_lunch_time_changed(new_time: String, enabled: bool, advance_min: int = 10) -> void:
	var msg = {
		"type": "set_lunch_time",
		"timestamp": Time.get_datetime_string_from_system(),
		"payload": {
			"time": new_time,
			"enabled": enabled,
			"advanceMinutes": advance_min
		}
	}
	send_dict(msg)

func _handle_message(raw_json: String) -> void:
	var json = JSON.new()
	var err = json.parse(raw_json)
	if err != OK:
		print("[PetWsClient] JSON Parse error: ", json.get_error_message())
		return

	var data = json.data
	if typeof(data) != TYPE_DICTIONARY:
		return

	var msg_type = data.get("type", "")
	var payload = data.get("payload", {})

	match msg_type:
		"pet_action":
			var action = payload.get("action", "idle")
			var duration = float(payload.get("duration", 3.0))
			var speech = str(payload.get("speech", ""))
			var sound = str(payload.get("sound", ""))
			pet_action_received.emit(action, duration, speech, sound)

		"pet_speech":
			var text = str(payload.get("text", ""))
			var duration = float(payload.get("duration", 4.0))
			pet_speech_received.emit(text, duration)

		"pet_state_update":
			if typeof(payload) == TYPE_DICTIONARY:
				pet_state_received.emit(payload)

		"pong":
			pass
