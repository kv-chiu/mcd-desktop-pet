extends Control

@onready var pet: DesktopPet = $Pet
@onready var speech_bubble: Control = $SpeechBubble
@onready var ws_client: Node = $WsClient
@onready var window_mgr: WindowManager = $WindowManager
@onready var context_menu: PopupMenu = $ContextMenu

var random_quotes = [
	"热乎乎的薯条出炉啦！🍟",
	"主人摸摸头，今天也要元气满满鸭！✨",
	"走走散散步，肚子消化了又想吃麦辣鸡翅~🍗",
	"薯条小宝随叫随到！有什么麦麦优惠吗？🍟",
	"咔嚓咔嚓，香脆每一天！😋"
]

func _ready() -> void:
	# Inject window manager into pet
	pet.window_manager = window_mgr
	
	# Connect window manager input & drag events
	window_mgr.pet_clicked.connect(_on_pet_clicked)
	window_mgr.open_context_menu.connect(_on_open_context_menu)
	window_mgr.drag_started.connect(_on_drag_started)

	# Connect WebSocket events
	ws_client.connected.connect(_on_ws_connected)
	ws_client.disconnected.connect(_on_ws_disconnected)
	ws_client.pet_action_received.connect(_on_pet_action_received)
	ws_client.pet_speech_received.connect(_on_pet_speech_received)
	ws_client.pet_state_received.connect(_on_pet_state_received)

	context_menu.id_pressed.connect(_on_menu_item_selected)
	_setup_context_menu()

	# Initial friendly greeting
	speech_bubble.show_speech("薯条小宝已就绪！今天想去哪散步呢？🍟", 4.0)

func _gui_input(event: InputEvent) -> void:
	window_mgr.handle_input(event)

func _on_drag_started() -> void:
	# 用户开始拖动窗口时，平稳打断当前自主行走
	pet.interrupt_walk()

func _setup_context_menu() -> void:
	var font = SystemFont.new()
	font.font_names = PackedStringArray([
		"Hiragino Sans GB", "Heiti SC", "STHeiti", "PingFang SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "sans-serif"
	])
	var emoji_font = SystemFont.new()
	emoji_font.font_names = PackedStringArray(["Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"])
	font.fallbacks = [emoji_font]
	context_menu.add_theme_font_override("font", font)

	context_menu.clear()
	context_menu.add_item("散步走走", 10)
	context_menu.add_item("转身翻转", 11)
	context_menu.add_item("停下休息", 12)
	context_menu.add_separator()
	
	# 全屏穿透开关选项
	var fs_enabled = window_mgr.is_fullscreen_overlay_enabled()
	var check_symbol = "✓ " if fs_enabled else "    "
	context_menu.add_item(check_symbol + "在全屏应用中显示桌宠", 13)
	
	context_menu.add_separator()
	context_menu.add_item("打开 Web 控制台", 4)
	context_menu.add_separator()
	context_menu.add_item("退出桌宠", 5)

func _on_menu_item_selected(id: int) -> void:
	match id:
		10:
			pet.start_random_walk()
			speech_bubble.show_speech("迈开小短腿，出发去散步咯~ 🚶", 2.5)
		11:
			var new_dir = -pet.facing_direction
			pet.paper_flip(new_dir)
			speech_bubble.show_speech("唰！纸片小翻身~✨", 2.0)
		12:
			pet.stop_walk()
			speech_bubble.show_speech("原地立正休息一下~🍟", 2.0)
		13:
			var new_state = not window_mgr.is_fullscreen_overlay_enabled()
			window_mgr.set_show_over_fullscreen(new_state)
			if new_state:
				speech_bubble.show_speech("已开启全屏穿透！全屏应用下也能看到我啦~🍟✨", 3.5)
			else:
				speech_bubble.show_speech("已关闭全屏穿透，恢复普通窗口模式~", 2.5)
		4:
			OS.shell_open("http://localhost:8080")
		5:
			get_tree().quit()

func _on_open_context_menu(screen_pos: Vector2i) -> void:
	var idx = context_menu.get_item_index(13)
	if idx != -1:
		var fs_enabled = window_mgr.is_fullscreen_overlay_enabled()
		var check_symbol = "✓ " if fs_enabled else "    "
		context_menu.set_item_text(idx, check_symbol + "在全屏应用中显示桌宠")
	context_menu.position = screen_pos
	context_menu.popup()

func _on_pet_clicked() -> void:
	ws_client.notify_pet_clicked()
	pet.play_click_bounce()
	var quote = random_quotes[randi() % random_quotes.size()]
	speech_bubble.show_speech(quote, 3.0)

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
