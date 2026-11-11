/**
 * WebGPU 渲染器。每帧的通道（都读同一份绘制清单）：
 *
 *   1. 图层      每层画到自己的纹理（逻辑分辨率，layer.wgsl）
 *   2. 光照图    点光源照到哪里、多亮（lightmap.wgsl）
 *   3. 景深      远景、后排、前景按离镜头的远近各自模糊（blur.wgsl）
 *   4. 辉光      发光的层和天空里的日月叠在一起，逐级缩小再放大叠回来（bloom.wgsl）
 *   5. 体积光    太阳 / 月亮从山脊、树冠缝里漏下来的光束（rays.wgsl）；夜里灯光洒出来的光束，人物会挡出影子（beams.wgsl）
 *   6. 合成      世界画布先画天空渐变（sky.wgsl），再按 COMPOSE 把各组叠到各张画布上（compose.wgsl，顺带调色），
 *                镜头光斑紧跟在自己那层后面（bokeh.wgsl），最后叠辉光和光束（overlay.wgsl）
 *   7. 毛玻璃    天空 + 世界再合成一份逻辑分辨率的、模糊掉，只画在卡片、阅读面板这些表面后面（glass.wgsl）；
 *                打开文章时世界照常清楚，主角坐在地上看书的样子看得见
 *   8. 暗角      世界画布边上压暗（overlay.wgsl 的 vignetteFs），前景画布合成时自己压
 *
 * 2-5、7、8 和调色、投影是效果，按 effects 开关跳过（网址 ?fx=0 全关、?fx=lights,bloom 只开几项，调试和画面对比用）。
 * 所有画布都按屏幕像素画（scale = 逻辑像素 × 设备像素比，最多 2 倍）：模糊和泛光才是平滑的，清晰的层按最近邻取像素。
 */
import { loadAtlas } from '../../atlas.js';
import { COMPOSE, ERASE, LAYERS, NIGHT, STRIDE, type CanvasName, type Canvases, type DrawList, type Group, type LayerName, type Renderer, type View } from '../../drawlist.js';
import { FADE_STOPS, rgb } from '../../sim/util.js';

export const FX = { lights: 1, dof: 2, bloom: 4, rays: 8, grade: 16, beams: 32, glass: 64, front: 128, bokeh: 256, vignette: 512, shadow: 1024 } as const;
export const FX_ALL = Object.values(FX).reduce((a, b) => a | b, 0);

const CANVASES: CanvasName[] = ['world', 'hero', 'front'];
const MAX_GLASS = 16;
const GLASS_SIGMA = 7; // 毛玻璃糊多少（逻辑像素的标准差）
const GLASS_SHARP = 1.2; // 毛玻璃透出来的亮点糊多少
const FRONT_ALPHA = 0.92; // 前景压在卡片上，留一点点透
const MAX_LIGHTS = 48;
const MAX_BOKEH = 64;
const BOKEH_FLOATS = 8; // 和 bokeh.wgsl 的 Dot 一一对应
const FRAME_FLOATS = (10 + 2 + MAX_LIGHTS * 3) * 4; // 和 frame.wgsl 的 Frame 一一对应
const DOF_SIGMA = 0.5; // 每一级深度模糊多少（逻辑像素的标准差）：远山 4 级 = 2，后排 2 级 = 1，前景 6 级 = 3
const BLOOM_LEVELS = 4; // 辉光逐级缩小几次（每级一半），再逐级放大叠回来：光晕大而柔
const BLOOM = { day: 0.22, night: 0.45 };
const GRADE = 0.12; // 往群系色调偏多少
/** 空气透视：远景每一级深度往天空的颜色靠多少（开了景深时代替自下而上的淡出，山的轮廓才看得清） */
const FOG = { day: 0.07, night: 0.04 };
const LOGICAL = 'rgba8unorm';
const HDR = 'rgba16float';
/** 营火火焰进辉光时的亮度倍数：和合成时同一组数（drawlist.ts 里 glow 那组的 emit） */
const GLOW_EMIT = COMPOSE.world.find((g) => g.layers.includes('glow'))?.emit ?? { day: 1, night: 1 };

