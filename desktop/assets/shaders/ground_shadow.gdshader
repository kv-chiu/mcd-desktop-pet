shader_type canvas_item;

// 阴影颜色 (RGB)
uniform vec4 shadow_color : source_color = vec4(0.02, 0.02, 0.05, 1.0);

void fragment() {
    // 将 UV 映射到以中心 (0.5, 0.5) 为原点的 [-1.0, 1.0] 椭圆空间
    vec2 p = (UV - vec2(0.5)) * 2.0;
    float dist = length(p);
    
    // 硬边实体卡通阴影：内部完全实心，仅在边缘保留 1 像素抗锯齿平滑过渡（无大范围羽化）
    float delta = fwidth(dist);
    float mask = 1.0 - smoothstep(1.0 - delta, 1.0, dist);
    
    // 必须乘以 COLOR.a（即节点传递进来的 modulate.a / shadow_opacity），否则节点的透明度会被强行覆盖成 1.0 纯黑
    COLOR = vec4(shadow_color.rgb, COLOR.a * shadow_color.a * mask);
}
