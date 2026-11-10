/**
 * 启动渲染器。WebGPU 初始化是异步的，这期间返回的渲染器什么都不画（世界照常跑，卡片照常显示）。
 * 网址带 ?fx=0 关掉全部光效、?fx=lights,bloom 只开其中几项（调试、对比用）。
 *
 * 就位后在 <html data-renderer> 上标出状态，调试、测试和样式看这个：
 *   webgpu  正常；毛玻璃开着时再标 <html data-glass>，卡片这些表面才改成半透明（home.css）
 *   none    浏览器不支持 WebGPU（或拿不到适配器）：不画世界，页面是博客底色加实色卡片（home.css）
 */
import type { Canvases, Renderer } from '../drawlist.js';
import { createGpuRenderer, FX, FX_ALL } from './gpu/renderer.js';

function mark(kind: 'webgpu' | 'none', glass = false) {
  const root = document.documentElement;
  root.dataset.renderer = kind;
  root.toggleAttribute('data-glass', glass);
}

/** fx 参数：没有 = 全开，0 = 全关，逗号分隔的名字 = 只开这几项 */
export function parseEffects(v: string | null): number {
  if (v === null || v === '') return FX_ALL;
  if (v === '0') return 0;
  return v.split(',').reduce((bits, k) => bits | (FX[k.trim() as keyof typeof FX] ?? 0), 0);
}

export function startRenderer(c: Canvases): Renderer {
  let active: Renderer | null = null;
  let size: [number, number, number] = [0, 0, 1];
  const effects = parseEffects(new URLSearchParams(location.search).get('fx'));
  createGpuRenderer(c, effects).then(
    (r) => {
      r.resize(...size);
      active = r;
      mark('webgpu', (effects & FX.glass) !== 0);
    },
    (err) => {
      console.warn('[world] WebGPU 用不了，不画像素世界：', err);
      mark('none');
    },
  );
  return {
    resize(w, h, S) {
      size = [w, h, S];
      active?.resize(w, h, S);
    },
    draw(dl, dark, view) {
      active?.draw(dl, dark, view);
    },
  };
}
