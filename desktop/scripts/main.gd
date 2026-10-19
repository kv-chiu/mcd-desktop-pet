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

# 午休提醒相关变量
var lunch_time: String = "12:00"
var lunch_reminder_enabled: bool = true
var lunch_advance_minutes: int = 10
var last_lunch_reminder_date: String = ""
var time_check_timer: float = 0.0

var lunch_menu: PopupMenu = null
var advance_menu: PopupMenu = null
var custom_time_dialog: ConfirmationDialog = null
var custom_time_edit: LineEdit = null
var custom_advance_dialog: ConfirmationDialog = null
var custom_advance_edit: LineEdit = null
const LUNCH_CONFIG_PATH = "user://lunch_settings.cfg"

const BehaviorController = preload("res://scripts/behavior_controller.gd")
var behavior_ctrl: BehaviorController


func _ready() -> void:
	# Inject window manager into pet
	pet.window_manager = window_mgr
	
	# 初始化行为控制器并挂载
	behavior_ctrl = BehaviorController.new()
	behavior_ctrl.name = "BehaviorController"
	add_child(behavior_ctrl)
	behavior_ctrl.setup(pet, speech_bubble)

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

	_load_lunch_settings()
	_setup_custom_time_dialog()
	_setup_custom_advance_dialog()

	context_menu.id_pressed.connect(_on_menu_item_selected)
	_setup_context_menu()

	# Initial friendly greeting through behavior controller
	behavior_ctrl.request_system_notice("薯条小宝已就绪！今天想去哪散步呢？🍟", 4.0)

func _process(delta: float) -> void:
	if not lunch_reminder_enabled:
		return

	time_check_timer += delta
	if time_check_timer >= 5.0:
		time_check_timer = 0.0
		_check_lunch_reminder()

func _check_lunch_reminder() -> void:
	var now = Time.get_datetime_dict_from_system()
	var current_time_str = "%02d:%02d" % [now.hour, now.minute]
	var today_date_str = "%04d-%02d-%02d" % [now.year, now.month, now.day]

	var remind_time = _calculate_remind_time_str(lunch_time, lunch_advance_minutes)
	if current_time_str == remind_time and last_lunch_reminder_date != today_date_str:
		last_lunch_reminder_date = today_date_str
		_trigger_lunch_reminder(false)

func _gui_input(event: InputEvent) -> void:
	window_mgr.handle_input(event)

func _on_drag_started() -> void:
	# 用户开始拖动窗口时，平稳打断当前自主行走
	pet.interrupt_walk()

func _create_system_font() -> SystemFont:
	var font = SystemFont.new()
	font.font_names = PackedStringArray([
		"Hiragino Sans GB", "Heiti SC", "STHeiti", "PingFang SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "sans-serif"
	])
	var emoji_font = SystemFont.new()
	emoji_font.font_names = PackedStringArray(["Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"])
	font.fallbacks = [emoji_font]
	return font

func _setup_context_menu() -> void:
	var font = _create_system_font()
	context_menu.add_theme_font_override("font", font)

	# 初始化午休设置子菜单（挂载在 context_menu 下）
	if lunch_menu == null:
		lunch_menu = PopupMenu.new()
		lunch_menu.name = "LunchSubmenu"
		context_menu.add_child(lunch_menu)
		lunch_menu.add_theme_font_override("font", font)
		lunch_menu.id_pressed.connect(_on_lunch_menu_item_selected)

	# 初始化提前提醒分钟子菜单（挂载在 lunch_menu 下）
	if advance_menu == null:
		advance_menu = PopupMenu.new()
		advance_menu.name = "AdvanceSubmenu"
		lunch_menu.add_child(advance_menu)
		advance_menu.add_theme_font_override("font", font)
		advance_menu.id_pressed.connect(_on_advance_menu_item_selected)

	context_menu.clear()
	context_menu.add_item("散步走走", 10)
	context_menu.add_item("转身翻转", 11)
	context_menu.add_item("停下休息", 12)
	context_menu.add_separator()
	context_menu.add_item("跳跃", 14)
	context_menu.add_item("挥手", 15)
	context_menu.add_separator()
	
	# 设定午休时间子菜单
	_update_lunch_submenu()
	var lunch_label = _get_lunch_menu_title()
	context_menu.add_submenu_node_item(lunch_label, lunch_menu, 20)
	
	context_menu.add_separator()
	
	# 全屏穿透开关选项
	var fs_enabled = window_mgr.is_fullscreen_overlay_enabled()
	var check_symbol = "✓ " if fs_enabled else "    "
	context_menu.add_item(check_symbol + "在全屏应用中显示桌宠", 13)
	
	context_menu.add_separator()
	context_menu.add_item("打开 Web 控制台", 4)
	context_menu.add_separator()
	context_menu.add_item("退出桌宠", 5)

