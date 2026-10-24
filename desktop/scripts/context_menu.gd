class_name ThemedContextMenu
extends PopupMenu

signal action_triggered(action_name: String)

enum MenuID {
	NEW_NOTE = 1,
	HISTORY = 2,
	TOGGLE_THEME = 3,
	TOGGLE_VISIBILITY = 4,
	SETTINGS = 5,
	EXIT = 6
}

var current_theme_name: String = "mcdonalds"

func _ready() -> void:
	content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	content_scale_factor = 1.0
	id_pressed.connect(_on_id_pressed)
	rebuild_menu()

func set_theme_name(t: String) -> void:
	current_theme_name = t
	rebuild_menu()

func rebuild_menu() -> void:
	clear()
	content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	content_scale_factor = 1.0
	
	# Core items
	add_item("📝 新建便利贴          Ctrl+N", MenuID.NEW_NOTE)
	add_item("📦 历史便签盒          Ctrl+B", MenuID.HISTORY)
	
	add_separator()
	
	var theme_display = "麦当劳" if current_theme_name == "mcdonalds" else "纯净"
	add_item("🎨 切换外观主题 (当前: " + theme_display + ")", MenuID.TOGGLE_THEME)
	add_item("👁️ 显示 / 隐藏桌面全部内容", MenuID.TOGGLE_VISIBILITY)
	add_item("⚙️ 偏好设置", MenuID.SETTINGS)
	
	add_separator()
	
	add_item("🚪 退出", MenuID.EXIT)
	
	_apply_menu_theme()

func _apply_menu_theme() -> void:
	var font = SystemFont.new()
	font.font_names = PackedStringArray([
		"Hiragino Sans GB", "Heiti SC", "STHeiti", "PingFang SC", "Microsoft YaHei", "sans-serif"
	])
	var emoji_font = SystemFont.new()
	emoji_font.font_names = PackedStringArray(["Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"])
	font.fallbacks = [emoji_font]
	add_theme_font_override("font", font)
	add_theme_font_size_override("font_size", 14)
	add_theme_constant_override("v_separation", 6)
	add_theme_constant_override("item_start_padding", 10)
	add_theme_constant_override("item_end_padding", 10)
	
	# Color styling based on theme
	if current_theme_name == "mcdonalds":
		add_theme_color_override("font_color", Color("#27251F"))
		add_theme_color_override("font_hover_color", Color("#DA291C"))
		add_theme_color_override("font_disabled_color", Color("#DA291C"))
	else:
		add_theme_color_override("font_color", Color("#1F2937"))
		add_theme_color_override("font_hover_color", Color("#3B82F6"))
		add_theme_color_override("font_disabled_color", Color("#64748B"))

func _on_id_pressed(id: int) -> void:
	match id:
		MenuID.NEW_NOTE:
			action_triggered.emit("new_note")
		MenuID.HISTORY:
			action_triggered.emit("history")
		MenuID.TOGGLE_THEME:
			action_triggered.emit("toggle_theme")
		MenuID.TOGGLE_VISIBILITY:
			action_triggered.emit("toggle_visibility")
		MenuID.SETTINGS:
			action_triggered.emit("settings")
		MenuID.EXIT:
			action_triggered.emit("exit")
