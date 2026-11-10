// 白天的体积光（逻辑分辨率）：从每个像素往太阳方向走一段，记下沿途透过来的天光和被挡住的比例。
// 光束只出现在「路上既有遮挡、又有缝隙」的地方（树冠、山脊之间漏下来的光），空旷的天上不加光，
// 免得整片天发白。起点按像素随机错开一点，消掉等距取样造成的一圈圈条纹。结果只有一个通道：亮度。

@group(0) @binding(1) var far: texture_2d<f32>;
@group(0) @binding(2) var mid: texture_2d<f32>;
@group(0) @binding(3) var near: texture_2d<f32>;
@group(0) @binding(4) var fg: texture_2d<f32>;

fn blocked(q: vec2f) -> f32 {
  let p = vec2i(clamp(q, vec2f(0.0), F.size.xy - 1.0));
  return max(max(textureLoad(far, p, 0).a, textureLoad(mid, p, 0).a), max(textureLoad(near, p, 0).a, textureLoad(fg, p, 0).a));
}

fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_RAYS) || isDark() || F.sun.z <= 0.0) { return vec4f(0.0); }
  let p = v.pos.xy;
  let N = 48;
  let dstep = (F.sun.xy - p) / f32(N);
  var lit = 0.0;
  var hidden = 0.0;
  var w = 1.0;
  var q = p + dstep * hash2(floor(p));
  for (var i = 0; i < N; i++) {
    let b = blocked(q);
    lit += (1.0 - b) * w;
    hidden += b;
    w *= 0.97;
    q += dstep;
  }
  // 路上完全没有遮挡（天上）或者完全挡死（山体里面）都不出光束
  let occl = hidden / f32(N);
  let edge = smoothstep(0.02, 0.25, occl) * (1.0 - smoothstep(0.7, 1.0, occl));
  let falloff = exp(-length(p - F.sun.xy) / (F.size.y * 0.9));
  // 光束落在物体上比落在空气里淡：物体本身已经被照亮了
  let onSolid = mix(1.0, 0.45, blocked(p));
  return vec4f(lit / f32(N) * edge * falloff * onSolid * F.sun.z * 0.55, 0.0, 0.0, 1.0);
}
