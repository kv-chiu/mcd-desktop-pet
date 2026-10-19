class_name BehaviorController
extends Node

## 行为控制器 (BehaviorController)
## 演播调度中枢：统一接管与协调多来源的交互与演出请求
## 解决不同来源事件的冲突、闪退、顶替问题，实现优先级抢占、冷却防抖、回声去重与队列平滑演出。

signal intent_started(intent: BehaviorIntent)
signal intent_finished(intent: BehaviorIntent)
signal echo_absorbed(intent: BehaviorIntent)

# 优先级定义：数值越大，优先级越高
enum Priority {
	IDLE = 0,         # 无演出 / 待机
	AMBIENT = 10,     # 背景闲聊、环境台词、自主漫步意向
	INTERACTION = 20, # 用户点击摸摸互动、Q弹反馈
	OPERATION = 30,   # 用户主动操作（菜单点选、设置）、业务调用（点餐、查券、主厨推荐、午餐提醒）
	URGENT = 40       # 系统关键级通知（断网重连报警、外卖送达等）
}

## 行为意图封装
class BehaviorIntent:
	var id: String = ""
	var source: String = ""             # "local_click", "menu", "remote_action", "remote_speech", "reminder", "system"
	var priority: int = Priority.INTERACTION
	var action: String = ""             # "jump", "wave", "speak", "click_bounce", "walk", "flip", "stop_walk", "idle", ""
	var action_arg: Variant = null      # 动作辅助参数（如 flip 方向）
	var speech: String = ""
	var duration: float = 3.0           # 预期展示时间 (秒)
	var min_duration: float = 1.2       # 最小受保护时间（在此时间内同级或低级不可强行截断）
	var cooldown_key: String = ""       # 冷却/去重标识
	var cooldown_time: float = 0.0      # 冷却时长 (秒)
	var created_time: float = 0.0

	func _init(p_source: String = "", p_priority: int = Priority.INTERACTION) -> void:
		source = p_source
		priority = p_priority
		created_time = Time.get_ticks_msec() / 1000.0

# 关联的下层演出节点
var pet: DesktopPet = null
var speech_bubble: SpeechBubble = null

# 调度状态
var current_intent: BehaviorIntent = null
var current_start_msec: int = 0
var intent_queue: Array[BehaviorIntent] = []
const MAX_QUEUE_SIZE: int = 4

# 冷却与去重记录
var _cooldown_records: Dictionary = {} # key -> timestamp_msec
var _last_local_click_msec: int = -999999
var _last_speech_text: String = ""
var _last_speech_msec: int = -999999

# 内部演出计时器
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

# ==================== 便捷接入 API ====================

## 1. 用户点击摸摸互动
func request_user_click(quote: String) -> bool:
	var intent = BehaviorIntent.new("local_click", Priority.INTERACTION)
	intent.action = "click_bounce"
	intent.speech = quote
	intent.duration = 3.0
	intent.min_duration = 1.2
	intent.cooldown_key = "pet_click"
	intent.cooldown_time = 0.4
	return submit_intent(intent)

## 2. 接收来自服务端的业务动作与气泡广播
func request_remote_action(action: String, duration: float, speech: String) -> bool:
	var intent = BehaviorIntent.new("remote_action", Priority.OPERATION)
	intent.action = action
	intent.speech = speech
	intent.duration = maxf(1.5, duration)
	intent.min_duration = 1.5
	intent.cooldown_key = "remote_action_" + action
	intent.cooldown_time = 0.3
	return submit_intent(intent)

## 3. 接收来自服务端的纯说话广播
func request_remote_speech(speech: String, duration: float) -> bool:
	var intent = BehaviorIntent.new("remote_speech", Priority.OPERATION)
	intent.speech = speech
	intent.duration = maxf(1.5, duration)
	intent.min_duration = 1.2
	return submit_intent(intent)

## 4. 用户右键菜单操作
func request_menu_action(action: String, speech: String, duration: float = 2.0, arg: Variant = null) -> bool:
	var intent = BehaviorIntent.new("menu", Priority.OPERATION)
	intent.action = action
	intent.action_arg = arg
	intent.speech = speech
	intent.duration = duration
	intent.min_duration = 1.0
	return submit_intent(intent)

## 5. 午休与选餐定时提醒
func request_reminder(speech: String, action: String = "wave", duration: float = 5.0) -> bool:
	var intent = BehaviorIntent.new("reminder", Priority.OPERATION)
	intent.action = action
	intent.speech = speech
	intent.duration = duration
	intent.min_duration = 2.5
	intent.cooldown_key = "lunch_reminder"
	intent.cooldown_time = 5.0
	return submit_intent(intent)

## 6. 系统关键通知（如网络状态改变）
func request_system_notice(speech: String, duration: float = 2.5, is_urgent: bool = false) -> bool:
	var prio = Priority.URGENT if is_urgent else Priority.OPERATION
	var intent = BehaviorIntent.new("system", prio)
	intent.speech = speech
	intent.duration = duration
	intent.min_duration = 1.0
	return submit_intent(intent)

