// 叠在世界画布最上面的光：辉光（模糊过的发光层）、白天的体积光、夜里灯光的光束。
// 都是逻辑分辨率，线性插值放大，所以是柔和的。主角画布在世界画布上面，光束不会盖住主角，只在主角身后留下影子。

@group(0) @binding(1) var bloom: texture_2d<f32>;
@group(0) @binding(2) var rays: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@group(0) @binding(4) var<uniform> scale: vec4f; // 画布像素 / 逻辑像素
@group(0) @binding(5) var beams: texture_2d<f32>;

@fragment fn fs(v: V) -> @location(0) vec4f {
  let uv = v.pos.xy / scale.x / F.size.xy;
  let b = textureSampleLevel(bloom, samp, uv, 0.0).rgb * F.tint.a;
  let r = textureSampleLevel(rays, samp, uv, 0.0).r;
  let ray = vec3f(1.0, 0.94, 0.8) * r;
  let beam = textureSampleLevel(beams, samp, uv, 0.0).rgb;
  let c = b + ray + beam;
  // 画布是透明的、叠在页面上：用「亮度当不透明度」的方式叠，暗处背景不受影响
  let a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  return vec4f(min(c, vec3f(a)), a);
}
