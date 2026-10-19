extends SceneTree

# godot --headless --path desktop --script res://tests/test_behavior_controller.gd

const BehaviorController = preload("res://scripts/behavior_controller.gd")

var pet: DesktopPet
var bubble: SpeechBubble
var ctrl: BehaviorController
var failures: int = 0


func _initialize() -> void:
	_run.call_deferred()

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error("FAILURE: " + message)

func _run() -> void:
	print("Starting BehaviorController test suite...")

	# 初始化测试环境
	pet = load("res://scenes/pet.tscn").instantiate()
	root.add_child(pet)
	pet.auto_walk_enabled = false

	bubble = load("res://scenes/speech_bubble.tscn").instantiate()
	root.add_child(bubble)

	ctrl = BehaviorController.new()
	root.add_child(ctrl)
	ctrl.setup(pet, bubble)

	# 1. 测试基础意图提交与展示
	var success_click = ctrl.request_user_click("测试点击语台词🍟")
	_check(success_click, "request_user_click should succeed")
	_check(ctrl.is_busy(), "controller should be busy after click")
	_check(ctrl.get_current_priority() == BehaviorController.Priority.INTERACTION, "priority should be INTERACTION")
	_check(bubble.label.text == "测试点击语台词🍟", "bubble text should match local click quote")

	# 2. 测试点击回声吸收 (Click Echo Suppression)
	# 模拟 20ms 后服务端回传的摸摸点击反馈，验证它不会冲掉刚刚本地的台词
	await create_timer(0.05).timeout
	var absorbed_echo := [false]
	ctrl.echo_absorbed.connect(func(_i): absorbed_echo[0] = true)
	var echo_res = ctrl.request_remote_action("jump", 2.5, "主人摸摸头，今天也要开心鸭！")
	_check(not echo_res, "Click echo should not preempt active click presentation")
	_check(absorbed_echo[0], "Click echo should be absorbed")
	_check(bubble.label.text == "测试点击语台词🍟", "Local quote should NOT be stomped by server echo")

	# 3. 测试连点冷却防抖 (Rapid click cooldown)
	var fast_click_res = ctrl.request_user_click("新的连点台词")
	_check(not fast_click_res, "Fast click within cooldown should be throttled")
	_check(bubble.label.text == "测试点击语台词🍟", "Speech text should remain unchanged during rapid click debounce")

	# 4. 测试低优先级不能打断高优先级
	# 构造一个高优先级的业务通知
	ctrl.request_reminder("【午休提醒】午休时间到啦！", "wave", 3.0)
	_check(ctrl.get_current_priority() == BehaviorController.Priority.OPERATION, "Priority should upgrade to OPERATION")
	_check(bubble.label.text == "【午休提醒】午休时间到啦！", "OPERATION should preempt INTERACTION")

	# 尝试在低优先级下提交闲聊台词，应该被拒绝打断
	var ambient_intent = BehaviorController.BehaviorIntent.new("ambient", BehaviorController.Priority.AMBIENT)
	ambient_intent.speech = "小宝在偷偷想念炸鸡腿🍗"
	var ambient_res = ctrl.submit_intent(ambient_intent)
	_check(not ambient_res, "AMBIENT should not interrupt OPERATION")
	_check(bubble.label.text == "【午休提醒】午休时间到啦！", "High priority text should remain protected")

	# 5. 测试紧急事件最高优先级抢占 (URGENT Preemption)
	ctrl.request_system_notice("【紧急】麦当劳外卖已送达前台！", 3.0, true)
	_check(ctrl.get_current_priority() == BehaviorController.Priority.URGENT, "Priority should be URGENT")
	_check(bubble.label.text == "【紧急】麦当劳外卖已送达前台！", "URGENT should immediately preempt OPERATION")

	# 6. 测试队列排队与平滑展示
	# 当前是 URGENT，提交一个 OPERATION，应排入队列
	var queued_intent = BehaviorController.BehaviorIntent.new("mcp_tool", BehaviorController.Priority.OPERATION)
	queued_intent.speech = "主厨推荐：巨无霸套餐已备好"
	queued_intent.duration = 1.5
	ctrl.submit_intent(queued_intent)
	_check(ctrl.intent_queue.size() == 1, "OPERATION should be queued behind URGENT")

	print("BehaviorController test suite: ", "PASS" if failures == 0 else "FAIL (%d)" % failures)
	quit(0 if failures == 0 else 1)
