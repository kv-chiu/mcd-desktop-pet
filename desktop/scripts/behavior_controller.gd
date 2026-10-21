class_name BehaviorController
extends Node


signal intent_started(intent: BehaviorIntent)
signal intent_finished(intent: BehaviorIntent)
signal echo_absorbed(intent: BehaviorIntent)

enum Priority {
	IDLE = 0,
	AMBIENT = 10,
	INTERACTION = 20,
	OPERATION = 30,
	URGENT = 40
}

class BehaviorIntent:
	var id: String = ""
	var source: String = ""
	var priority: int = Priority.INTERACTION
	var action: String = ""
	var action_arg: Variant = null
	var speech: String = ""
	var duration: float = 3.0
	var min_duration: float = 1.2
	var cooldown_key: String = ""
	var cooldown_time: float = 0.0
	var created_time: float = 0.0

	func _init(p_source: String = "", p_priority: int = Priority.INTERACTION) -> void:
		source = p_source
		priority = p_priority
		created_time = Time.get_ticks_msec() / 1000.0

var pet: DesktopPet = null
var speech_bubble: SpeechBubble = null

var current_intent: BehaviorIntent = null
var current_start_msec: int = 0
var intent_queue: Array[BehaviorIntent] = []
const MAX_QUEUE_SIZE: int = 4

var _cooldown_records: Dictionary = {}
var _last_local_click_msec: int = -999999
var _last_speech_text: String = ""
var _last_speech_msec: int = -999999

var _playback_timer: Timer

func _ready() -> void:
	_playback_timer = Timer.new()
	_playback_timer.one_shot = true
	_playback_timer.timeout.connect(_on_playback_timeout)
	add_child(_playback_timer)

func setup(p_pet: DesktopPet, p_bubble: SpeechBubble) -> void:
	pet = p_pet
	speech_bubble = p_bubble
	if speech_bubble != null and not speech_bubble.bubble_closed.is_connected(_on_bubble_closed):
		speech_bubble.bubble_closed.connect(_on_bubble_closed)


func request_user_click(quote: String) -> bool:
	var intent = BehaviorIntent.new("local_click", Priority.INTERACTION)
	intent.action = "click_bounce"
	intent.speech = quote
	intent.duration = 3.0
	intent.min_duration = 1.2
	intent.cooldown_key = "pet_click"
	intent.cooldown_time = 0.4
	return submit_intent(intent)

func request_remote_action(action: String, duration: float, speech: String) -> bool:
	var intent = BehaviorIntent.new("remote_action", Priority.OPERATION)
	intent.action = action
	intent.speech = speech
	intent.duration = maxf(1.5, duration)
	intent.min_duration = 1.5
	intent.cooldown_key = "remote_action_" + action
	intent.cooldown_time = 0.3
	return submit_intent(intent)

func request_remote_speech(speech: String, duration: float) -> bool:
	var intent = BehaviorIntent.new("remote_speech", Priority.OPERATION)
	intent.speech = speech
	intent.duration = maxf(1.5, duration)
	intent.min_duration = 1.2
	return submit_intent(intent)

func request_menu_action(action: String, speech: String, duration: float = 2.0, arg: Variant = null) -> bool:
	var intent = BehaviorIntent.new("menu", Priority.OPERATION)
	intent.action = action
	intent.action_arg = arg
	intent.speech = speech
	intent.duration = duration
	intent.min_duration = 1.0
	return submit_intent(intent)

func request_reminder(speech: String, action: String = "wave", duration: float = 5.0) -> bool:
	var intent = BehaviorIntent.new("reminder", Priority.OPERATION)
	intent.action = action
	intent.speech = speech
	intent.duration = duration
	intent.min_duration = 2.5
	intent.cooldown_key = "lunch_reminder"
	intent.cooldown_time = 5.0
	return submit_intent(intent)

func request_system_notice(speech: String, duration: float = 2.5, is_urgent: bool = false) -> bool:
	var prio = Priority.URGENT if is_urgent else Priority.OPERATION
	var intent = BehaviorIntent.new("system", prio)
	intent.speech = speech
	intent.duration = duration
	intent.min_duration = 1.0
	return submit_intent(intent)


