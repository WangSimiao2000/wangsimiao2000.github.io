// 一维高斯模糊（逻辑分辨率），横竖各跑一次。景深和辉光都用它。输入输出都是预乘 alpha。

struct Blur {
  dir: vec2f,  // (1, 0) 横向，(0, 1) 纵向
  sigma: f32,  // 标准差（逻辑像素）
  _pad: f32,
};
@group(0) @binding(0) var<uniform> b: Blur;
@group(0) @binding(1) var src: texture_2d<f32>;

struct V { @builtin(position) pos: vec4f };

@vertex fn vs(@builtin(vertex_index) i: u32) -> V {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: V;
  o.pos = vec4f(p[i], 0.0, 1.0);
  return o;
}

@fragment fn fs(v: V) -> @location(0) vec4f {
  let size = vec2i(textureDimensions(src));
  let p = vec2i(v.pos.xy);
  let r = i32(ceil(b.sigma * 2.5));
  var acc = vec4f(0.0);
  var wsum = 0.0;
  for (var i = -r; i <= r; i++) {
    let w = exp(-f32(i * i) / (2.0 * b.sigma * b.sigma));
    let q = clamp(p + vec2i(b.dir * f32(i)), vec2i(0), size - 1);
    acc += textureLoad(src, q, 0) * w;
    wsum += w;
  }
  return acc / wsum;
}
