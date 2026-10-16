/** 全站共用：深色模式切换。初始主题由 <head> 里的内联脚本在首帧前设置，避免闪烁 */
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const d = document.documentElement;
  const next = d.dataset.theme === 'dark' ? 'light' : 'dark';
  const apply = () => {
    d.dataset.theme = next;
  };
  // 颜色是一组 CSS 变量，渐变背景没法用 transition 过渡：交给 View Transitions 整页交叉淡化
  if ('startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('theme-switching');
    document.startViewTransition(apply).finished.finally(() => d.classList.remove('theme-switching'));
  } else apply();
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* 隐私模式下不可写，忽略 */
  }
});

/* 滚动条默认隐藏：哪个容器在滚，就给它加 .is-scrolling，停下 900ms 后去掉（样式见 base.css） */
const scrollTimers = new WeakMap<Element, number>();
document.addEventListener(
  'scroll',
  (e) => {
    const el = e.target === document ? document.documentElement : (e.target as Element);
    if (!(el instanceof Element)) return;
    el.classList.add('is-scrolling');
    clearTimeout(scrollTimers.get(el));
    scrollTimers.set(el, window.setTimeout(() => el.classList.remove('is-scrolling'), 900));
  },
  { capture: true, passive: true },
);
