// 毛玻璃（世界画布，屏幕像素）：卡片、阅读面板、快捷栏、顶栏按钮后面那块换成大幅模糊过的场景，
// 卡片本身是半透明的（CSS），透出来的就是这层。圆角和卡片的 CSS 圆角一致，边缘 1 像素抗锯齿。
// 打开文章时镜头对焦拉近：整个世界一起换成模糊的场景、压暗一些（focus 0..1）。

struct Glass {
  info: vec4f, // 块数, 对焦拉近, 画布宽, 画布高
  rects: array<vec4f, 16>, // x, y, w, h（画布像素）
  shape: array<vec4f, 16>, // 圆角, 不透明度, -, -
};
@group(0) @binding(0) var<uniform> G: Glass;
@group(0) @binding(1) var scene: texture_2d<f32>; // 天空 + 世界合成后模糊过的样子（逻辑分辨率）
@group(0) @binding(2) var samp: sampler;

struct V { @builtin(position) pos: vec4f };

@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.pos = vec4f(p[i], 0.0, 1.0);
  return o;
}

/** 圆角矩形的有向距离，负数在里面 */
fn roundRect(p: vec2f, r: vec4f, rad: f32) -> f32 {
  let half = r.zw * 0.5;
  let q = abs(p - (r.xy + half)) - half + rad;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - rad;
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  let fp = v.pos.xy;
  var cover = 0.0;
  for (var i = 0; i < i32(G.info.x); i++) {
    let r = G.rects[i];
    let rad = min(G.shape[i].x, min(r.z, r.w) * 0.5);
    cover = max(cover, clamp(0.5 - roundRect(fp, r, rad), 0.0, 1.0) * G.shape[i].y);
  }
  let focus = G.info.y;
  let a = max(cover, focus);
  if (a <= 0.0) { return vec4f(0.0); }
  var c = textureSampleLevel(scene, samp, fp / G.info.zw, 0.0);
  // 对焦拉近时整体压暗一些，焦点像是落到了面板上
  c = vec4f(c.rgb * (1.0 - focus * 0.25), c.a);
  return c * a;
}
