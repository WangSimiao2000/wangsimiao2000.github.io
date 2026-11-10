// 合成：把一层（预乘 alpha）按规则叠到画布上。规则见 drawlist.ts 的 COMPOSE：
//   fade  自下而上淡出：不透明度乘以 fadeAt(y / H)，四个控制点由 util.ts 的 FADE_STOPS 传进来
//   night 深色模式下用 source-atop 盖一层夜色：只染已有的像素，不改透明度

struct Rule {
  size: vec2f,  // 画布宽高（逻辑像素）
  fade: f32,    // 1 = 淡出
  night: f32,   // 1 = 盖夜色
  nightColor: vec4f, // 夜色 rgb（0-1）和不透明度
  stops: array<vec4f, 2>, // 淡出的四个控制点 (t, a)，两两一组
};
@group(0) @binding(0) var<uniform> r: Rule;
@group(0) @binding(1) var layer: texture_2d<f32>;

struct V { @builtin(position) pos: vec4f };

@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.pos = vec4f(p[i], 0.0, 1.0);
  return o;
}

// 淡出曲线：控制点之间分段线性，两端取端点的值
fn fadeAt(t: f32) -> f32 {
  let p = array<vec2f, 4>(r.stops[0].xy, r.stops[0].zw, r.stops[1].xy, r.stops[1].zw);
  if (t <= p[0].x) { return p[0].y; }
  for (var i = 1; i < 4; i++) {
    if (t <= p[i].x) { return mix(p[i - 1].y, p[i].y, (t - p[i - 1].x) / (p[i].x - p[i - 1].x)); }
  }
  return p[3].y;
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  var c = textureLoad(layer, vec2i(v.pos.xy), 0);
  if (r.night > 0.5) {
    let n = r.nightColor;
    c = vec4f(n.rgb * n.a * c.a + c.rgb * (1.0 - n.a), c.a);
  }
  if (r.fade > 0.5) {
    c *= fadeAt(v.pos.y / r.size.y);
  }
  return c;
}
