// 合成一组（drawlist.ts 的 COMPOSE）：组里最多 3 层按顺序叠好，再整体处理，输出预乘 alpha 叠到画布上。
//   night 深色模式下盖夜色（source-atop：只染已有的像素，不改透明度）
//   lit   夜色在灯旁边变淡，染上灯的颜色（光照图）
//   fade  自下而上淡出
//   调色  轻轻往当前群系的色调偏
// 画布可以比逻辑分辨率大（世界画布按屏幕像素画）：清晰的层按最近邻取像素，景深模糊过的层线性插值。

struct Group {
  a: vec4f, // 层数, 淡出, 盖夜色, 被灯照亮
  b: vec4f, // 三层各自是否用模糊过的纹理, 画布像素 / 逻辑像素
  c: vec4f, // 调色强度, 整组的不透明度
};
@group(0) @binding(1) var<uniform> G: Group;
@group(0) @binding(2) var t0: texture_2d<f32>;
@group(0) @binding(3) var t1: texture_2d<f32>;
@group(0) @binding(4) var t2: texture_2d<f32>;
@group(0) @binding(5) var samp: sampler;
@group(0) @binding(6) var lightmap: texture_2d<f32>;

fn fadeAt(t: f32) -> f32 {
  let s = array<vec2f, 4>(F.stops[0].xy, F.stops[0].zw, F.stops[1].xy, F.stops[1].zw);
  if (t <= s[0].x) { return s[0].y; }
  for (var i = 1; i < 4; i++) {
    if (t <= s[i].x) { return mix(s[i - 1].y, s[i].y, (t - s[i - 1].x) / (s[i].x - s[i - 1].x)); }
  }
  return s[3].y;
}

fn pick(t: texture_2d<f32>, soft: f32, lp: vec2f) -> vec4f {
  if (soft > 0.5) { return textureSampleLevel(t, samp, lp / F.size.xy, 0.0); }
  return textureLoad(t, vec2i(lp), 0);
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  let lp = v.pos.xy / G.b.w; // 逻辑像素坐标
  let n = i32(G.a.x);
  // 三个分支要写开：纹理不能放进数组里按下标取
  var c = pick(t0, G.b.x, lp);
  if (n > 1) { let s = pick(t1, G.b.y, lp); c = s + c * (1.0 - s.a); }
  if (n > 2) { let s = pick(t2, G.b.z, lp); c = s + c * (1.0 - s.a); }
  if (c.a <= 0.0) { return vec4f(0.0); }

  let dark = isDark();
  var light = vec4f(0.0);
  if (G.a.w > 0.5) { light = textureLoad(lightmap, vec2i(clamp(lp, vec2f(0.0), F.size.xy - 1.0)), 0); }
  if (G.a.z > 0.5 && dark) {
    let k = F.night.a * (1.0 - min(light.a, 0.85));
    c = vec4f(F.night.rgb * k * c.a + c.rgb * (1.0 - k), c.a);
  }
  if (G.a.w > 0.5) {
    c = vec4f(c.rgb + light.rgb * c.a * select(0.12, 0.3, dark), c.a);
  }
  if (G.c.x > 0.0) {
    c = vec4f(c.rgb * mix(vec3f(1.0), F.tint.rgb, G.c.x), c.a);
  }
  if (G.a.y > 0.5) { c *= fadeAt(lp.y / F.size.y); }
  return c * G.c.y;
}
