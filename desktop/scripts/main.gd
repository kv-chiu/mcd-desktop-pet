extends Control

@onready var pet: Node2D = $Pet
@onready var speech_bubble: Control = $SpeechBubble
@onready var ws_client: Node = $WsClient
@onready var window_mgr: Node = $WindowManager
@onready var context_menu: PopupMenu = $ContextMenu

func _ready() -> void:
	# Connect window manager input & clicks
	window_mgr.pet_clicked.connect(_on_pet_clicked)
	window_mgr.open_context_menu.connect(_on_open_context_menu)

	# Connect WebSocket events
	ws_client.connected.connect(_on_ws_connected)
	ws_client.disconnected.connect(_on_ws_disconnected)
	ws_client.pet_action_received.connect(_on_pet_action_received)
	ws_client.pet_speech_received.connect(_on_pet_speech_received)
	ws_client.pet_state_received.connect(_on_pet_state_received)

	_setup_context_menu()

	# Initial friendly greeting
	speech_bubble.show_speech("麦麦桌宠已就绪！今天想吃点什么呢？🍟", 4.0)

func _gui_input(event: InputEvent) -> void:
	window_mgr.handle_input(event)

func _setup_context_menu() -> void:
	context_menu.clear()
	context_menu.add_item("🍔 喂食汉堡", 0)
	context_menu.add_item("🥤 喝冰可乐", 1)
	context_menu.add_item("🎉 麦麦庆祝", 2)
	context_menu.add_item("😴 睡觉休息", 3)
	context_menu.add_separator()
	context_menu.add_item("💻 打开 Web 控制台", 4)
	context_menu.add_separator()
	context_menu.add_item("❌ 退出桌宠", 5)

	context_menu.id_pressed.connect(_on_menu_item_selected)

func _on_menu_item_selected(id: int) -> void:
	match id:
		0:
			pet.play_action_by_name("eat_burger", 3.5)
			speech_bubble.show_speech("麦辣鸡腿堡大口嚼！真香~🍔", 3.0)
		1:
			pet.play_action_by_name("drink_coke", 3.5)
			speech_bubble.show_speech("冰爽可乐吨吨吨！元气满满~🥤", 3.0)
		2:
			pet.play_action_by_name("celebrate", 3.0)
			speech_bubble.show_speech("好耶！麦麦大获全胜！🎉", 3.0)
		3:
			pet.play_action_by_name("sleep", 5.0)
			speech_bubble.show_speech("小憩一下，Zzz...", 2.5)
		4:
			OS.shell_open("http://localhost:8080")
		5:
			get_tree().quit()

func _on_open_context_menu(screen_pos: Vector2i) -> void:
	context_menu.position = screen_pos
	context_menu.popup()

func _on_pet_clicked() -> void:
	ws_client.notify_pet_clicked()
	pet.play_action_by_name("celebrate", 2.0)
	speech_bubble.show_speech("主人摸摸头，今天也要开心鸭！✨", 3.0)

func _on_ws_connected() -> void:
	speech_bubble.show_speech("已连接麦当劳中枢服务~🟢", 2.5)

func _on_ws_disconnected() -> void:
	speech_bubble.show_speech("中枢服务已断开，重连中...", 2.5)

func _on_pet_action_received(action: String, duration: float, speech: String, _sound: String) -> void:
	pet.play_action_by_name(action, duration)
	if not speech.is_empty():
		speech_bubble.show_speech(speech, duration)

func _on_pet_speech_received(text: String, duration: float) -> void:
	speech_bubble.show_speech(text, duration)

func _on_pet_state_received(state: Dictionary) -> void:
	var mood = state.get("mood", "happy")
	if mood == "hungry":
		speech_bubble.show_speech("肚子咕咕叫了，想吃麦麦汉堡~🍔", 3.5)