const shader = (name: string) => fetch(new URL(`./${name}.wgsl`, import.meta.url)).then((r) => r.text());

/** 拿不到 WebGPU（浏览器不支持、没有适配器）时 reject，调用方决定怎么退回 */
export async function createGpuRenderer(c: Canvases, effects = FX_ALL): Promise<Renderer> {
  if (!('gpu' in navigator)) throw new Error('浏览器不支持 WebGPU');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('拿不到 WebGPU 适配器');
  const device = await adapter.requestDevice();
  device.lost.then((info) => console.error('[world] WebGPU 设备丢失', info.message));
  const names = ['frame', 'layer', 'lightmap', 'blur', 'bloom', 'rays', 'beams', 'compose', 'overlay', 'glass', 'bokeh', 'sky'] as const;
  const src = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await shader(n)]))) as Record<(typeof names)[number], string>;
  const format = navigator.gpu.getPreferredCanvasFormat();
  const contexts = Object.fromEntries(
    CANVASES.map((k) => {
      const ctx = c[k].getContext('webgpu') as GPUCanvasContext;
      ctx.configure({ device, format, alphaMode: 'premultiplied' });
      return [k, ctx];
    }),
  ) as Record<CanvasName, GPUCanvasContext>;

  /* ---------- 管线 ---------- */

  const module = (name: (typeof names)[number], withFrame = true) => device.createShaderModule({ label: name, code: withFrame ? src.frame + '\n' + src[name] : src[name] });
  const over: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };
  // 光：颜色直接加上去；不透明度只补在本来透明的地方（见 overlay.wgsl）
  const light: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    alpha: { srcFactor: 'one-minus-dst-alpha', dstFactor: 'one', operation: 'add' },
  };
  const erase: GPUBlendState = {
    color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };
  const layerModule = module('layer', false);
  const cmdLayout: GPUVertexBufferLayout = {
    arrayStride: STRIDE * 4,
    stepMode: 'instance',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' },
      { shaderLocation: 1, offset: 8, format: 'float32x4' },
      { shaderLocation: 2, offset: 24, format: 'float32x4' },
      { shaderLocation: 3, offset: 40, format: 'float32x3' },
      { shaderLocation: 4, offset: 52, format: 'float32' },
    ],
  };
  // 普通和擦除两条管线共用一套绑定，布局要显式给出（'auto' 生成的布局不能跨管线用）
  const layerLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const layerPipe = (blend: GPUBlendState) =>
    device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layerLayout] }),
      vertex: { module: layerModule, entryPoint: 'vs', buffers: [cmdLayout] },
      fragment: { module: layerModule, entryPoint: 'fs', targets: [{ format: LOGICAL, blend }] },
    });
  const drawPipe = layerPipe(over);
  const erasePipe = layerPipe(erase);
  /** 全屏通道 */
  const fullPipe = (m: GPUShaderModule, target: GPUTextureFormat, blend?: GPUBlendState, entryPoint = 'fs') =>
    device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint, targets: [{ format: target, blend }] } });
  const lightPipe = fullPipe(module('lightmap'), HDR);
  const blurModule = module('blur', false);
  const blurPipe = { [LOGICAL]: fullPipe(blurModule, LOGICAL) } as Record<string, GPURenderPipeline>;
  const bloomModule = module('bloom');
  const bloomPipe = fullPipe(bloomModule, HDR);
  const bloomDownPipe = fullPipe(bloomModule, HDR, undefined, 'down');
  const add: GPUBlendState = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } };
  const bloomUpPipe = fullPipe(bloomModule, HDR, add, 'up');
  const skyModule = module('sky');
  const skyPipe = fullPipe(skyModule, format);
  const skyGlassPipe = fullPipe(skyModule, LOGICAL);
  const raysPipe = fullPipe(module('rays'), HDR);
  const beamsPipe = fullPipe(module('beams'), HDR);
  const composeModule = module('compose');
  const composePipe = fullPipe(composeModule, format, over);
  const composeGlassPipe = fullPipe(composeModule, LOGICAL, over); // 毛玻璃用的那份，画到逻辑分辨率的纹理上
  const glassPipe = fullPipe(module('glass', false), format, over);
  const overlayModule = module('overlay');
  const overlayPipe = fullPipe(overlayModule, format, light);
  const vignettePipe = fullPipe(overlayModule, format, over, 'vignetteFs');
  const bokehModule = module('bokeh');
  const bokehPipe = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: bokehModule,
      entryPoint: 'vsDot',
      buffers: [{ arrayStride: BOKEH_FLOATS * 4, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }] }],
    },
    fragment: { module: bokehModule, entryPoint: 'fsDot', targets: [{ format, blend: light }] },
  });
  // 世界画布和前景画布上的光斑共用一份
  const bokehBuf = device.createBuffer({ size: MAX_BOKEH * BOKEH_FLOATS * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const bokehData = new Float32Array(MAX_BOKEH * BOKEH_FLOATS);

  /* ---------- 不随尺寸变的资源 ---------- */

  const uniform = (bytes: number, data?: Float32Array<ArrayBuffer>) => {
    const b = device.createBuffer({ size: bytes, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    if (data) device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const frameBuf = uniform(FRAME_FLOATS * 4);
  const frameData = new Float32Array(FRAME_FLOATS);
  const sizeBuf = uniform(16); // 逻辑宽高（layer.wgsl）
  const scaleBuf = uniform(16); // 世界画布像素 / 逻辑像素（overlay.wgsl、bokeh.wgsl、sky.wgsl）
  const unitBuf = uniform(16, new Float32Array([1, 0, 0, 0])); // 毛玻璃那份按逻辑分辨率画：放大 1 倍
  const linear = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const blank = device.createTexture({ size: [1, 1], format: LOGICAL, usage: GPUTextureUsage.TEXTURE_BINDING });
  /*
   * 每个合成组一份参数；毛玻璃要把天空和世界再合成一遍（target 'glass'），参数单独一份。
   * 天空和世界画在同一张画布上，画布不透明：阅读时由这里把世界往下沉、天空不动（贴着屏幕的组）
   */
  type Target = CanvasName | 'glass';
  const entry = (canvas: Target, g: Group) => ({ canvas, g, buf: uniform(96) });
  const groups = [
    ...CANVASES.flatMap((k) => COMPOSE[k].map((g) => entry(k, g))),
    ...COMPOSE.world.map((g) => entry('glass', g)),
  ];
  /** 这一组这一帧画不画：只在深色模式合成的组、影子开没开 */
  const skip = (e: (typeof groups)[number], dark: boolean) => (e.g.darkOnly && !dark) || (e.g.layers.includes('shadow') && !(effects & FX.shadow));

  const glassBuf = uniform((1 + MAX_GLASS * 2) * 16);

  // 图集加载好才算就位：截图测试等 <html data-renderer> 出现再截，不会截到没有精灵的画面
  const img = await loadAtlas();
  const atlas = device.createTexture({ size: [img.width, img.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  device.queue.copyExternalImageToTexture({ source: img }, { texture: atlas }, [img.width, img.height]);

  /* ---------- 随尺寸变的资源 ---------- */

  const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
  let W = 0;
  let H = 0;
  let scale = 1; // 世界画布的像素 / 逻辑像素
  let T: ReturnType<typeof makeTargets> | null = null;
  let cmdBuf: GPUBuffer | null = null;

  function makeTargets() {
    const tex = (label: string, fmt: GPUTextureFormat = LOGICAL) => device.createTexture({ label, size: [W, H], format: fmt, usage });
    // 按屏幕分辨率画的层（drawlist.ts 的 hires）：纹理和世界画布一样大
    const hires = new Set(groups.flatMap(({ g }) => (g.hires ? g.layers : [])));
    const big = (label: string) => device.createTexture({ label, size: [Math.round(W * scale), Math.round(H * scale)], format: LOGICAL, usage });
    const layers = Object.fromEntries(LAYERS.map((l) => [l, hires.has(l) ? big(l) : tex(l)])) as Record<LayerName, GPUTexture>;
    const blurred: Partial<Record<LayerName, GPUTexture>> = {};
    for (const { g } of groups) g.depth?.forEach((d, i) => d > 0 && (blurred[g.layers[i]] = tex(`${g.layers[i]}-dof`)));
    const t = {
      layers,
      blurred,
      scratch: tex('blur-scratch'),
      lightmap: tex('lightmap', HDR),
      bloomSrc: tex('bloom-src', HDR),
      // 辉光的几级：一级比一级小一半
      bloom: Array.from({ length: BLOOM_LEVELS }, (_, i) =>
        device.createTexture({ label: `bloom-${i}`, size: [Math.max(1, W >> (i + 1)), Math.max(1, H >> (i + 1))], format: HDR, usage }),
      ),
      rays: tex('rays', HDR),
      beams: tex('beams', HDR),
      glassSrc: tex('glass-src'),
      glassBlur: tex('glass-blur'),
      glassSharp: tex('glass-sharp'),
    };
    const bind = (pipe: GPURenderPipeline, entries: (GPUBindingResource | GPUTexture)[]) =>
      device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: entries.map((r, i) => ({ binding: i, resource: r instanceof GPUTexture ? r.createView() : r })),
      });
    // 每处模糊有自己的参数：同一帧里不能改同一块 uniform（writeBuffer 在整批命令执行前就生效了）
    const blurBinds = (from: GPUTexture, mid: GPUTexture, pipe: GPURenderPipeline, sigma: number) => ({
      h: bind(pipe, [{ buffer: uniform(16, new Float32Array([1, 0, sigma, 0])) }, from]),
      v: bind(pipe, [{ buffer: uniform(16, new Float32Array([0, 1, sigma, 0])) }, mid]),
    });
    const depthOf = (l: LayerName) => groups.flatMap(({ g }) => g.layers.map((x, i) => [x, g.depth?.[i] ?? 0] as const)).find(([x]) => x === l)?.[1] ?? 0;
    const F = { buffer: frameBuf };
    return {
      ...t,
      layerBind: device.createBindGroup({ layout: layerLayout, entries: [{ binding: 0, resource: { buffer: sizeBuf } }, { binding: 1, resource: atlas.createView() }] }),
      lightBind: bind(lightPipe, [F]),
      dofBinds: Object.fromEntries(Object.keys(blurred).map((l) => [l, blurBinds(layers[l as LayerName], t.scratch, blurPipe[LOGICAL], depthOf(l as LayerName) * DOF_SIGMA)])) as Partial<Record<LayerName, { h: GPUBindGroup; v: GPUBindGroup }>>,
      bloomSrcBind: device.createBindGroup({
        layout: bloomPipe.getBindGroupLayout(0),
        entries: [F, layers.emissive, layers.glow, layers.sky, null, linear, layers.far, layers.mid, layers.near, layers.back, layers.fg]
          .map((r, i) => r && { binding: i, resource: r instanceof GPUTexture ? r.createView() : r })
          .filter((e) => e !== null),
      }),
      // 往下：原图 -> 第 0 级 -> 第 1 级……；往上：第 n 级叠回第 n-1 级
      bloomDown: [t.bloomSrc, ...t.bloom.slice(0, -1)].map((from) => device.createBindGroup({ layout: bloomDownPipe.getBindGroupLayout(0), entries: [{ binding: 4, resource: from.createView() }, { binding: 5, resource: linear }] })),
      bloomUp: t.bloom.slice(1).map((from) => device.createBindGroup({ layout: bloomUpPipe.getBindGroupLayout(0), entries: [{ binding: 4, resource: from.createView() }, { binding: 5, resource: linear }] })),
      skyBind: bind(skyPipe, [F, { buffer: scaleBuf }]),
      skyGlassBind: bind(skyGlassPipe, [F, { buffer: unitBuf }]),
      raysBind: bind(raysPipe, [F, layers.far, layers.mid, layers.near, layers.fg, linear]),
      beamsBind: bind(beamsPipe, [F, layers.actors, layers.hero, layers.fg]),
      glassBlurBinds: blurBinds(t.glassSrc, t.scratch, blurPipe[LOGICAL], GLASS_SIGMA),
      glassSharpBinds: blurBinds(t.glassSrc, t.scratch, blurPipe[LOGICAL], GLASS_SHARP),
      glassBind: bind(glassPipe, [{ buffer: glassBuf }, t.glassBlur, linear, t.glassSharp]),
      bokehBind: bind(bokehPipe, [F, { buffer: scaleBuf }]),
      // vignetteFs 只用到 0 号和 4 号绑定，自动生成的布局里只有这两个
      vignetteBind: device.createBindGroup({ layout: vignettePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: F }, { binding: 4, resource: { buffer: scaleBuf } }] }),
      composeBinds: groups.map(({ canvas, g, buf }) => {
        const tx = [0, 1, 2].map((i) => {
          const l = g.layers[i];
          if (!l) return blank;
          return effects & FX.dof && (g.depth?.[i] ?? 0) > 0 ? blurred[l]! : layers[l];
        });
        return bind(canvas === 'glass' ? composeGlassPipe : composePipe, [F, { buffer: buf }, ...tx, linear, t.lightmap]);
      }),
      overlayBind: bind(overlayPipe, [F, t.bloom[0], t.rays, linear, { buffer: scaleBuf }, t.beams]),
    };
  }

  /* ---------- 每帧 ---------- */

  function writeFrame(dl: DrawList, dark: boolean, view: View) {
    const d = frameData;
    d.fill(0);
    const lights = dl.lights.slice(0, MAX_LIGHTS);
    const tint = rgb(dl.env.tint);
    d.set([W, H, effects, lights.length], 0);
    d.set([dl.sun[0], dl.sun[1], dl.env.rays, dark ? 1 : 0], 4);
    d.set([tint[0] / 255, tint[1] / 255, tint[2] / 255, dark ? BLOOM.night : BLOOM.day], 8);
    d.set([NIGHT[0] / 255, NIGHT[1] / 255, NIGHT[2] / 255, NIGHT[3]], 12);
    const amb = rgb(dl.env.ambient);
    d.set([amb[0] / 255, amb[1] / 255, amb[2] / 255, GLOW_EMIT[dark ? 'night' : 'day']], 16);
    const ray = rgb(dl.env.light);
    d.set([ray[0] / 255, ray[1] / 255, ray[2] / 255, 0], 20);
    // 空气透视：远景往地平线的颜色靠
    const fog = rgb(dl.env.skyHorizon);
    d.set([fog[0] / 255, fog[1] / 255, fog[2] / 255, 0], 24);
    const top = rgb(dl.env.skyTop);
    d.set([top[0] / 255, top[1] / 255, top[2] / 255, dl.env.skyY[1]], 28);
    d.set([fog[0] / 255, fog[1] / 255, fog[2] / 255, dl.env.skyY[0]], 32);
    // 天空在画布上往右挪多少：对齐屏幕（主角画布不做亚像素平移），再加上天空自己视差的小数（sky.ts）
    const skyX = view.hero[0] / scale + (dl.shift.sky ?? 0);
    d.set([skyX, view.hero[1] / scale, 0, 0], 36);
    d.set(FADE_STOPS.flat(), 40);
    lights.forEach((l, i) => {
      const [r, g, b] = rgb(l.color);
      const bm = l.beam;
      d.set([l.x, l.y, l.radius, l.intensity, r / 255, g / 255, b / 255, bm?.floor ?? 1e6, bm?.dir[0] ?? 0, bm?.dir[1] ?? 0, bm?.cos ?? 1, bm?.length ?? 0], 48 + i * 12);
    });
    device.queue.writeBuffer(frameBuf, 0, d);
    // 天空按主角画布（不平移、不下沉）对齐屏幕，世界跟着主角画布往下沉
    const sink = view.hero[1] / scale;
    for (const { canvas, g, buf } of groups) {
      const s = canvas === 'glass' ? 1 : scale;
      // 前景压在卡片上：打开文章时淡出，不挡正文
      const opacity = canvas === 'front' ? FRONT_ALPHA * (1 - view.focus) : 1;
      // 线性插值取样：景深模糊过的层；还有毛玻璃那份的所有层（它按逻辑分辨率画，按整格取的话天空的亚像素偏移会被截掉，
      // 透过卡片看到的月亮一格一格地跳；反正之后要大幅模糊，插值看不出变软）
      const soft = [0, 1, 2].map((i) => (canvas === 'glass' || (effects & FX.dof && (g.depth?.[i] ?? 0) > 0) ? 1 : 0));
      const grade = effects & FX.grade && (g.lit || g.fade) ? GRADE : 0;
      // 亚像素偏移只对模糊过的层有意义（线性插值取样）；清晰的层按最近邻取，偏移了也还是跳格
      const shift = [0, 1, 2].map((i) => (soft[i] ? (dl.shift[g.layers[i]] ?? 0) : 0));
      const inWorld = canvas === 'world' || canvas === 'glass';
      if (g.screen && inWorld) shift[0] = skyX;
      const rise = !g.screen && inWorld ? sink : 0;
      const vignette = canvas === 'front' && effects & FX.vignette ? 1 : 0;
      const look = effects & FX.grade && !g.screen ? 1 : 0;
      // 有景深时远近靠模糊和空气透视区分，远景不再自下而上淡出（山顶淡没了就看不出是山）
      const aerial = effects & FX.dof && g.fade;
      const fade = g.fade && !aerial ? 1 : 0;
      const fog = [0, 1, 2].map((i) => (aerial ? (g.depth?.[i] ?? 0) * (dark ? FOG.night : FOG.day) : 0));
      const ambient = effects & FX.grade && (g.lit || g.fade) ? 1 : 0;
      device.queue.writeBuffer(buf, 0, new Float32Array([g.layers.length, fade, g.night ? 1 : 0, g.lit ? 1 : 0, ...soft, s, grade, opacity, look, vignette, ...shift, rise, ...fog, ambient, g.emit ? g.emit[dark ? 'night' : 'day'] : 0, g.hires ? scale : 0, 0, 0]));
    }
  }

  /**
   * 失焦的光点按所在的层排好、上传，返回每层的 [起始实例号, 个数]。前景的光点跟着前景画布一起在对焦拉近时淡出。
   * 光点画在世界画布上：屏幕坐标的（镜头光斑）要抵消世界画布的亚像素平移，世界坐标的阅读时跟着世界下沉
   */
  function uploadBokeh(dl: DrawList, view: View): Partial<Record<LayerName, [number, number]>> {
    const out: Partial<Record<LayerName, [number, number]>> = {};
    if (!(effects & FX.bokeh)) return out;
    const toCanvas = view.hero[0] / scale;
    const sink = view.hero[1] / scale;
    const dots = [...dl.bokeh].sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer)).slice(0, MAX_BOKEH);
    dots.forEach((b, i) => {
      const [r, g, bl] = rgb(b.color);
      const alpha = b.layer === 'front' ? b.alpha * (1 - view.focus) : b.alpha;
      bokehData.set([b.x + (b.screen ? toCanvas : 0), b.y + (b.screen ? 0 : sink), b.r, alpha, r / 255, g / 255, bl / 255, 0], i * BOKEH_FLOATS);
      const range = (out[b.layer] ??= [i, 0]);
      range[1]++;
    });
    if (dots.length) device.queue.writeBuffer(bokehBuf, 0, bokehData, 0, dots.length * BOKEH_FLOATS);
    return out;
  }

  /** 把所有层的命令拼成一块上传，返回每层在里面的起始实例号 */
  function upload(dl: DrawList): Record<LayerName, number> {
    const total = LAYERS.reduce((n, l) => n + dl.layers[l].count, 0);
    const bytes = Math.max(1, total) * STRIDE * 4;
    if (!cmdBuf || cmdBuf.size < bytes) {
      cmdBuf?.destroy();
      cmdBuf = device.createBuffer({ size: Math.max(bytes * 2, 64 * 1024), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }
    const first = {} as Record<LayerName, number>;
    let at = 0;
    for (const l of LAYERS) {
      const cmds = dl.layers[l];
      first[l] = at;
      if (cmds.count) device.queue.writeBuffer(cmdBuf, at * STRIDE * 4, cmds.data, 0, cmds.count * STRIDE);
      at += cmds.count;
    }
    return first;
  }

  const pass = (enc: GPUCommandEncoder, target: GPUTexture, load: GPULoadOp = 'clear') =>
    enc.beginRenderPass({ colorAttachments: [{ view: target.createView(), loadOp: load, storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
  /** 一个全屏通道 */
  function full(enc: GPUCommandEncoder, target: GPUTexture, pipe: GPURenderPipeline, bind: GPUBindGroup) {
    const p = pass(enc, target);
    p.setPipeline(pipe);
    p.setBindGroup(0, bind);
    p.draw(3);
    p.end();
  }
  /** 横竖两遍高斯模糊：from -> mid -> to（from 和 to 可以是同一张；参数在 binds 里） */
  function blur(enc: GPUCommandEncoder, binds: { h: GPUBindGroup; v: GPUBindGroup }, mid: GPUTexture, to: GPUTexture, fmt: string) {
    full(enc, mid, blurPipe[fmt], binds.h);
    full(enc, to, blurPipe[fmt], binds.v);
  }

  /** 画一层：连续的普通命令和擦除命令各成一段，按顺序切换管线 */
  function drawLayer(enc: GPUCommandEncoder, dl: DrawList, l: LayerName, first: number) {
    const p = pass(enc, T!.layers[l]);
    const cmds = dl.layers[l];
    if (cmds.count) {
      p.setBindGroup(0, T!.layerBind);
      p.setVertexBuffer(0, cmdBuf!);
      const d = cmds.data;
      let start = 0;
      while (start < cmds.count) {
        const erasing = (d[start * STRIDE] & ERASE) !== 0;
        let end = start + 1;
        while (end < cmds.count && ((d[end * STRIDE] & ERASE) !== 0) === erasing) end++;
        p.setPipeline(erasing ? erasePipe : drawPipe);
        p.draw(6, end - start, 0, first + start);
        start = end;
      }
    }
    p.end();
  }

  /** 把各组合成到一张画布（或毛玻璃用的那张纹理）上 */
  function composeTo(enc: GPUCommandEncoder, k: Target, dark: boolean, glassCount: number, dots: Partial<Record<LayerName, [number, number]>> = {}) {
    const p = pass(enc, k === 'glass' ? T!.glassSrc : contexts[k].getCurrentTexture());
    // 前景画布关掉时清成透明就结束
    if (k === 'front' && !(effects & FX.front)) return p.end();
    // 天空的底色：天顶到地平线的渐变（天空画进世界画布时）
    if (k === 'world' || k === 'glass') {
      p.setPipeline(k === 'glass' ? skyGlassPipe : skyPipe);
      p.setBindGroup(0, k === 'glass' ? T!.skyGlassBind : T!.skyBind);
      p.draw(3);
    }
    p.setPipeline(k === 'glass' ? composeGlassPipe : composePipe);
    groups.forEach((e, i) => {
      const { canvas, g } = e;
      if (canvas !== k || skip(e, dark)) return;
      p.setBindGroup(0, T!.composeBinds[i]);
      p.draw(3);
      // 这一组里的层上有失焦的光点：紧跟着叠上去，后面的组照常盖住它
      for (const l of g.layers) {
        const range = dots[l];
        if (!range) continue;
        p.setPipeline(bokehPipe);
        p.setBindGroup(0, T!.bokehBind);
        p.setVertexBuffer(0, bokehBuf);
        p.draw(6, range[1], 0, range[0]);
        p.setPipeline(k === 'glass' ? composeGlassPipe : composePipe);
      }
    });
    if (k === 'world' && effects & (FX.bloom | FX.rays | FX.beams)) {
      p.setPipeline(overlayPipe);
      p.setBindGroup(0, T!.overlayBind);
      p.draw(3);
    }
    if (k === 'world' && effects & FX.glass && glassCount > 0) {
      p.setPipeline(glassPipe);
      p.setBindGroup(0, T!.glassBind);
      p.draw(3);
    }
    if (k === 'world' && effects & FX.vignette) {
      p.setPipeline(vignettePipe);
      p.setBindGroup(0, T!.vignetteBind);
      p.draw(3);
    }
    p.end();
  }

  function writeGlass(view: View): number {
    const rects = view.glass.slice(0, MAX_GLASS);
    const d = new Float32Array((1 + MAX_GLASS * 2) * 4);
    d.set([rects.length, 0, c.world.width, c.world.height], 0);
    rects.forEach((r, i) => {
      d.set([r.x, r.y, r.w, r.h], 4 + i * 4);
      d.set([r.radius, r.alpha, 0, 0], 4 + (MAX_GLASS + i) * 4);
    });
    device.queue.writeBuffer(glassBuf, 0, d);
    return rects.length;
  }

  return {
    resize(w, h, S) {
      W = w;
      H = h;
      // 世界画布按屏幕像素画；高分屏最多按 2 倍，再高看不出区别，只是更费
      scale = S * Math.min(2, window.devicePixelRatio || 1);
      for (const k of CANVASES) {
        c[k].width = Math.round(w * scale);
        c[k].height = Math.round(h * scale);
      }
      if (T) for (const v of [...Object.values(T.layers), ...Object.values(T.blurred), T.scratch, T.lightmap, T.bloomSrc, ...T.bloom, T.rays, T.beams, T.glassSrc, T.glassBlur, T.glassSharp]) v!.destroy();
      device.queue.writeBuffer(sizeBuf, 0, new Float32Array([w, h, 0, 0]));
      T = makeTargets();
    },
    draw(dl, dark, view) {
      if (!T) return;
      writeFrame(dl, dark, view);
      device.queue.writeBuffer(scaleBuf, 0, new Float32Array([scale, 0, 0, 0]));
      const glassCount = effects & FX.glass ? writeGlass(view) : 0;
      const first = upload(dl);
      const enc = device.createCommandEncoder();
      for (const l of LAYERS) drawLayer(enc, dl, l, first[l]);
      if (effects & FX.lights) full(enc, T.lightmap, lightPipe, T.lightBind);
      if (effects & FX.dof) {
        for (const l of Object.keys(T.blurred) as LayerName[]) blur(enc, T.dofBinds[l]!, T.scratch, T.blurred[l]!, LOGICAL);
      }
      if (effects & FX.bloom) {
        full(enc, T.bloomSrc, bloomPipe, T.bloomSrcBind);
        T.bloom.forEach((to, i) => full(enc, to, bloomDownPipe, T!.bloomDown[i]));
        for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
          const p = pass(enc, T.bloom[i], 'load');
          p.setPipeline(bloomUpPipe);
          p.setBindGroup(0, T.bloomUp[i]);
          p.draw(3);
          p.end();
        }
      }
      if (effects & FX.rays) full(enc, T.rays, raysPipe, T.raysBind);
      if (effects & FX.beams) full(enc, T.beams, beamsPipe, T.beamsBind);
      if (effects & FX.glass && glassCount > 0) {
        composeTo(enc, 'glass', dark, 0);
        blur(enc, T.glassBlurBinds, T.scratch, T.glassBlur, LOGICAL);
        blur(enc, T.glassSharpBinds, T.scratch, T.glassSharp, LOGICAL);
      }
      const dots = uploadBokeh(dl, view);
      for (const k of CANVASES) composeTo(enc, k, dark, glassCount, dots);
      device.queue.submit([enc.finish()]);
    },
  };
}

