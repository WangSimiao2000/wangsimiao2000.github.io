/**
 * 输入：滚轮 / 触控板、触屏划动、键盘、点击（含双击）。
 *
 * 手势判定是纯逻辑（WheelGesture、classifySwipe、TapTracker），可以脱离 DOM 单测；
 * bindInput 只负责把浏览器事件喂给它们，再回调 world.ts。
 */

/**
 * 滚轮 / 触控板：一次手势只翻一页。触控板松手后的惯性会持续发几十个递减的 wheel 事件，
 * 所以「手势」以事件停顿 220ms 为界，停顿前只在开头翻一次；惯性还没完又用力扫了一下
 * （力度明显回升）算新手势。
 */
export class WheelGesture {
  private acc = 0;
  private active = false;
  private lastMag = 0;
  private lastAt = -Infinity;
  private stepAt = 0;

  /** 喂一个 wheel 事件；返回 1 / -1 表示这次该翻一页，0 表示不翻 */
  feed(delta: number, mag: number, now: number): -1 | 0 | 1 {
    if (now - this.lastAt > 220) {
      this.active = false;
      this.acc = 0;
    }
    this.lastAt = now;
    if (this.active && now - this.stepAt > 450 && mag > 40 && mag > this.lastMag * 1.8) {
      this.active = false; // 惯性中途又扫了一下
      this.acc = 0;
    }
    this.lastMag = mag;
    if (this.active) return 0;
    this.acc += delta;
    if (Math.abs(this.acc) <= 30) return 0;
    const dir = this.acc > 0 ? 1 : -1;
    this.active = true;
    this.stepAt = now;
    this.acc = 0;
    return dir;
  }
}

/** 触屏划动：快（700ms 内）且明显（48px 以上）朝一个方向时才算 */
export function classifySwipe(dx: number, dy: number, ms: number): 'left' | 'right' | 'up' | 'down' | null {
  if (ms >= 700) return null;
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) return dx < 0 ? 'left' : 'right';
  if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.5) return dy < 0 ? 'up' : 'down';
  return null;
}

/** 双击判定：380ms 内、28px 内的第二下算双击（手机上也能用，不依赖 dblclick 事件） */
export class TapTracker {
  private last = { x: -99, y: -99, t: 0 };
  tap(x: number, y: number, now: number): boolean {
    const double = now - this.last.t < 380 && Math.hypot(x - this.last.x, y - this.last.y) < 28;
    this.last = double ? { x: -99, y: -99, t: 0 } : { x, y, t: now };
    return double;
  }
}

export interface InputHandlers {
  /** 翻到上一页 / 下一页。wheel=true 时不受 650ms 冷却限制（滚轮自己按手势去重） */
  step(dir: -1 | 1, wheel?: boolean): void;
  /** 直达第 i 个板块 */
  goTo(i: number): void;
  sections: number;
  /** 阅读面板开着：世界不响应输入 */
  reading(): boolean;
  inSecret(): boolean;
  /** 点击世界（CSS 像素坐标）；命中彩蛋返回 true */
  tap(x: number, y: number, double: boolean): boolean;
  /** 这个 CSS 坐标下有没有可点的东西（鼠标手形、挡住双击选字） */
  hoverable(x: number, y: number): boolean;
}

export function bindInput(h: InputHandlers) {
  const root = document.documentElement;

  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || h.reading()) return;
    const t = e.target as HTMLElement;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const n = Number(e.key);
    if (n >= 1 && n <= h.sections) {
      e.preventDefault();
      h.goTo(n - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      h.step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      h.step(-1);
    }
  });

  const wheel = new WheelGesture();
  window.addEventListener(
    'wheel',
    (e) => {
      if (h.reading() || root.classList.contains('searching') || e.ctrlKey) return; // ctrl+滚轮是缩放
      const t = e.target as Element | null;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (horizontal && t?.closest('pre, .table-wrap, .math-block')) return; // 能横向滚动的内容优先
      e.preventDefault(); // 页面自己不滚，也挡住浏览器的「横扫返回」
      const delta = horizontal ? e.deltaX : e.deltaY;
      const dir = wheel.feed(delta, Math.abs(delta) * (e.deltaMode === 1 ? 16 : 1), performance.now());
      if (dir) h.step(dir, true);
    },
    { passive: false },
  );

  let touch: { x: number; y: number; t: number } | null = null;
  window.addEventListener(
    'touchstart',
    (e) => {
      const t0 = e.touches[0];
      touch = !h.reading() && e.touches.length === 1 ? { x: t0.clientX, y: t0.clientY, t: performance.now() } : null;
    },
    { passive: true },
  );
  window.addEventListener(
    'touchend',
    (e) => {
      if (!touch || h.reading()) return;
      const t1 = e.changedTouches[0];
      const kind = classifySwipe(t1.clientX - touch.x, t1.clientY - touch.y, performance.now() - touch.t);
      touch = null;
      // 手指往左划 = 往前走；起点顶部往下拉 = 往回走（进隐藏页）；隐藏页里往上推 = 出来
      if (kind === 'left') h.step(1);
      else if (kind === 'right') h.step(-1);
      else if (kind === 'up' && h.inSecret()) h.step(1);
      else if (kind === 'down' && !h.inSecret() && window.scrollY <= 1) h.step(-1);
    },
    { passive: true },
  );

  // 点击世界里的彩蛋：卡片、按钮、链接上的点击不算
  const blocked = (t: EventTarget | null) =>
    h.reading() || !!(t as Element | null)?.closest?.('.card, .hotbar, .topbar, .reader, .search, a, button');
  const taps = new TapTracker();
  let down: { x: number; y: number } | null = null;
  window.addEventListener('pointerdown', (e) => {
    down = blocked(e.target) ? null : { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 10) return;
    const double = taps.tap(e.clientX, e.clientY, performance.now());
    if (h.tap(e.clientX, e.clientY, double)) e.preventDefault();
  });
  window.addEventListener('dblclick', (e) => {
    if (!blocked(e.target) && h.hoverable(e.clientX, e.clientY)) e.preventDefault(); // 别选中文字
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    root.classList.toggle('world-hover', !blocked(e.target) && h.hoverable(e.clientX, e.clientY));
  });
}