func _get_lunch_menu_title() -> String:
	if not lunch_reminder_enabled:
		return "设定午休时间 (已关闭)"
	return "设定午休时间 (%s, 提前%d分)" % [lunch_time, lunch_advance_minutes]

func _update_context_menu_lunch_title() -> void:
	var idx_lunch = context_menu.get_item_index(20)
	if idx_lunch != -1:
		context_menu.set_item_text(idx_lunch, _get_lunch_menu_title())

func _update_lunch_submenu() -> void:
	if lunch_menu == null:
		return
	lunch_menu.clear()

	var presets = ["11:30", "12:00", "12:15", "12:30", "13:00"]
	for i in range(presets.size()):
		var t = presets[i]
		var checked = (lunch_reminder_enabled and lunch_time == t)
		var prefix = "✓ " if checked else "    "
		var label = prefix + t + (" (推荐)" if t == "12:00" else "")
		lunch_menu.add_item(label, 100 + i)

	lunch_menu.add_separator()

	var is_custom = lunch_reminder_enabled and not (lunch_time in presets)
	var custom_prefix = "✓ " if is_custom else "    "
	var custom_label = custom_prefix + "自定义时间 (" + lunch_time + ")..." if is_custom else custom_prefix + "自定义时间..."
	lunch_menu.add_item(custom_label, 110)

	lunch_menu.add_separator()

	# 提前时间子菜单
	_update_advance_submenu()
	var adv_label = "提前提醒时间 (提前 %d 分钟) ▶" % lunch_advance_minutes
	lunch_menu.add_submenu_node_item(adv_label, advance_menu, 30)

	lunch_menu.add_separator()
	lunch_menu.add_item("🔔 立即测试午休提醒 (提前 %d 分钟)" % lunch_advance_minutes, 111)

	lunch_menu.add_separator()
	var off_prefix = "✓ " if not lunch_reminder_enabled else "    "
	lunch_menu.add_item(off_prefix + "关闭午休提醒", 120)

func _update_advance_submenu() -> void:
	if advance_menu == null:
		return
	advance_menu.clear()

	var adv_presets = [5, 10, 15, 20, 30]
	for i in range(adv_presets.size()):
		var m = adv_presets[i]
		var checked = (lunch_advance_minutes == m)
		var prefix = "✓ " if checked else "    "
		var label = prefix + "提前 %d 分钟" % m + (" (推荐)" if m == 10 else "")
		advance_menu.add_item(label, 200 + i)

	advance_menu.add_separator()

	var is_custom_adv = not (lunch_advance_minutes in adv_presets)
	var custom_adv_prefix = "✓ " if is_custom_adv else "    "
	var custom_adv_label = custom_adv_prefix + "自定义提前分钟 (%d分钟)..." % lunch_advance_minutes if is_custom_adv else custom_adv_prefix + "自定义提前分钟..."
	advance_menu.add_item(custom_adv_label, 210)

func _on_lunch_menu_item_selected(id: int) -> void:
	match id:
		100:
			_set_lunch_time("11:30", true)
		101:
			_set_lunch_time("12:00", true)
		102:
			_set_lunch_time("12:15", true)
		103:
			_set_lunch_time("12:30", true)
		104:
			_set_lunch_time("13:00", true)
		110:
			_open_custom_time_dialog()
		111:
			_trigger_lunch_reminder(true)
		120:
			_set_lunch_time(lunch_time, false)

func _on_advance_menu_item_selected(id: int) -> void:
	match id:
		200:
			_set_lunch_advance_minutes(5)
		201:
			_set_lunch_advance_minutes(10)
		202:
			_set_lunch_advance_minutes(15)
		203:
			_set_lunch_advance_minutes(20)
		204:
			_set_lunch_advance_minutes(30)
		210:
			_open_custom_advance_dialog()

func _load_lunch_settings() -> void:
	var cfg = ConfigFile.new()
	if cfg.load(LUNCH_CONFIG_PATH) == OK:
		lunch_time = cfg.get_value("lunch", "time", "12:00")
		lunch_reminder_enabled = cfg.get_value("lunch", "enabled", true)
		lunch_advance_minutes = cfg.get_value("lunch", "advance_minutes", 10)

