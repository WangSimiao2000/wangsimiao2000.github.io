// 光照图（逻辑分辨率）：每个像素被点光源照到多少（a）、染上什么颜色（rgb，已乘亮度）。
// 衰减分 4 档，一圈圈的台阶和像素画一个调性。合成时按这张图把夜色照淡、加上暖光。
// 灯下面多半是地面和土层的剖面，光往下衰减得快很多，不会在土里照出一个半圆。

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_LIGHTS)) { return vec4f(0.0); }
  let p = floor(v.pos.xy) + 0.5;
  var total = 0.0;
  var color = vec3f(0.0);
  for (var i = 0; i < i32(F.size.w); i++) {
    let l0 = F.lights[i * 3];
    let l1 = F.lights[i * 3 + 1];
    let below = p.y > l0.y;
    let d = length((p - l0.xy) * vec2f(1.0, select(1.2, 3.0, below)));
    var a = clamp(1.0 - d / l0.z, 0.0, 1.0);
    a = floor(a * a * 4.0 + 0.5) / 4.0;
    total += a * l0.w;
    color += l1.rgb * a * l0.w;
  }
  return vec4f(color, total);
}
