/**
 * 选渲染器。迁移期间：网址带 ?gpu 时用 WebGPU，拿不到 WebGPU 或者没带参数就用 Canvas 2D。
 * ?gpu&fx=0 关掉全部光效（画面和 Canvas 2D 一致，画面回归测试用），?gpu&fx=lights,bloom 只开其中几项。
 * WebGPU 初始化是异步的，这期间返回的渲染器什么都不画（世界照常跑，卡片照常显示）。
 * 渲染器真正就位后在 <html data-renderer> 上标出用的是哪个（webgpu / canvas2d），调试和测试看这个；
 * 毛玻璃开着时再标 <html data-glass>，卡片这些表面才改成半透明（home.css）。
 */
import type { Canvases, Renderer } from '../drawlist.js';
import { createClassicRenderer } from './classic.js';
import { createGpuRenderer, FX, FX_ALL } from './gpu/renderer.js';

function mark(kind: 'webgpu' | 'canvas2d', glass = false) {
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

export function pickRenderer(c: Canvases): Renderer {
  const q = new URLSearchParams(location.search);
  if (!q.has('gpu')) {
    mark('canvas2d');
    return createClassicRenderer(c);
  }
  let active: Renderer | null = null;
  let size: [number, number, number] = [0, 0, 1];
  const effects = parseEffects(q.get('fx'));
  createGpuRenderer(c, effects).then(
    (r) => {
      r.resize(...size);
      active = r;
      mark('webgpu', (effects & FX.glass) !== 0);
    },
    (err) => {
      console.error('[world] WebGPU 用不了，退回 Canvas 2D：', err);
      active = createClassicRenderer(c);
      active.resize(...size);
      mark('canvas2d');
    },
  );
  return {
    get depthOfField() {
      return active?.depthOfField ?? false;
    },
    resize(w, h, S) {
      size = [w, h, S];
      active?.resize(w, h, S);
    },
    draw(dl, dark, view) {
      active?.draw(dl, dark, view);
    },
  };
}
