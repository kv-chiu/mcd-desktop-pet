extends SceneTree

# godot --headless --path desktop --script res://tests/action_idle_transition.gd
var pet: DesktopPet
var completions: Array[String] = []
var failures: int = 0

func _initialize() -> void:
	_run.call_deferred()

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures += 1
		push_error(message)

func _run() -> void:
	pet = load("res://scenes/pet.tscn").instantiate()
	root.add_child(pet)
	pet.auto_walk_enabled = false
	pet.action_finished.connect(func(name: String): completions.append(name))
	var original_material := CanvasItemMaterial.new()
	pet.anim_sprite.material = original_material

	for name in ["jump", "wave"]:
		var expected_frames := 28 if name == "jump" else 48
		_check(pet.anim_sprite.sprite_frames.get_frame_count(name) == expected_frames, name + " still includes unwanted tail frames")
		pet.idle_time = 100.0
		pet.play_action_by_name(name, 0.01)
		await create_timer(0.05).timeout
		_check(pet.current_state == DesktopPet.State.ACTION, name + " was cut short by its timer")
		var deadline := Time.get_ticks_msec() + 2000
		var last_frame := pet.anim_sprite.frame
		var saw_return := false
		while pet.current_state == DesktopPet.State.ACTION and Time.get_ticks_msec() < deadline:
			if pet.anim_sprite.animation == StringName(name + "_return"):
				saw_return = true
				_check(not completions.has(name), name + " completed before its return frames")
			else:
				last_frame = maxi(last_frame, pet.anim_sprite.frame)
			_check(pet.anim_sprite.material == original_material, name + " applied a blending material")
			await process_frame
		_check(saw_return, name + " skipped the generated return frames")
		var return_count := pet.anim_sprite.sprite_frames.get_frame_count(name + "_return")
		_check(return_count == 9, name + " has an unexpected number of return frames")
		var endpoint := pet.anim_sprite.sprite_frames.get_frame_texture(name + "_return", return_count - 1)
		_check(endpoint == pet.anim_sprite.sprite_frames.get_frame_texture("idle", 0), name + " return does not end at the exact idle texture")
		_check(last_frame == expected_frames - 1, name + " skipped its intended final frame")
		_check(pet.current_state == DesktopPet.State.IDLE and pet.anim_sprite.animation == &"idle", name + " did not settle to idle")
		_check(completions.count(name) == 1, name + " should complete exactly once")
		_check(pet.idle_time < 0.1, "Idle breathing did not restart from zero")
		_check(pet.action_tween == null, "Action motion tween survived completion")

	# 打断动作后，旧动画及其计时器不能覆盖新的状态。
	for interruption in ["action", "drag", "walk", "return_action", "return_drag", "return_walk"]:
		pet.play_jump()
		pet.anim_sprite.frame = 26
		if interruption.begins_with("return_"):
			pet._on_animation_finished()
			_check(pet.anim_sprite.animation == &"jump_return", "Did not enter return for interruption check")
		if interruption.ends_with("action"):
			pet.play_action_by_name("wave", 2.0)
		elif interruption.ends_with("drag"):
			pet.interrupt_walk()
		else:
			pet.start_walk(1)
		await create_timer(0.24).timeout
		_check(completions.count("jump") == 1, interruption + " received stale jump completion")
		_check(pet.anim_sprite.material == original_material, interruption + " changed the sprite material")
		if interruption.ends_with("action"):
			_check(pet.action_name == "wave" and pet.current_state == DesktopPet.State.ACTION, "Old action replaced new action")
		elif interruption.ends_with("walk"):
			_check(pet.current_state == DesktopPet.State.WALK_INTRO, "Old action replaced walking")
		else:
			_check(pet.current_state == DesktopPet.State.IDLE, "Dragging did not return to idle")
		pet.play_idle()

	# 朝左触发动作时，翻转会留下不同的尺寸；补帧起点仍须匹配屏幕上的姿态。
	pet.facing_direction = -1
	pet.anim_sprite.scale = Vector2(-1.0, 1.0)
	pet.play_wave()
	await create_timer(0.3).timeout
	var ending_scale := pet.anim_sprite.scale
	var ending_y := pet.anim_sprite.position.y
	pet.anim_sprite.frame = 47
	pet._on_animation_finished()
	_check((pet.anim_sprite.scale * pet.ACTION_SCALE).is_equal_approx(ending_scale), "Return changed the current pose scale")
	_check(is_equal_approx(pet.anim_sprite.position.y - pet.anim_sprite.scale.y * pet.ACTION_Y_OFFSET, ending_y), "Return changed the current pose position")
	await create_timer(0.25).timeout
	_check(pet.current_state == DesktopPet.State.IDLE, "Left-facing action did not settle to idle")
	_check(completions.count("wave") == 2, "Left-facing wave should complete exactly once")

	pet.play_jump()
	pet.anim_sprite.frame = 10
	pet.play_jump()
	_check(pet.anim_sprite.frame == 0, "Repeated action did not restart from the first frame")
	pet.interrupt_walk()
	await create_timer(0.8).timeout
	_check(pet.action_tween == null, "Interrupted jump still has a motion tween")
	_check(absf(pet.anim_sprite.position.y - pet.base_pos_y) < 2.0, "Interrupted jump moved the idle sprite")

	print("Action/idle transition checks: ", "PASS" if failures == 0 else "FAIL (%d)" % failures)
	quit(0 if failures == 0 else 1)
