// 天空的底色（画在世界画布最底下）：从屏幕上看得到的顶到地平线，天顶色渐变到地平线色，
// 地平线以下都是地平线色（被远山和地面挡住）。颜色跟着一天里的时刻走（daytime.ts），不透明。
// 天空不跟着世界下沉、不做亚像素平移：它画在屏幕坐标里。

@group(0) @binding(1) var<uniform> scale: vec4f; // 画布像素 / 逻辑像素

@fragment fn fs(v: V) -> @location(0) vec4f {
  let y = v.pos.y / scale.x;
  let t = smoothstep(F.skyHorizon.w, F.skyTop.w, y);
  let c = mix(F.skyTop.rgb, F.skyHorizon.rgb, t);
  return vec4f(c + dither(v.pos.xy), 1.0);
}