# ==================== 核心调度与去重过滤 ====================

## 提交行为演出意图
func submit_intent(intent: BehaviorIntent) -> bool:
	var now = Time.get_ticks_msec()

	# 1. 检查是否为服务端点击回声 (Click Echo)
	if intent.source == "remote_action" and _is_click_echo(intent):
		echo_absorbed.emit(intent)
		return false

	# 2. 文本高频重复去重（同一句话在短时间内不重复弹，系统级紧急事件除外）
	if intent.priority < Priority.URGENT and not intent.speech.is_empty():
		if intent.speech == _last_speech_text and (now - _last_speech_msec) < 1800:
			return false

	# 3. 冷却键 (Cooldown) 拦截
	if not intent.cooldown_key.is_empty() and intent.cooldown_time > 0.0:
		if _cooldown_records.has(intent.cooldown_key):
			var elapsed = float(now - _cooldown_records[intent.cooldown_key]) / 1000.0
			if elapsed < intent.cooldown_time:
				# 特殊防抖：若处于点击冷却中，仍可重置小宝的 Q 弹动作手感，但不刷新气泡文本造成阅读闪烁
				if intent.source == "local_click" and pet != null:
					pet.play_click_bounce()
				return false
		_cooldown_records[intent.cooldown_key] = now

	# 记录本地点击时标，供回声检测
	if intent.source == "local_click":
		_last_local_click_msec = now

	# 4. 根据当前演播状态做优先级仲裁
	if current_intent == null:
		_play_intent(intent)
		return true

	var current_elapsed = float(now - current_start_msec) / 1000.0

	# 场景 A：新事件优先级更高 -> 允许直接抢占并无缝切换
	if intent.priority > current_intent.priority:
		_play_intent(intent)
		return true

	# 场景 B：新事件优先级更低 -> 低优绝不破坏高优，若有价值则排队，否则丢弃
	if intent.priority < current_intent.priority:
		_enqueue_intent(intent)
		return false

	# 场景 C：同优先级
	# 若当前演出尚未展示完“最小受保护时间”，进入队列排队，杜绝毫秒级文字闪烁
	if current_elapsed < current_intent.min_duration:
		_enqueue_intent(intent)
		return false
	else:
		# 已度过最小受保护时间，允许平滑切入新同级内容
		_play_intent(intent)
		return true

## 判定是否为服务端下发的点击回声
func _is_click_echo(intent: BehaviorIntent) -> bool:
	var now = Time.get_ticks_msec()
	var time_since_click = now - _last_local_click_msec

	# 本地刚刚点击过（1.5 秒窗口内）
	if time_since_click >= 0 and time_since_click < 1500:
		# 识别特征：默认抚摸应答语或伴随点击产生的 jump 回调
		var is_echo_text = intent.speech.contains("摸摸") or \
						   intent.speech.contains("开心") or \
						   intent.speech.contains("好感度") or \
						   intent.speech.contains("喜欢你的抚摸")
		var is_echo_action = intent.action == "jump" and current_intent != null and current_intent.source == "local_click"
		if is_echo_text or is_echo_action:
			return true
	return false

# ==================== 演出执行与队列管理 ====================

func _play_intent(intent: BehaviorIntent) -> void:
	if current_intent != null and current_intent != intent:
		intent_finished.emit(current_intent)

	current_intent = intent
	current_start_msec = Time.get_ticks_msec()

	if not intent.speech.is_empty():
		_last_speech_text = intent.speech
		_last_speech_msec = current_start_msec

	# 1. 执行角色动作
	if pet != null and not intent.action.is_empty():
		_execute_pet_action(intent)

	# 2. 弹出文字气泡
	if speech_bubble != null and not intent.speech.is_empty():
		speech_bubble.show_speech(intent.speech, intent.duration)

	# 3. 启动演播时长计时器
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
	# 过滤过期的环境低优事件，避免队列积压
	if intent.priority <= Priority.AMBIENT:
		return

	# 超出队列容量时，淘汰最老的低优先级事件
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
			return # 队列满且新事件优先级未胜过已有项

	# 按优先级降序插入
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
	# 气泡淡出关闭后，若当前演出已到期，平稳接力下一项
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

	# 检查队列中是否有待演播的意图
	if intent_queue.size() > 0:
		var next_intent = intent_queue.pop_front()
		# 确保尚未过期（创建后等待不超过 8 秒）
		var now_sec = Time.get_ticks_msec() / 1000.0
		if (now_sec - next_intent.created_time) < 8.0:
			_play_intent(next_intent)
		else:
			_complete_current_intent()

# ==================== 状态查询 API ====================

func is_busy() -> bool:
	return current_intent != null

func get_current_priority() -> int:
	if current_intent != null:
		return current_intent.priority
	return Priority.IDLE
