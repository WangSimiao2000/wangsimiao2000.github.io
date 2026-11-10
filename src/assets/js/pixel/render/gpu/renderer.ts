/**
 * WebGPU 渲染器：每层先画到自己的纹理上（layer.wgsl），再按 COMPOSE 的规则叠到三张画布上（compose.wgsl）。
 * 和 Canvas 2D 渲染器读同一份绘制清单；光照、景深这些效果之后作为新的通道加在合成前后。
 */
import { loadAtlas } from '../../atlas.js';
import { COMPOSE, ERASE, LAYERS, NIGHT, STRIDE, type Canvases, type DrawList, type LayerName, type LayerRule, type Renderer } from '../../drawlist.js';
import { FADE_STOPS } from '../../sim/util.js';

const shader = (name: string) => fetch(new URL(`./${name}.wgsl`, import.meta.url)).then((r) => r.text());
const CANVASES = ['sky', 'world', 'hero'] as const;
const RULE_BYTES = 64;

/** 拿不到 WebGPU（浏览器不支持、没有适配器）时 reject，调用方决定怎么退回 */
export async function createGpuRenderer(c: Canvases): Promise<Renderer> {
  if (!('gpu' in navigator)) throw new Error('浏览器不支持 WebGPU');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('拿不到 WebGPU 适配器');
  const device = await adapter.requestDevice();
  device.lost.then((info) => console.error('[world] WebGPU 设备丢失', info.message));
  const [layerSrc, composeSrc] = await Promise.all([shader('layer'), shader('compose')]);
  const format = navigator.gpu.getPreferredCanvasFormat();
  const contexts = Object.fromEntries(
    CANVASES.map((k) => {
      const ctx = c[k].getContext('webgpu') as GPUCanvasContext;
      ctx.configure({ device, format, alphaMode: 'premultiplied' });
      return [k, ctx];
    }),
  ) as Record<(typeof CANVASES)[number], GPUCanvasContext>;

  /* ---------- 管线 ---------- */

  const layerModule = device.createShaderModule({ label: 'layer', code: layerSrc });
  const composeModule = device.createShaderModule({ label: 'compose', code: composeSrc });
  const over: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };
  const erase: GPUBlendState = {
    color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };
  const cmdLayout: GPUVertexBufferLayout = {
    arrayStride: STRIDE * 4,
    stepMode: 'instance',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x2' },
      { shaderLocation: 1, offset: 8, format: 'float32x4' },
      { shaderLocation: 2, offset: 24, format: 'float32x4' },
      { shaderLocation: 3, offset: 40, format: 'float32x3' },
    ],
  };
  const layerBindLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const layerPipeline = (blend: GPUBlendState) =>
    device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layerBindLayout] }),
      vertex: { module: layerModule, entryPoint: 'vs', buffers: [cmdLayout] },
      fragment: { module: layerModule, entryPoint: 'fs', targets: [{ format: 'rgba8unorm', blend }] },
    });
  const drawPipe = layerPipeline(over);
  const erasePipe = layerPipeline(erase);
  const composeBindLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const composePipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [composeBindLayout] }),
    vertex: { module: composeModule, entryPoint: 'vs' },
    fragment: { module: composeModule, entryPoint: 'fs', targets: [{ format, blend: over }] },
  });

  /* ---------- 资源 ---------- */

  const sizeBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  // 每条合成规则一份参数（淡出、夜色）
  const rules = LAYERS.map(() => device.createBuffer({ size: RULE_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const ruleOf = (l: LayerName): LayerRule => Object.values(COMPOSE).flat().find((r) => r.layer === l)!;
  let atlas = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  let cmdBuf: GPUBuffer | null = null;
  let layers: Record<LayerName, GPUTexture> | null = null;
  let layerBind: GPUBindGroup | null = null;
  let composeBinds: Record<LayerName, GPUBindGroup> | null = null;
  let W = 0;
  let H = 0;

  function bindGroups() {
    if (!layers) return;
    layerBind = device.createBindGroup({ layout: layerBindLayout, entries: [{ binding: 0, resource: { buffer: sizeBuf } }, { binding: 1, resource: atlas.createView() }] });
    composeBinds = Object.fromEntries(
      LAYERS.map((l, i) => [l, device.createBindGroup({ layout: composeBindLayout, entries: [{ binding: 0, resource: { buffer: rules[i] } }, { binding: 1, resource: layers![l].createView() }] })]),
    ) as Record<LayerName, GPUBindGroup>;
  }

  // 图集加载好之前，精灵命令从 1x1 的透明纹理取样，什么都画不出来（和 Canvas 2D 渲染器一样）
  const atlasLoaded = loadAtlas().then(
    async (img) => {
      const tex = device.createTexture({ size: [img.width, img.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      device.queue.copyExternalImageToTexture({ source: img }, { texture: tex }, [img.width, img.height]);
      atlas.destroy();
      atlas = tex;
      bindGroups();
    },
    (err) => console.error('[world]', err),
  );

  function writeRules(dark: boolean) {
    const d = new Float32Array(RULE_BYTES / 4);
    LAYERS.forEach((l, i) => {
      const r = ruleOf(l);
      d.fill(0);
      d.set([W, H, r.fade ? 1 : 0, r.night && dark ? 1 : 0], 0);
      d.set([NIGHT[0] / 255, NIGHT[1] / 255, NIGHT[2] / 255, NIGHT[3]], 4);
      d.set(FADE_STOPS.flat(), 8);
      device.queue.writeBuffer(rules[i], 0, d);
    });
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

  /** 画一层：连续的普通命令和擦除命令各成一段，按顺序切换管线 */
  function drawLayer(enc: GPUCommandEncoder, dl: DrawList, l: LayerName, first: number) {
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: layers![l].createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
    const cmds = dl.layers[l];
    if (cmds.count) {
      pass.setBindGroup(0, layerBind!);
      pass.setVertexBuffer(0, cmdBuf!);
      const d = cmds.data;
      let start = 0;
      while (start < cmds.count) {
        const erasing = (d[start * STRIDE] & ERASE) !== 0;
        let end = start + 1;
        while (end < cmds.count && ((d[end * STRIDE] & ERASE) !== 0) === erasing) end++;
        pass.setPipeline(erasing ? erasePipe : drawPipe);
        pass.draw(6, end - start, 0, first + start);
        start = end;
      }
    }
    pass.end();
  }

  // 图集到了才算就位：截图测试等 <html data-renderer> 出现再截，不会截到没有精灵的画面
  await atlasLoaded;

  return {
    resize(w, h) {
      W = w;
      H = h;
      if (layers) for (const t of Object.values(layers)) t.destroy();
      layers = Object.fromEntries(
        LAYERS.map((l) => [l, device.createTexture({ label: l, size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING })]),
      ) as Record<LayerName, GPUTexture>;
      device.queue.writeBuffer(sizeBuf, 0, new Float32Array([w, h, 0, 0]));
      bindGroups();
    },
    draw(dl, dark) {
      if (!layers || !layerBind || !composeBinds) return;
      writeRules(dark);
      const first = upload(dl);
      const enc = device.createCommandEncoder();
      for (const l of LAYERS) drawLayer(enc, dl, l, first[l]);
      for (const k of CANVASES) {
        const pass = enc.beginRenderPass({ colorAttachments: [{ view: contexts[k].getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
        pass.setPipeline(composePipe);
        for (const r of COMPOSE[k]) {
          if (r.darkOnly && !dark) continue;
          pass.setBindGroup(0, composeBinds[r.layer]);
          pass.draw(3);
        }
        pass.end();
      }
      device.queue.submit([enc.finish()]);
    },
  };
}
