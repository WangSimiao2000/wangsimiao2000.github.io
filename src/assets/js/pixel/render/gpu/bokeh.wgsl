// 失焦的光点（散景，drawlist.ts 的 Bokeh）：每个光点一个实例，画成六边形，中间淡、边上一圈亮一些（镜头散景的样子），
// 边缘按画布像素抗锯齿。光是加上去的，混合方式和 overlay.wgsl 一样。

@group(0) @binding(1) var<uniform> scale: vec4f; // 画布像素 / 逻辑像素

struct Dot {
  @location(0) at: vec4f,  // x, y, 半径, 不透明度（逻辑像素）
  @location(1) rgb: vec4f, // 颜色（0-1）
};

struct B {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f, // 相对圆心，以半径为单位
  @location(1) @interpolate(flat) color: vec4f, // 预乘好的颜色, 半径（画布像素）
};

@vertex fn vsDot(@builtin(vertex_index) vi: u32, d: Dot) -> B {
  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let k = corners[vi];
  let p = d.at.xy + k * d.at.z;
  var o: B;
  o.pos = vec4f(p.x / F.size.x * 2.0 - 1.0, 1.0 - p.y / F.size.y * 2.0, 0.0, 1.0);
  o.local = k;
  o.color = vec4f(d.rgb.rgb * d.at.w, d.at.z * scale.x);
  return o;
}

@fragment fn fsDot(b: B) -> @location(0) vec4f {
  let q = abs(b.local);
  // 平顶六边形：到边的距离，边上 = 1
  let d = max(q.y, q.x * 0.866025 + q.y * 0.5) / 0.866025;
  let edge = 1.0 - smoothstep(1.0 - 1.5 / b.color.w, 1.0, d);
  if (edge <= 0.0) { discard; }
  let body = 0.6 + 0.4 * smoothstep(0.7, 0.97, d);
  let c = b.color.rgb * body * edge;
  let a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  return vec4f(min(c, vec3f(a)), a);
}