func submit_intent(intent: BehaviorIntent) -> bool:
	var now = Time.get_ticks_msec()

	if intent.source == "remote_action" and _is_click_echo(intent):
		echo_absorbed.emit(intent)
		return false

	if intent.priority < Priority.URGENT and not intent.speech.is_empty():
		if intent.speech == _last_speech_text and (now - _last_speech_msec) < 1800:
			return false

	if not intent.cooldown_key.is_empty() and intent.cooldown_time > 0.0:
		if _cooldown_records.has(intent.cooldown_key):
			var elapsed = float(now - _cooldown_records[intent.cooldown_key]) / 1000.0
			if elapsed < intent.cooldown_time:
				if intent.source == "local_click" and pet != null:
					pet.play_click_bounce()
				return false
		_cooldown_records[intent.cooldown_key] = now

	if intent.source == "local_click":
		_last_local_click_msec = now

	if current_intent == null:
		_play_intent(intent)
		return true

	var current_elapsed = float(now - current_start_msec) / 1000.0

	if intent.priority > current_intent.priority:
		_play_intent(intent)
		return true

	if intent.priority < current_intent.priority:
		_enqueue_intent(intent)
		return false

	if current_elapsed < current_intent.min_duration:
		_enqueue_intent(intent)
		return false
	else:
		_play_intent(intent)
		return true

func _is_click_echo(intent: BehaviorIntent) -> bool:
	var now = Time.get_ticks_msec()
	var time_since_click = now - _last_local_click_msec

	if time_since_click >= 0 and time_since_click < 1500:
		var is_echo_text = intent.speech.contains("摸摸") or \
						   intent.speech.contains("开心") or \
						   intent.speech.contains("好感度") or \
						   intent.speech.contains("喜欢你的抚摸")
		var is_echo_action = intent.action == "jump" and current_intent != null and current_intent.source == "local_click"
		if is_echo_text or is_echo_action:
			return true
	return false


func _play_intent(intent: BehaviorIntent) -> void:
	if current_intent != null and current_intent != intent:
		intent_finished.emit(current_intent)

	current_intent = intent
	current_start_msec = Time.get_ticks_msec()

	if not intent.speech.is_empty():
		_last_speech_text = intent.speech
		_last_speech_msec = current_start_msec

	if pet != null and not intent.action.is_empty():
		_execute_pet_action(intent)

	if speech_bubble != null and not intent.speech.is_empty():
		speech_bubble.show_speech(intent.speech, intent.duration)

	var play_time = maxf(1.0, intent.duration)
	_playback_timer.stop()
	_playback_timer.wait_time = play_time
	_playback_timer.start()

	intent_started.emit(intent)

func _execute_pet_action(intent: BehaviorIntent) -> void:
	match intent.action:
		"click_bounce":
			pet.play_click_bounce()
		"jump":
			pet.play_jump()
		"wave":
			pet.play_wave()
		"walk":
			pet.start_random_walk()
		"flip":
			if intent.action_arg != null:
				pet.paper_flip(int(intent.action_arg))
			else:
				pet.paper_flip(-pet.facing_direction)
		"stop_walk":
			pet.stop_walk()
		"idle":
			pet.play_idle()
		_:
			pet.play_action_by_name(intent.action, intent.duration)

func _enqueue_intent(intent: BehaviorIntent) -> void:
	if intent.priority <= Priority.AMBIENT:
		return

	if intent_queue.size() >= MAX_QUEUE_SIZE:
		var lowest_idx = -1
		var lowest_prio = 999
		for i in range(intent_queue.size()):
			if intent_queue[i].priority < lowest_prio:
				lowest_prio = intent_queue[i].priority
				lowest_idx = i
		if lowest_idx != -1 and lowest_prio <= intent.priority:
			intent_queue.remove_at(lowest_idx)
		else:
			return

	var inserted = false
	for i in range(intent_queue.size()):
		if intent.priority > intent_queue[i].priority:
			intent_queue.insert(i, intent)
			inserted = true
			break
	if not inserted:
		intent_queue.append(intent)

func _on_playback_timeout() -> void:
	_complete_current_intent()

func _on_bubble_closed() -> void:
	if current_intent != null:
		var now = Time.get_ticks_msec()
		var elapsed = float(now - current_start_msec) / 1000.0
		if elapsed >= current_intent.min_duration:
			_complete_current_intent()

func _complete_current_intent() -> void:
	if current_intent == null:
		return

	var finished = current_intent
	current_intent = null
	intent_finished.emit(finished)

	if intent_queue.size() > 0:
		var next_intent = intent_queue.pop_front()
		var now_sec = Time.get_ticks_msec() / 1000.0
		if (now_sec - next_intent.created_time) < 8.0:
			_play_intent(next_intent)
		else:
			_complete_current_intent()


func is_busy() -> bool:
	return current_intent != null

func get_current_priority() -> int:
	if current_intent != null:
		return current_intent.priority
	return Priority.IDLE
