class_name SpeechBubble
extends Control

signal bubble_closed

@onready var panel: PanelContainer = $PanelContainer
@onready var label: Label = $PanelContainer/MarginContainer/Label
@onready var timer: Timer = $Timer

var current_tween: Tween

func _ready() -> void:
	modulate.a = 0.0
	scale = Vector2(0.8, 0.8)
	pivot_offset = Vector2(size.x / 2.0, size.y)
	timer.timeout.connect(_on_timer_timeout)

func show_speech(text: String, duration: float = 4.0) -> void:
	if text.strip_edges().is_empty():
		return

	label.text = text
	timer.stop()

	if current_tween and current_tween.is_valid():
		current_tween.kill()

	# Pop-in animation
	current_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	current_tween.tween_property(self, "modulate:a", 1.0, 0.25)
	current_tween.tween_property(self, "scale", Vector2.ONE, 0.25)

	timer.wait_time = max(1.5, duration)
	timer.start()

func hide_speech() -> void:
	timer.stop()
	if current_tween and current_tween.is_valid():
		current_tween.kill()

	current_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	current_tween.tween_property(self, "modulate:a", 0.0, 0.2)
	current_tween.tween_property(self, "scale", Vector2(0.8, 0.8), 0.2)
	current_tween.finished.connect(func(): bubble_closed.emit())

func _on_timer_timeout() -> void:
	hide_speech()
