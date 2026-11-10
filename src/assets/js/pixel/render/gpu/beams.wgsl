// 夜里灯光的光束（逻辑分辨率）：路灯往下照的锥形、窗户斜着洒到地上的光、营火往四周散开的光。
// 每个像素对每束光：在光束的张角里、长度以内才有光；再从这个像素往灯的方向走一段，
// 路上碰到人物（女孩、猫、主角）就被挡掉一部分，于是人从光里走过时身后会留下一道跟着走的影子。
// 布景和地面不挡光：窗户本身就画在小屋上，拿小屋挡光的话光一出来就被挡死了。
// 光束叠在整个世界上面，所以灯泡附近几格要淡掉，落在布景本身上也弱一些，不然灯和小屋的像素图案会被罩住。

@group(0) @binding(1) var actors: texture_2d<f32>;
@group(0) @binding(2) var hero: texture_2d<f32>;
@group(0) @binding(3) var fg: texture_2d<f32>;

fn occluder(q: vec2f) -> f32 {
  let p = vec2i(clamp(q, vec2f(0.0), F.size.xy - 1.0));
  return max(textureLoad(actors, p, 0).a, textureLoad(hero, p, 0).a);
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  if (!fx(FX_BEAMS) || !isDark()) { return vec4f(0.0); }
  let p = floor(v.pos.xy) + 0.5;
  var acc = vec3f(0.0);
  for (var i = 0; i < i32(F.size.w); i++) {
    let l0 = F.lights[i * 3];
    let beam = F.lights[i * 3 + 2];
    if (beam.w <= 0.0) { continue; }
    let d = p - l0.xy;
    let dist = length(d);
    if (dist > beam.w || dist < 1.0) { continue; }
    // 张角：边缘柔和过渡，不是一刀切
    let cone = smoothstep(beam.z - 0.12, beam.z + 0.06, dot(d / dist, beam.xy));
    if (cone <= 0.0) { continue; }
    // 照到地面那一行为止，往下两行淡掉（地面的受光线还是亮的），不照进土层的剖面
    let l1 = F.lights[i * 3 + 1];
    let under = p.y - l1.w;
    if (under > 2.0) { continue; }
    let floorFade = 1.0 - clamp(under / 2.0, 0.0, 1.0);
    // 往灯走，沿途被人物挡住多少
    var through = 1.0;
    let STEPS = 14;
    for (var s = 1; s < STEPS; s++) {
      through *= 1.0 - occluder(p - d * (f32(s) / f32(STEPS))) * 0.7;
    }
    let fall = 1.0 - dist / beam.w;
    let nearSource = smoothstep(2.0, 9.0, dist); // 灯泡旁边留给灯本身的像素
    acc += l1.rgb * fall * fall * nearSource * cone * through * floorFade * l0.w;
  }
  // 人物和布景自己身上不再罩一层光雾，轮廓清楚（它们已经被点光源照亮了）
  let q = vec2i(clamp(p, vec2f(0.0), F.size.xy - 1.0));
  let onBody = max(occluder(p), textureLoad(fg, q, 0).a * 0.8);
  return vec4f(acc * 0.6 * (1.0 - onBody * 0.75), 1.0);
}
