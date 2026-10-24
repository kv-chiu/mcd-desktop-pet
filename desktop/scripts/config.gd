class_name PetConfig
extends RefCounted

const DEFAULT_HOST: String = "127.0.0.1"
const DEFAULT_PORT_STR: String = "23301"
const DEFAULT_PORT: int = 23301

static var server_host: String = DEFAULT_HOST
static var server_port: int = DEFAULT_PORT
static var pet_scale: float = 1.0
static var _config_initialized: bool = false

static func _ensure_config() -> void:
	if _config_initialized:
		return
	_config_initialized = true
	
	# 1. Environment variable override
	var env_port = OS.get_environment("MCD_PORT")
	if env_port == "":
		env_port = OS.get_environment("MCD_SERVER_PORT")
	if env_port != "" and env_port.is_valid_int():
		server_port = int(env_port)
		
	var env_host = OS.get_environment("MCD_HOST")
	if env_host == "":
		env_host = OS.get_environment("MCD_SERVER_HOST")
	if env_host != "":
		server_host = env_host

	var home_dir = OS.get_environment("HOME")
	if OS.get_name() == "Windows":
		home_dir = OS.get_environment("USERPROFILE")
	if home_dir != "":
		# 2. Check runtime server.port file (~/.mcd-desktop-pet/run/server.port)
		var port_file_path = home_dir.path_join(".mcd-desktop-pet").path_join("run").path_join("server.port")
		if FileAccess.file_exists(port_file_path):
			var port_file = FileAccess.open(port_file_path, FileAccess.READ)
			if port_file:
				var content = port_file.get_as_text().strip_edges()
				if content.is_valid_int() and int(content) > 0:
					server_port = int(content)
					return

		# 3. Local config.json override (~/.mcd-desktop-pet/config.json)
		var config_path = home_dir.path_join(".mcd-desktop-pet").path_join("config.json")
		if FileAccess.file_exists(config_path):
			var file = FileAccess.open(config_path, FileAccess.READ)
			if file:
				var json = JSON.new()
				if json.parse(file.get_as_text()) == OK and typeof(json.data) == TYPE_DICTIONARY:
					if json.data.has("port") and typeof(json.data["port"]) in [TYPE_INT, TYPE_FLOAT]:
						var p = int(json.data["port"])
						if p > 0 and p != 3001:
							server_port = p
					if json.data.has("pet_scale") and typeof(json.data["pet_scale"]) in [TYPE_INT, TYPE_FLOAT]:
						var s = float(json.data["pet_scale"])
						if s >= 0.5 and s <= 2.0:
							pet_scale = s
					elif json.data.has("scale") and typeof(json.data["scale"]) in [TYPE_INT, TYPE_FLOAT]:
						var s = float(json.data["scale"])
						if s >= 0.5 and s <= 2.0:
							pet_scale = s

static func get_host() -> String:
	_ensure_config()
	return server_host

static func get_port() -> int:
	_ensure_config()
	return server_port

static func get_pet_scale() -> float:
	_ensure_config()
	return pet_scale

static func set_pet_scale(s: float) -> void:
	_ensure_config()
	pet_scale = clampf(s, 0.5, 2.0)

static func get_http_base_url() -> String:
	_ensure_config()
	return "http://%s:%d" % [server_host, server_port]

static func get_http_url(path: String = "") -> String:
	_ensure_config()
	if path == "":
		return get_http_base_url()
	if not path.begins_with("/"):
		path = "/" + path
	return get_http_base_url() + path

static func get_ws_url() -> String:
	_ensure_config()
	return "ws://%s:%d/ws" % [server_host, server_port]

# Backward compatibility constants
const SERVER_HOST: String = DEFAULT_HOST
const SERVER_PORT: int = DEFAULT_PORT
const SERVER_HTTP_URL: String = "http://" + DEFAULT_HOST + ":" + DEFAULT_PORT_STR
const SERVER_WS_URL: String = "ws://" + DEFAULT_HOST + ":" + DEFAULT_PORT_STR + "/ws"
const CONSOLE_URL: String = SERVER_HTTP_URL

const WINDOW_WIDTH: int = 320
const WINDOW_HEIGHT: int = 320

const RECONNECT_INTERVAL: float = 3.0
const SPEECH_DEFAULT_DURATION: float = 4.0