func _save_lunch_settings() -> void:
	var cfg = ConfigFile.new()
	cfg.load(LUNCH_CONFIG_PATH)
	cfg.set_value("lunch", "time", lunch_time)
	cfg.set_value("lunch", "enabled", lunch_reminder_enabled)
	cfg.set_value("lunch", "advance_minutes", lunch_advance_minutes)
	cfg.save(LUNCH_CONFIG_PATH)

func _set_lunch_time(new_time: String, enabled: bool) -> void:
	lunch_time = new_time
	lunch_reminder_enabled = enabled
	_save_lunch_settings()
	_update_lunch_submenu()
	_update_context_menu_lunch_title()

	# 同步给中枢服务持久化
	ws_client.notify_lunch_time_changed(lunch_time, lunch_reminder_enabled, lunch_advance_minutes)

	if enabled:
		var remind_time = _calculate_remind_time_str(lunch_time, lunch_advance_minutes)
		behavior_ctrl.request_menu_action("jump", "午休时间已设为 " + lunch_time + "！\n每天 " + remind_time + " 提前 " + str(lunch_advance_minutes) + " 分钟提醒您点餐~🍟✨", 4.5)
	else:
		behavior_ctrl.request_menu_action("idle", "已关闭午休提醒功能~", 2.5)

func _set_lunch_advance_minutes(m: int) -> void:
	lunch_advance_minutes = m
	_save_lunch_settings()
	_update_lunch_submenu()
	_update_context_menu_lunch_title()

	# 同步给中枢服务持久化
	ws_client.notify_lunch_time_changed(lunch_time, lunch_reminder_enabled, lunch_advance_minutes)

	var remind_time = _calculate_remind_time_str(lunch_time, lunch_advance_minutes)
	behavior_ctrl.request_menu_action("jump", "午休提醒已设为提前 %d 分钟！\n每天 %s 会准时提醒您选餐（午休 %s）~🍟✨" % [lunch_advance_minutes, remind_time, lunch_time], 4.5)

func _calculate_remind_time_str(t: String, adv_min: int = lunch_advance_minutes) -> String:
	var parts = t.split(":")
	if parts.size() < 2:
		return "11:50"
	var hour = int(parts[0])
	var minute = int(parts[1])
	var total_min = hour * 60 + minute - adv_min
	while total_min < 0:
		total_min += 24 * 60
	var r_hour = (total_min / 60) % 24
	var r_min = total_min % 60
	return "%02d:%02d" % [r_hour, r_min]

func _trigger_lunch_reminder(is_test: bool = false) -> void:
	var tag = "【提醒测试】" if is_test else ""
	var speech_text = "%s主人，离午休(%s)还有 %d 分钟啦！忙碌了一上午辛苦啦，该想想中午吃什么咯~🍟" % [tag, lunch_time, lunch_advance_minutes]
	behavior_ctrl.request_reminder(speech_text, "wave", 5.0)

func _setup_custom_time_dialog() -> void:
	custom_time_dialog = ConfirmationDialog.new()
	custom_time_dialog.title = "设定午休时间"
	custom_time_dialog.ok_button_text = "确定"
	custom_time_dialog.cancel_button_text = "取消"
	custom_time_dialog.size = Vector2i(280, 120)

	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)

	var lbl = Label.new()
	lbl.text = "请输入午休时间 (24小时制 HH:MM):"
	vbox.add_child(lbl)

	custom_time_edit = LineEdit.new()
	custom_time_edit.placeholder_text = "例如: 12:15"
	custom_time_edit.text = lunch_time
	vbox.add_child(custom_time_edit)

	custom_time_dialog.add_child(vbox)
	custom_time_dialog.confirmed.connect(_on_custom_time_confirmed)

	var font = _create_system_font()
	custom_time_dialog.add_theme_font_override("font", font)

	add_child(custom_time_dialog)

func _open_custom_time_dialog() -> void:
	if custom_time_dialog:
		custom_time_edit.text = lunch_time
		custom_time_dialog.popup_centered()

