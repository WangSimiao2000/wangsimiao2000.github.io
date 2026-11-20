// 日月的体积光（逻辑分辨率）：从每个像素往太阳 / 月亮的方向走一段，把沿途「透得过来的天空」按离光源的远近累加起来。
// 光源附近的天空最亮，山、树挡住的地方是暗的，于是从山脊、树冠的缝里漏出一道道光束；
// 太阳低的时候（日出日落）光源贴着山，光束最明显。颜色和强度跟着一天里的时刻走（daytime.ts）。
// 起点按像素随机错开一点，消掉等距取样造成的一圈圈条纹。

@group(0) @binding(1) var occ: texture_2d<f32>; // 挡光遮罩（occlude.wgsl）
@group(0) @binding(2) var samp: sampler;

/** 画布上这一点被挡住了多少 */
fn blocked(q: vec2f) -> f32 { return textureSampleLevel(occ, samp, worldUV(q), 0.0).r; }

/** 主光源（日 / 月）在画布上的位置 */
fn sun() -> vec2f { return skyToCanvas(F.sun.xy); }

/** 这一点有多少光射出来：是天空（没被挡住）、离光源越近越亮 */
fn source(q: vec2f) -> f32 {
  return (1.0 - blocked(q)) * exp(-length(q - sun()) / 46.0);
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_RAYS) || F.sun.z <= 0.0) { return vec4f(0.0); }
  let p = v.pos.xy;
  let N = 56;
  let dstep = (sun() - p) / f32(N);
  var acc = 0.0;
  var w = 1.0;
  var q = p + dstep * hash2(floor(p));
  for (var i = 0; i < N; i++) {
    acc += source(q) * w;
    w *= 0.972;
    q += dstep;
  }
  // 光束落在物体上比落在空气里淡：物体本身已经被照亮了
  let onSolid = mix(1.0, 0.45, blocked(p));
  return vec4f(F.rayColor.rgb * (acc / f32(N)) * onSolid * F.sun.z * 0.9, 1.0);
}
