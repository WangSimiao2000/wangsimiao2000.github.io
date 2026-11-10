/**
 * 全站共用：一天里的时刻，深浅色跟着它走（6 点到 18 点是白天、浅色，其余是夜里、深色）。
 *
 * 时刻默认跟着系统时钟，每分钟走一次。右上角的时间按钮点开是一根拖动条：拖到别的时刻就记在 localStorage 的 tod 里
 * （下次打开还是这个时刻），点「回到现在」清掉、重新跟着时钟。网址带 ?tod=小时 时固定在那个时刻（截图、预览用）。
 * 结果写在 <html data-hour>（像素世界按它摆日月、调天色，见 pixel/sim/daytime.ts）和 <html data-theme> 上。
 * 首帧的值由 <head> 里的内联脚本按同样的规则先算好（templates/layout.mjs 的 THEME_INIT），不会闪。
 */
const d = document.documentElement;
const KEY = 'tod';

const parse = (v: string | null) => {
  const h = v === null ? NaN : parseFloat(v);
  return h >= 0 && h <= 24 ? h : null;
};
const urlHour = parse(new URLSearchParams(location.search).get('tod'));
function stored(): number | null {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return null; // 隐私模式下不可读写，就跟着时钟
  }
}
function store(h: number | null) {
  try {
    if (h === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(h));
  } catch {
    /* 隐私模式下不可写，忽略 */
  }
}
const clock = () => {
  const n = new Date();
  return n.getHours() + n.getMinutes() / 60;
};
const current = () => urlHour ?? stored() ?? clock();
const themeOf = (h: number) => (h >= 6 && h < 18 ? 'light' : 'dark');
const label = (h: number) => {
  const m = Math.round(h * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const toggle = document.querySelector<HTMLButtonElement>('[data-time-toggle]');
const pop = document.getElementById('time-pop');
const range = document.querySelector<HTMLInputElement>('[data-time-range]');
const out = document.querySelector<HTMLOutputElement>('[data-time-out]');
const now = document.querySelector<HTMLButtonElement>('[data-time-now]');

/**
 * 换到 h 点。fade：深浅色变了时用 View Transitions 整页交叉淡化（颜色是一组 CSS 变量，渐变背景没法用 transition 过渡）；
 * 拖动时不淡化，跟手
 */
function apply(h: number, fade: boolean) {
  d.dataset.hour = h.toFixed(2);
  if (range && document.activeElement !== range) range.value = String(h);
  if (out) out.value = label(h);
  if (now) now.hidden = urlHour === null && stored() === null;
  const theme = themeOf(h);
  if (d.dataset.theme === theme) return;
  const set = () => {
    d.dataset.theme = theme;
  };
  if (fade && 'startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('theme-switching');
    document.startViewTransition(set).finished.finally(() => d.classList.remove('theme-switching'));
  } else set();
}

function open(on: boolean) {
  if (!toggle || !pop) return;
  pop.hidden = !on;
  toggle.setAttribute('aria-expanded', String(on));
  if (on) range?.focus();
}

toggle?.addEventListener('click', () => open(pop?.hidden ?? false));
range?.addEventListener('input', () => {
  const h = parseFloat(range.value);
  store(h);
  apply(h, false);
});
now?.addEventListener('click', () => {
  store(null);
  apply(clock(), true);
});
// 点到别处或按 Esc 收起
document.addEventListener('pointerdown', (e) => {
  if (pop && !pop.hidden && !(e.target as Element).closest('.time-wrap')) open(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pop && !pop.hidden) {
    open(false);
    toggle?.focus();
  }
});

apply(current(), false);
// 跟着时钟走：没固定时刻的话每分钟更新一次
setInterval(() => {
  if (urlHour === null && stored() === null) apply(clock(), true);
}, 60_000);
// 旧版本记过的深浅色偏好（现在由时刻决定），清掉
try {
  localStorage.removeItem('theme');
} catch {
  /* 忽略 */
}

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
