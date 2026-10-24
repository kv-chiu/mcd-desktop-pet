class_name ThemeLoader
extends RefCounted

const THEME_MCDONALDS = "mcdonalds"
const THEME_PURE = "pure"

static var current_theme: String = THEME_MCDONALDS

# Theme Visual Tokens
static func get_theme() -> String:
	return current_theme

static func set_theme(theme_name: String) -> void:
	if theme_name != THEME_MCDONALDS and theme_name != THEME_PURE:
		theme_name = THEME_MCDONALDS
	current_theme = theme_name

# Background colors
static func get_note_bg_color() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#FFFDF8") # Warm thermal paper off-white
	else:
		return Color("#FFFFFF") # Modern clean white

# Header background / accent
static func get_header_bg_color() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#FAF6EC")
	else:
		return Color("#F8FAFC")

# Text primary
static func get_text_primary() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#27251F") # Receipt ink black
	else:
		return Color("#1F2937") # Modern dark slate

# Text secondary
static func get_text_secondary() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#7C776D")
	else:
		return Color("#6B7280")

# Brand / Accent colors
static func get_accent_color() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#DA291C") # McDonald's Brand Red
	else:
		return Color("#3B82F6") # Minimal Calm Blue

static func get_secondary_accent() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#FFC72C") # Golden Arches Yellow
	else:
		return Color("#94A3B8")

# Border color
static func get_border_color() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#EAE2CF")
	else:
		return Color("#E2E8F0")

# Stamp styling
static func get_stamp_text() -> String:
	if current_theme == THEME_MCDONALDS:
		return "已出餐\nDONE"
	else:
		return "已完成\n✓"

static func get_stamp_color() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#DA291C") # Bold Red Stamp
	else:
		return Color("#64748B") # Soft Slate Stamp

# Menu styling
static func get_menu_bg_color() -> Color:
	if current_theme == THEME_MCDONALDS:
		return Color("#27251F") # Dark receipt card
	else:
		return Color("#1E293B") # Frosted modern slate
