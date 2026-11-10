// 每帧共用的参数，拼在 lightmap / bloom / rays / compose / overlay 几个着色器前面。
// 和 renderer.ts 的 writeFrame 一一对应。

struct Frame {
  size: vec4f,   // 逻辑宽, 逻辑高, 效果开关位, 光源数
  sun: vec4f,    // 太阳 x, y（逻辑像素）, 体积光强度, 1 = 深色模式
  tint: vec4f,   // 群系色调 rgb（0-1）, 辉光强度
  night: vec4f,  // 夜色 rgb（0-1）和不透明度
  stops: array<vec4f, 2>,   // 淡出的四个控制点 (t, a)，两两一组
  lights: array<vec4f, 96>, // 每个光源两项：(x, y, 半径, 强度), (r, g, b, -)
};
@group(0) @binding(0) var<uniform> F: Frame;

const FX_LIGHTS = 1u;
const FX_DOF = 2u;
const FX_BLOOM = 4u;
const FX_RAYS = 8u;
const FX_GRADE = 16u;
fn fx(bit: u32) -> bool { return (u32(F.size.z) & bit) != 0u; }
fn isDark() -> bool { return F.sun.w > 0.5; }

struct V { @builtin(position) pos: vec4f };

// 全屏三角形
@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.pos = vec4f(p[i], 0.0, 1.0);
  return o;
}
