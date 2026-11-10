// 每帧共用的参数，拼在 lightmap / bloom / rays / beams / compose / overlay 几个着色器前面。
// 和 renderer.ts 的 writeFrame 一一对应。

struct Frame {
  size: vec4f,   // 逻辑宽, 逻辑高, 效果开关位, 光源数
  sun: vec4f,    // 太阳 x, y（逻辑像素）, 体积光强度, 1 = 深色模式
  tint: vec4f,   // 群系色调 rgb（0-1）, 辉光强度
  night: vec4f,  // 夜色 rgb（0-1）和不透明度
  ambient: vec4f, // 环境光 rgb（0-1，场景整体乘上它）, -
  rayColor: vec4f, // 日月体积光的颜色 rgb, -
  fog: vec4f,    // 远景往这个颜色靠（空气透视）rgb, -（靠多少按层的深度算，在合成组参数里）
  skyTop: vec4f, // 天空渐变：天顶的颜色, 地平线在哪一行
  skyHorizon: vec4f, // 地平线的颜色, 屏幕上看得到的顶在哪一行
  // 天空和世界在画布上差多少（逻辑像素）：天空要往左挪回亚像素平移 view.x 才贴着屏幕，世界阅读时往下沉了 view.y。
  // 辉光和日月体积光按画布上的位置算（天空和世界各自换算过去），叠回去时不再跟着世界挪，月亮的光不会跟着下沉
  view: vec4f,
  stops: array<vec4f, 2>,   // 淡出的四个控制点 (t, a)，两两一组
  // 每个光源三项：(x, y, 半径, 强度), (r, g, b, 光束停在哪一行), (光束方向 x, y, 半张角余弦, 光束长度；长度 0 = 没有光束)
  lights: array<vec4f, 144>,
};
@group(0) @binding(0) var<uniform> F: Frame;

const FX_LIGHTS = 1u;
const FX_DOF = 2u;
const FX_BLOOM = 4u;
const FX_RAYS = 8u;
const FX_GRADE = 16u;
const FX_BEAMS = 32u;
const FX_BOKEH = 256u;
const FX_VIGNETTE = 512u;
const FX_SKY = 1024u;
fn fx(bit: u32) -> bool { return (u32(F.size.z) & bit) != 0u; }
fn isDark() -> bool { return F.sun.w > 0.5; }
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
/** 抖动：加上不到半档的噪声，渐变和模糊过的地方不会出现一条条色带 */
fn dither(p: vec2f) -> f32 { return (hash2(floor(p)) - 0.5) / 255.0; }

// ---- 调色（compose.wgsl 按像素调，几张画布用同一套，颜色才接得上） ----

fn aces(x: vec3f) -> vec3f {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

/**
 * 胶片感的色调：转到线性空间做 ACES 色调映射（中间调提亮、高光压一点、对比更强），再分离色调（暗部偏青、亮部偏暖）、
 * 饱和度提一点，转回 sRGB。输入输出都是不预乘的颜色。
 * ACES 逐通道做会把暗色里本来就少的通道压没（暗绿变青），所以只取 4 成，其余按亮度做、保住色相；
 * 分离色调用乘法，暗处不会被减成 0
 */
fn look(c: vec3f) -> vec3f {
  let W = vec3f(0.2126, 0.7152, 0.0722);
  let lin = pow(max(c, vec3f(0.0)), vec3f(2.2)) * 1.2;
  let L = max(dot(lin, W), 1e-4);
  var m = mix(lin * (aces(vec3f(L)).x / L), aces(lin), 0.4);
  let t = smoothstep(0.1, 0.7, dot(m, W));
  m *= 1.0 + mix(vec3f(-0.05, 0.0, 0.08), vec3f(0.05, 0.015, -0.05), t);
  let l = dot(m, W);
  m = mix(vec3f(l), m, 1.1);
  return pow(clamp(m, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
}

/** 暗角：画面边上压暗多少（0..1），uv 是 0..1 的屏幕位置。浅色模式的天空是浅色页面底色，压重了发灰，轻一些 */
fn vignette(uv: vec2f) -> f32 {
  let q = (uv - 0.5) * vec2f(0.9, 1.2);
  return clamp(dot(q, q) * select(0.28, 0.55, isDark()), 0.0, 1.0);
}

struct V { @builtin(position) pos: vec4f };

// 全屏三角形
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.pos = vec4f(p[i], 0.0, 1.0);
  return o;
}
