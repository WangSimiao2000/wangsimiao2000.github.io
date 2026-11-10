// 叠在世界画布最上面的光：辉光（模糊过的发光层）、白天的体积光、夜里灯光的光束。
// 都是逻辑分辨率，线性插值放大，所以是柔和的。主角画布在世界画布上面，光束不会盖住主角，只在主角身后留下影子。
//
// 光是加上去的，不能把后面的东西压暗：混合方式（renderer.ts 的 light）颜色直接相加，
// 不透明度只补在画布本来透明的地方（天空），那里按「亮度当不透明度」叠在页面底色上。
// 另一个入口 vignette 是暗角：整张世界画布（连同透出来的页面底色）边上压暗，叠在毛玻璃之后。
// 打开文章时世界画布往下沉、顶上露出天空画布，暗角会在接缝处断开，所以跟着对焦拉近淡掉。

@group(0) @binding(1) var bloom: texture_2d<f32>;
@group(0) @binding(2) var rays: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@group(0) @binding(4) var<uniform> scale: vec4f; // 画布像素 / 逻辑像素, 对焦拉近
@group(0) @binding(5) var beams: texture_2d<f32>;

@fragment fn fs(v: V) -> @location(0) vec4f {
  let uv = v.pos.xy / scale.x / F.size.xy;
  let b = textureSampleLevel(bloom, samp, uv, 0.0).rgb * F.tint.a;
  let r = textureSampleLevel(rays, samp, uv, 0.0).r;
  let ray = vec3f(1.0, 0.94, 0.8) * r;
  let beam = textureSampleLevel(beams, samp, uv, 0.0).rgb;
  let c = b + ray + beam;
  let a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  return vec4f(min(c, vec3f(a)), a);
}

@fragment fn vignetteFs(v: V) -> @location(0) vec4f {
  return vec4f(0.0, 0.0, 0.0, vignette(v.pos.xy / scale.x / F.size.xy) * (1.0 - scale.y));
}
