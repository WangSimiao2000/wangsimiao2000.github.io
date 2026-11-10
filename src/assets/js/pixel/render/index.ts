/**
 * 选渲染器。迁移期间：网址带 ?gpu 时用 WebGPU，拿不到 WebGPU 或者没带参数就用 Canvas 2D。
 * WebGPU 初始化是异步的，这期间返回的渲染器什么都不画（世界照常跑，卡片照常显示）。
 * 渲染器真正就位后在 <html data-renderer> 上标出用的是哪个（webgpu / canvas2d），调试和测试看这个。
 */
import type { Canvases, Renderer } from '../drawlist.js';
import { createClassicRenderer } from './classic.js';
import { createGpuRenderer } from './gpu/renderer.js';

const mark = (kind: 'webgpu' | 'canvas2d') => (document.documentElement.dataset.renderer = kind);

export function pickRenderer(c: Canvases): Renderer {
  if (!new URLSearchParams(location.search).has('gpu')) {
    mark('canvas2d');
    return createClassicRenderer(c);
  }
  let active: Renderer | null = null;
  let size: [number, number] = [0, 0];
  createGpuRenderer(c).then(
    (r) => {
      r.resize(...size);
      active = r;
      mark('webgpu');
    },
    (err) => {
      console.error('[world] WebGPU 用不了，退回 Canvas 2D：', err);
      active = createClassicRenderer(c);
      active.resize(...size);
      mark('canvas2d');
    },
  );
  return {
    resize(w, h) {
      size = [w, h];
      active?.resize(w, h);
    },
    draw(dl, dark) {
      active?.draw(dl, dark);
    },
  };
}
