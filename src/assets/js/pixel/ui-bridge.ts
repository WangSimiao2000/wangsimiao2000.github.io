/**
 * 页面 UI 和渲染器之间的桥：每帧量一次哪些元素要画毛玻璃（位置、圆角、不透明度），
 * 以及阅读时镜头对焦拉近到了哪一步。只读 DOM，不写。
 *
 * 毛玻璃画在世界画布上，所以坐标换算成世界画布的像素：画布有亚像素平移、阅读时会下沉（CSS transform），
 * 用它自己的 getBoundingClientRect 换算，这些变换就都算进去了。
 */
import type { GlassRect, View } from './drawlist.js';

/** 半透明的表面（见 home.css 里 data-renderer='webgpu' 那段）：卡片、阅读面板、快捷栏、顶栏按钮 */
const GLASS = '.stages .card, .secret-panel .card, .reader-card, .reader-side, .hotbar, .toplinks > a, .toplinks > .theme-btn';
const MAX = 16;
const FOCUS_TIME = 0.4; // 对焦拉近用多久（秒）

/** 元素实际的不透明度：自己和祖先的 opacity 连乘，任何一层不可见就是 0 */
function opacityOf(el: Element): number {
  let a = 1;
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    a *= parseFloat(cs.opacity);
    if (a <= 0.01) return 0;
  }
  return a;
}

export class UiBridge {
  private focus = 0;
  private readonly root = document.documentElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly sky: HTMLCanvasElement;

  /** canvas：世界画布，毛玻璃画在它上面；sky：天空画布（毛玻璃按它对齐天空） */
  constructor(canvas: HTMLCanvasElement, sky: HTMLCanvasElement) {
    this.canvas = canvas;
    this.sky = sky;
  }

  /** dt：距上一帧的秒数；reduced：减少动态效果时对焦直接到位 */
  view(dt: number, reduced: boolean): View {
    const target = this.root.classList.contains('reading') ? 1 : 0;
    const step = reduced ? 1 : dt / FOCUS_TIME;
    this.focus = target > this.focus ? Math.min(target, this.focus + step) : Math.max(target, this.focus - step);
    const cv = this.canvas.getBoundingClientRect();
    const glass: GlassRect[] = [];
    let sky: [number, number] = [0, 0];
    if (cv.width > 0 && cv.height > 0) {
      const kx = this.canvas.width / cv.width;
      const ky = this.canvas.height / cv.height;
      const sk = this.sky.getBoundingClientRect();
      sky = [(sk.left - cv.left) * kx, (sk.top - cv.top) * ky];
      for (const el of document.querySelectorAll(GLASS)) {
        if (glass.length >= MAX) break;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
        const alpha = opacityOf(el);
        if (alpha <= 0) continue;
        const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
        glass.push({ x: (r.left - cv.left) * kx, y: (r.top - cv.top) * ky, w: r.width * kx, h: r.height * ky, radius: radius * kx, alpha });
      }
    }
    // 对焦的缓动：开头和结尾都慢一点
    const f = this.focus;
    return { glass, focus: f * f * (3 - 2 * f), sky };
  }
}
