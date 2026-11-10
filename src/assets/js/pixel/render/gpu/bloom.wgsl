// 辉光的光源（逻辑分辨率）：发光的层（亮着的窗、灯泡、营火火焰、光晕）叠在一起，之后模糊再加回画面。

@group(0) @binding(1) var emissive: texture_2d<f32>;
@group(0) @binding(2) var glow: texture_2d<f32>;

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_BLOOM)) { return vec4f(0.0); }
  let p = vec2i(v.pos.xy);
  var c = textureLoad(glow, p, 0);
  if (isDark()) { c += textureLoad(emissive, p, 0); }
  return c;
}
