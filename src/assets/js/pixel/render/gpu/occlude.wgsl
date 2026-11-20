// 挡光遮罩（逻辑分辨率，世界坐标）：天空被前面的东西挡住了多少。
// drawlist.ts 的 OCCLUDERS 每层画一遍，取不透明度的最大值（混合方式 max，见 renderer.ts）。
// 辉光（天空里的日月只取没被挡住的部分）和日月体积光都只读这一张，哪些层挡光只在 OCCLUDERS 里定义一次。
// 每层按合成时同样的亚像素偏移取样（只有模糊过的层才有偏移），挡光的形状和画面上看到的对齐。

@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<uniform> shift: vec4f; // 这一层往右挪的亚像素（逻辑像素）

@fragment fn fs(v: V) -> @location(0) vec4f {
  let a = textureSampleLevel(src, samp, (v.pos.xy - vec2f(shift.x, 0.0)) / F.size.xy, 0.0).a;
  return vec4f(a);
}
