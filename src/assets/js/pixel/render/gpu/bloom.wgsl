// 辉光（逻辑分辨率起步）：
//   fs    光源：发光的层（亮着的窗、灯泡、营火火焰）叠在一起，再加上天空里最亮的部分（太阳、月亮）；
//         天空被远山、树、地面挡住的地方不算，太阳落到山后面就不再透过山发光
//   down  逐级缩小一半（每次取 4 个点的平均）
//   up    从最小的一级往回放大（3x3 帐篷滤波），叠加到上一级上：几级叠起来就是又大又柔的光晕
// 叠回画面的是第 0 级（overlay.wgsl）。按画布上的位置算：天空、世界各自换算过去（frame.wgsl 的 view）。

@group(0) @binding(1) var emissive: texture_2d<f32>;
@group(0) @binding(2) var glow: texture_2d<f32>;
@group(0) @binding(3) var sky: texture_2d<f32>;
@group(0) @binding(4) var src: texture_2d<f32>;
@group(0) @binding(5) var samp: sampler;
@group(0) @binding(6) var far: texture_2d<f32>;
@group(0) @binding(7) var mid: texture_2d<f32>;
@group(0) @binding(8) var near: texture_2d<f32>;
@group(0) @binding(9) var back: texture_2d<f32>;
@group(0) @binding(10) var fg: texture_2d<f32>;

/** 画布上的位置换成世界里的位置（阅读时世界往下沉了 F.view.y） */
fn world(p: vec2f) -> vec2i { return vec2i(clamp(p - vec2f(0.0, F.view.y), vec2f(0.0), F.size.xy - 1.0)); }

/** 这一格天空被前面的东西挡住了多少 */
fn covered(p: vec2i) -> f32 {
  let a = max(max(textureLoad(far, p, 0).a, textureLoad(mid, p, 0).a), textureLoad(near, p, 0).a);
  return max(a, max(textureLoad(back, p, 0).a, textureLoad(fg, p, 0).a));
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_BLOOM)) { return vec4f(0.0); }
  let w = world(v.pos.xy);
  // 营火火焰按自发光倍数进辉光（白天比夜里弱，见 drawlist.ts 的 emit）。灯窗、日月按昼夜的辉光强度（F.tint.a）
  var c = textureLoad(glow, w, 0) * F.ambient.w * FIRE_BLOOM;
  var rest = vec4f(0.0);
  if (isDark()) { rest += textureLoad(emissive, w, 0); }
  // 天空：只取接近白的亮部（日盘、月盘），星星这种暗一点的不算。
  // 天空的偏移带小数（视差的亚像素，见 sky.ts），线性插值取样，光晕才跟着日月平滑挪动，不会一格一格地跳
  let s = textureSampleLevel(sky, samp, (v.pos.xy - vec2f(F.view.x, 0.0)) / F.size.xy, 0.0);
  let bright = smoothstep(0.7, 0.95, max(s.r, max(s.g, s.b)) / max(s.a, 1e-3)) * s.a * (1.0 - covered(w));
  rest += vec4f(s.rgb * bright * 1.6, 0.0);
  return c + rest * F.tint.a;
}

/** 营火火焰的辉光强度 */
const FIRE_BLOOM = 0.6;

@fragment fn down(v: V) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(src));
  let uv = v.pos.xy * 2.0 / dims;
  let o = 1.0 / dims;
  return (textureSampleLevel(src, samp, uv + vec2f(-o.x, -o.y), 0.0)
        + textureSampleLevel(src, samp, uv + vec2f(o.x, -o.y), 0.0)
        + textureSampleLevel(src, samp, uv + vec2f(-o.x, o.y), 0.0)
        + textureSampleLevel(src, samp, uv + vec2f(o.x, o.y), 0.0)) * 0.25;
}

@fragment fn up(v: V) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(src));
  let uv = v.pos.xy * 0.5 / dims;
  let o = 1.0 / dims;
  var c = textureSampleLevel(src, samp, uv, 0.0) * 4.0;
  c += (textureSampleLevel(src, samp, uv + vec2f(o.x, 0.0), 0.0) + textureSampleLevel(src, samp, uv - vec2f(o.x, 0.0), 0.0)
      + textureSampleLevel(src, samp, uv + vec2f(0.0, o.y), 0.0) + textureSampleLevel(src, samp, uv - vec2f(0.0, o.y), 0.0)) * 2.0;
  c += textureSampleLevel(src, samp, uv + o, 0.0) + textureSampleLevel(src, samp, uv - o, 0.0)
     + textureSampleLevel(src, samp, uv + vec2f(o.x, -o.y), 0.0) + textureSampleLevel(src, samp, uv + vec2f(-o.x, o.y), 0.0);
  return c / 16.0;
}
