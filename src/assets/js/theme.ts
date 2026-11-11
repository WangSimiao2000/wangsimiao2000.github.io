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
 * 显示 h 点。像素世界按 data-hour 连续地过渡晨昏（pixel/sim/daytime.ts）；界面的深浅色只在晨昏正中间（6 点、18 点）切一次，
 * 那时世界已经暗了（亮了）一半，切换不突兀。切的时候用 View Transitions 整页交叉淡化
 * （颜色是一组 CSS 变量，渐变背景没法用 transition 过渡），拖动时间条时也一样
 */
function show(h: number) {
  d.dataset.hour = h.toFixed(3);
  // 拖动条自己拖出来的变化不往回写（手正按在上面，写回去会和指针抢）；「回到现在」、跟着时钟走时滑块跟着动
  if (range && !fromRange) range.value = String(h);
  if (out) out.value = label(h);
  const theme = themeOf(h);
  if (d.dataset.theme === theme) return;
  const set = () => {
    d.dataset.theme = theme;
  };
  if ('startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('theme-switching');
    document.startViewTransition(set).finished.finally(() => d.classList.remove('theme-switching'));
  } else set();
}

/*
 * 换时刻不是一下跳过去，而是平滑地挪过去：拖动条拖到哪、点「回到现在」，显示的时刻（日月、天色、读数）
 * 按临界阻尼的弹簧追过去——起步加速、快到时减速，中途目标又变了（还在拖）也接得上，速度不会突变。
 * 开了「减少动态效果」就直接跳过去。
 */
const SMOOTH = 0.25; // 追上目标大约要多久（秒）
let target = current();
let shown = target;
let speed = 0; // 时刻每秒变多少小时
let fromRange = false; // 这一段是不是拖动条拖出来的
let raf = 0;
let last = 0;

/** 临界阻尼弹簧走一步（Game Programming Gems 4 的 SmoothDamp），返回新位置，并更新速度 */
function step(dt: number) {
  const w = 2 / SMOOTH;
  const x = w * dt;
  const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const diff = shown - target;
  const temp = (speed + w * diff) * dt;
  speed = (speed - w * temp) * k;
  shown = target + (diff + temp) * k;
}

function tick(now: number) {
  // 弹簧这个解法步长多大都稳定；只防切回标签页时一步跨太久
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  step(dt);
  const done = Math.abs(shown - target) < 0.002 && Math.abs(speed) < 0.01;
  if (done) {
    shown = target;
    speed = 0;
  }
  show(shown);
  raf = done ? 0 : requestAnimationFrame(tick);
}

/** 目标时刻换成 h，显示的时刻平滑地追过去 */
function moveTo(h: number, byRange = false) {
  target = h;
  fromRange = byRange;
  if (now) now.hidden = urlHour === null && stored() === null;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown = target;
    speed = 0;
    show(shown);
    return;
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
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
  moveTo(h, true);
});
now?.addEventListener('click', () => {
  store(null);
  moveTo(clock());
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

show(shown);
if (now) now.hidden = urlHour === null && stored() === null;
// 跟着时钟走：没固定时刻的话每分钟更新一次
setInterval(() => {
  if (urlHour === null && stored() === null) moveTo(clock());
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
