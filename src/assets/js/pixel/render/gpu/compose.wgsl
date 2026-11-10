// 合成一组（drawlist.ts 的 COMPOSE）：组里最多 3 层按顺序叠好，再整体处理，输出预乘 alpha 叠到画布上。
//   night 深色模式下变暗：开了调色时乘偏蓝的夜间环境光，关掉调色时盖一层夜色（只染已有的像素，不改透明度）
//   lit   夜色在灯旁边变淡，染上灯的颜色（光照图）
//   fade  自下而上淡出（开了景深时换成空气透视：每层按深度往天空的颜色靠，山的轮廓看得清）
//   环境光 场景整体乘上一天里这个时刻的环境光（日落时偏暖偏暗）
//   调色  轻轻往当前群系的色调偏；再按 frame.wgsl 的 look 调成胶片感的色调（除了天空每组都调，几张画布颜色接得上；
//         天空的底色是透出来的页面底色，调不到，日月星星也就不调，免得和底色对不上）
//   暗角  前景画布自己压暗边上（世界画布的暗角在 overlay.wgsl 里整张一起压）
// 画布可以比逻辑分辨率大（世界画布按屏幕像素画）：清晰的层按最近邻取像素，景深模糊过的层线性插值。

struct Group {
  a: vec4f, // 层数, 淡出, 盖夜色, 被灯照亮
  b: vec4f, // 三层各自是否用模糊过的纹理, 画布像素 / 逻辑像素
  c: vec4f, // 往群系色调偏多少, 整组的不透明度, 调色, 压暗角
  d: vec4f, // 三层各自往右挪的亚像素（逻辑像素，drawlist.ts 的 shift）, 整组往下挪多少（毛玻璃里对齐天空用）
  e: vec4f, // 三层各自往天空的颜色靠多少（空气透视）, 乘环境光
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
  // 挪出纹理范围的地方是空的（越界的 textureLoad 结果不确定）
  if (any(lp < vec2f(0.0)) || any(lp >= F.size.xy)) { return vec4f(0.0); }
  return textureLoad(t, vec2i(lp), 0);
}

/** 夜里的环境光（sRGB，场景乘上它）：和 demo 一样偏蓝 */
const NIGHT_AMBIENT = vec3f(0.42, 0.47, 0.66);

/** 空气透视：预乘的颜色往天空的颜色靠 k */
fn haze(s: vec4f, k: f32) -> vec4f {
  return vec4f(mix(s.rgb, F.fog.rgb * s.a, k), s.a);
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  let lp = v.pos.xy / G.b.w; // 画布上的位置（逻辑像素）
  let q = lp - vec2f(0.0, G.d.w); // 在世界里的位置：阅读时世界往下沉了 G.d.w
  let n = i32(G.a.x);
  // 三个分支要写开：纹理不能放进数组里按下标取
  var c = haze(pick(t0, G.b.x, q - vec2f(G.d.x, 0.0)), G.e.x);
  if (n > 1) { let s = haze(pick(t1, G.b.y, q - vec2f(G.d.y, 0.0)), G.e.y); c = s + c * (1.0 - s.a); }
  if (n > 2) { let s = haze(pick(t2, G.b.z, q - vec2f(G.d.z, 0.0)), G.e.z); c = s + c * (1.0 - s.a); }
  if (c.a <= 0.0) { return vec4f(0.0); }
  if (G.e.w > 0.5) { c = vec4f(c.rgb * F.ambient.rgb, c.a); }

  let dark = isDark();
  var light = vec4f(0.0);
  if (G.a.w > 0.5) { light = textureLoad(lightmap, vec2i(clamp(q, vec2f(0.0), F.size.xy - 1.0)), 0); }
  if (G.a.z > 0.5 && dark) {
    let lit = min(light.a, 0.85);
    if (G.e.w > 0.5) {
      // 夜里的环境光：整体乘上偏蓝的暗光，灯旁边照亮回去（比盖一层半透明夜色通透，暗处不发灰）
      c = vec4f(c.rgb * mix(NIGHT_AMBIENT, vec3f(1.0), lit), c.a);
    } else {
      let k = F.night.a * (1.0 - lit);
      c = vec4f(F.night.rgb * k * c.a + c.rgb * (1.0 - k), c.a);
    }
  }
  if (G.a.w > 0.5) {
    c = vec4f(c.rgb + light.rgb * c.a * select(0.12, 0.3, dark), c.a);
  }
  if (G.c.x > 0.0) {
    c = vec4f(c.rgb * mix(vec3f(1.0), F.tint.rgb, G.c.x), c.a);
  }
  if (G.c.z > 0.5) {
    c = vec4f(look(c.rgb / c.a) * c.a, c.a);
  }
  if (G.c.w > 0.5) {
    c = vec4f(c.rgb * (1.0 - vignette(lp / F.size.xy)), c.a);
  }
  if (G.a.y > 0.5) { c *= fadeAt(q.y / F.size.y); }
  if (G.c.z > 0.5) { c = vec4f(c.rgb + dither(v.pos.xy) * c.a, c.a); }
  return c * G.c.y;
}
