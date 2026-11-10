// 白天的体积光（逻辑分辨率）：从每个像素往太阳方向走一段，累计沿途透过来的天光。
// 远景和前景挡住的地方暗，缝隙里透过来的地方亮，就成了一道道光束。结果只有一个通道：亮度。

@group(0) @binding(1) var far: texture_2d<f32>;
@group(0) @binding(2) var mid: texture_2d<f32>;
@group(0) @binding(3) var near: texture_2d<f32>;
@group(0) @binding(4) var fg: texture_2d<f32>;

fn blocked(q: vec2f) -> f32 {
  let p = vec2i(clamp(q, vec2f(0.0), F.size.xy - 1.0));
  return max(max(textureLoad(far, p, 0).a, textureLoad(mid, p, 0).a), max(textureLoad(near, p, 0).a, textureLoad(fg, p, 0).a));
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_RAYS) || isDark() || F.sun.z <= 0.0) { return vec4f(0.0); }
  let p = v.pos.xy;
  let N = 40;
  let dstep = (F.sun.xy - p) / f32(N);
  var acc = 0.0;
  var w = 1.0;
  var q = p;
  for (var i = 0; i < N; i++) {
    let clearSky = 1.0 - blocked(q);
    acc += clearSky * exp(-length(q - F.sun.xy) / 70.0) * w;
    w *= 0.96;
    q += dstep;
  }
  // 光束只在有东西挡着的地方才看得出来：空中那段就是一片均匀的亮，压低一些
  let shade = mix(0.35, 1.0, blocked(p));
  return vec4f(acc / f32(N) * F.sun.z * shade, 0.0, 0.0, 1.0);
}
