/**
 * 手机上看文章：正文往下读时顶栏收起，阅读面板顶到屏幕上沿，多出约 50px 给正文；往上滑、回到顶部、
 * 换页或关闭面板时顶栏回来。面板自己那条栏（返回、目录、关闭）一直在。电脑上不收起。
 */
const root = document.documentElement;
const reader = document.querySelector<HTMLElement>('[data-reader]');
const narrow = matchMedia('(max-width: 640px)');
const SHOW_NEAR_TOP = 40; // 离顶部这么近时总是显示
const THRESHOLD = 24; // 同一方向累计滚这么多才切换，手指抖一下不算
const SETTLE_MS = 320; // 切换后面板高度在变，这段时间里的滚动不算数（面板变高会把底部的 scrollTop 往回夹）

let last = 0;
let acc = 0;
let settleUntil = 0;

function set(hidden: boolean): void {
  if (hidden === root.classList.contains('bar-hidden')) return;
  root.classList.toggle('bar-hidden', hidden);
  settleUntil = performance.now() + SETTLE_MS;
  acc = 0;
}

function reset(): void {
  set(false);
  last = 0;
  acc = 0;
}

if (reader) {
  reader.addEventListener(
    'scroll',
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.matches('[data-reader-scroll]')) return;
      const y = el.scrollTop;
      const d = y - last;
      last = y;
      if (!narrow.matches || !root.classList.contains('reading')) return set(false);
      if (y < SHOW_NEAR_TOP) return set(false);
      if (performance.now() < settleUntil) return;
      acc = Math.sign(d) === Math.sign(acc) ? acc + d : d;
      if (acc > THRESHOLD) set(true);
      else if (acc < -THRESHOLD) set(false);
    },
    { capture: true, passive: true },
  );
  // 站内换页（正文整块换掉）、关闭阅读面板、转成宽屏：顶栏回来
  new MutationObserver(reset).observe(reader, { childList: true });
  new MutationObserver(() => {
    if (!root.classList.contains('reading')) reset();
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
  narrow.addEventListener('change', reset);
}