func _on_custom_time_confirmed() -> void:
	var text = custom_time_edit.text.strip_edges()
	var regex = RegEx.new()
	regex.compile("^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
	if regex.search(text):
		var parts = text.split(":")
		var formatted = "%02d:%02d" % [int(parts[0]), int(parts[1])]
		_set_lunch_time(formatted, true)
	else:
		behavior_ctrl.request_system_notice("时间格式不对哦，请输入如 12:15 这样的 24 小时制时间~", 3.5)

func _setup_custom_advance_dialog() -> void:
	custom_advance_dialog = ConfirmationDialog.new()
	custom_advance_dialog.title = "设定提前提醒分钟"
	custom_advance_dialog.ok_button_text = "确定"
	custom_advance_dialog.cancel_button_text = "取消"
	custom_advance_dialog.size = Vector2i(280, 120)

	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)

	var lbl = Label.new()
	lbl.text = "请输入提前提醒分钟数 (1 ~ 120 分钟):"
	vbox.add_child(lbl)

	custom_advance_edit = LineEdit.new()
	custom_advance_edit.placeholder_text = "例如: 15"
	custom_advance_edit.text = str(lunch_advance_minutes)
	vbox.add_child(custom_advance_edit)

	custom_advance_dialog.add_child(vbox)
	custom_advance_dialog.confirmed.connect(_on_custom_advance_confirmed)

	var font = _create_system_font()
	custom_advance_dialog.add_theme_font_override("font", font)

	add_child(custom_advance_dialog)

func _open_custom_advance_dialog() -> void:
	if custom_advance_dialog:
		custom_advance_edit.text = str(lunch_advance_minutes)
		custom_advance_dialog.popup_centered()

func _on_custom_advance_confirmed() -> void:
	var text = custom_advance_edit.text.strip_edges()
	if text.is_valid_int():
		var val = int(text)
		if val >= 1 and val <= 120:
			_set_lunch_advance_minutes(val)
			return
	behavior_ctrl.request_system_notice("请输入 1 到 120 之间的有效分钟数哦~", 3.5)

func _on_menu_item_selected(id: int) -> void:
	match id:
		10:
			behavior_ctrl.request_menu_action("walk", "迈开小短腿，出发去散步咯~ 🚶", 2.5)
		11:
			var new_dir = -pet.facing_direction
			behavior_ctrl.request_menu_action("flip", "唰！纸片小翻身~✨", 2.0, new_dir)
		12:
			behavior_ctrl.request_menu_action("stop_walk", "原地立正休息一下~🍟", 2.0)
		14:
			behavior_ctrl.request_menu_action("jump", "好耶！起飞跳跃~✨", 2.0)
		15:
			behavior_ctrl.request_menu_action("wave", "嗨嗨！挥挥小手打招呼~🍟", 2.0)
		13:
			var new_state = not window_mgr.is_fullscreen_overlay_enabled()
			window_mgr.set_show_over_fullscreen(new_state)
			if new_state:
				behavior_ctrl.request_menu_action("idle", "已开启全屏穿透！全屏应用下也能看到我啦~🍟✨", 3.5)
			else:
				behavior_ctrl.request_menu_action("idle", "已关闭全屏穿透，恢复普通窗口模式~", 2.5)
		4:
			OS.shell_open("http://localhost:8080")
		5:
			get_tree().quit()

func _on_open_context_menu(screen_pos: Vector2i) -> void:
	var idx_fs = context_menu.get_item_index(13)
	if idx_fs != -1:
		var fs_enabled = window_mgr.is_fullscreen_overlay_enabled()
		var check_symbol = "✓ " if fs_enabled else "    "
		context_menu.set_item_text(idx_fs, check_symbol + "在全屏应用中显示桌宠")

	_update_lunch_submenu()
	_update_context_menu_lunch_title()

	context_menu.position = screen_pos
	context_menu.popup()

func _on_pet_clicked() -> void:
	var quote = random_quotes[randi() % random_quotes.size()]
	behavior_ctrl.request_user_click(quote)
	ws_client.notify_pet_clicked()

func _on_ws_connected() -> void:
	behavior_ctrl.request_system_notice("已连接麦当劳中枢服务~🟢", 2.5)

func _on_ws_disconnected() -> void:
	behavior_ctrl.request_system_notice("中枢服务已断开，重连中...", 2.5, true)

func _on_pet_action_received(action: String, duration: float, speech: String, _sound: String) -> void:
	behavior_ctrl.request_remote_action(action, duration, speech)

func _on_pet_speech_received(text: String, duration: float) -> void:
	behavior_ctrl.request_remote_speech(text, duration)

func _on_pet_state_received(_state: Dictionary) -> void:
	pass
