// 画一层：绘制清单里的每条命令是一个实例（一个矩形），从图集取像素或填纯色。
// 输出预乘 alpha；普通命令按「源在上」混合，擦除命令按源的不透明度把目标擦掉（混合方式在管线里设）。
// 影子命令（SHADOW）：图集那块上下翻过来、只取轮廓画成黑色，每往下一行往右挪「斜率」格（斜着拉长的影子）。
// 旋转命令（ROTATE）：整个矩形绕转轴（借颜色的 r g 两位放，相对矩形左上角）转「转角」弧度（顺时针），
// 取像素照旧按矩形里的位置、最近邻，所以转出来还是像素画。

struct Uniforms {
  size: vec2f, // 这一层的宽高（逻辑像素）
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var atlas: texture_2d<f32>;

// 和 drawlist.ts 的命令格式一一对应（14 个 float）
struct Cmd {
  @location(0) flagsAlpha: vec2f, // flags, alpha
  @location(1) dst: vec4f,        // 目标 x y w h
  @location(2) src: vec4f,        // 图集里的 x y w h
  @location(3) rgb: vec3f,        // 纯色（0-255）；ROTATE 时前两位是转轴
  @location(4) extra: f32,        // 影子的斜率 / 旋转的转角
};

const SOLID = 1u;
const FLIP = 4u;
const SHADOW = 8u;
const ROTATE = 16u;

struct V {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f, // 在目标矩形里的位置（像素）
  @location(1) @interpolate(flat) flagsAlpha: vec2f,
  @location(2) @interpolate(flat) src: vec4f,
  @location(3) @interpolate(flat) rgb: vec3f,
  @location(4) @interpolate(flat) dstSize: vec2f,
};

@vertex fn vs(@builtin(vertex_index) vi: u32, c: Cmd) -> V {
  var corners = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let k = corners[vi];
  var p = c.dst.xy + k * c.dst.zw;
  let flags = u32(c.flagsAlpha.x);
  if ((flags & SHADOW) != 0u) { p.x += c.extra * k.y * c.dst.w; }
  if ((flags & ROTATE) != 0u) {
    let mid = c.dst.xy + c.rgb.xy;
    let cs = cos(c.extra);
    let sn = sin(c.extra);
    let d = p - mid;
    p = mid + vec2f(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
  }
  var o: V;
  o.pos = vec4f(p.x / u.size.x * 2.0 - 1.0, 1.0 - p.y / u.size.y * 2.0, 0.0, 1.0);
  o.local = k * c.dst.zw;
  o.flagsAlpha = c.flagsAlpha;
  o.src = c.src;
  o.rgb = c.rgb;
  o.dstSize = c.dst.zw;
  return o;
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  let flags = u32(v.flagsAlpha.x);
  var col: vec4f;
  if ((flags & SOLID) != 0u) {
    col = vec4f(v.rgb / 255.0, 1.0);
  } else {
    // 最近邻取样：拉伸时按比例换算到图集里的整数格子
    var t = min(floor(v.local * v.src.zw / v.dstSize), v.src.zw - 1.0);
    if ((flags & FLIP) != 0u) { t.x = v.src.z - 1.0 - t.x; }
    if ((flags & SHADOW) != 0u) { t.y = v.src.w - 1.0 - t.y; }
    col = textureLoad(atlas, vec2i(v.src.xy + t), 0);
    if ((flags & SHADOW) != 0u) { col = vec4f(0.0, 0.0, 0.0, col.a); }
  }
  let a = col.a * v.flagsAlpha.y;
  return vec4f(col.rgb * a, a);
}
