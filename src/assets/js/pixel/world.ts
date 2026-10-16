/**
 * 像素世界：页面纵向滚动 -> 世界横向前进。
 *
 * - 每个 <section> 占一屏并带 scroll-snap，滚动进度 p（0..N-1）映射到相机世界坐标 p*SECTION。
 * - 地形是逐像素的连续高度场（不是方块），群系之间在很宽的一段里连续插值：
 *   起伏、地表配色、植被密度和种类都是渐变的，森林会一点点稀疏成沙丘。
 * - 景深：远山、中景丘陵、近景树线三层视差，越远越向「雾色」（页面底色 + 群系色调）靠拢。
 * - 深色模式不靠 CSS 滤镜压暗，而是给前景盖一层夜色，灯、窗、篝火的光单独画在夜色之上。
 * - 小人在相机移动时播放跑步帧（按移动距离推进），停下后待机、眨眼。
 * - 内容面板固定在上方，随世界同速横移并淡入淡出；非当前面板设为 inert。
 */
import { buildCharacter, hash, type CharacterFrames, type Sprite } from './sprites.js';
import { buildScenery, COTTAGE, type Scenery } from './scenery.js';
import { buildCat, buildGirl } from './npcs.js';

type RGB = [number, number, number];

interface Biome {
  name: 'autumn' | 'plains' | 'forest' | 'desert' | 'village' | 'cherry' | 'snow';
  tint: string; // 地平线晕染（交给 CSS）
  far: string; // 远山
  mid: string; // 中景丘陵
  near: string; // 近景树线
  treeline: number; // 中/近景轮廓上的树冠起伏，0 = 光秃
  spiky: boolean; // 树线是尖的（针叶林）
  rim: string; // 地表最上沿的受光线
  top: string; // 表层（草 / 沙 / 雪）
  shade: string; // 表层底部
  soil: [string, string, string]; // 由浅到深的土层
  amp: number; // 地形起伏（逻辑像素）
  blades: boolean; // 地表冒出草尖
}

/**
 * 群系按世界里的板块顺序排列。第 0 个是起点左边藏着的「秋林」：双击起点的路牌把它翻过来，
 * 才能往回走进去（世界坐标为负）。OFF 是起点在数组里的下标。
 */
const BIOMES: Biome[] = [
  { name: 'autumn', tint: '#ffe0bf', far: '#d9c3b4', mid: '#d9a77a', near: '#c98a5a', treeline: 0.9, spiky: false, rim: '#f3dc8e', top: '#d6b45c', shade: '#b48d43', soil: ['#a8805b', '#8a6548', '#6c4f3c'], amp: 9, blades: true },
  { name: 'plains', tint: '#cdebff', far: '#a9c3da', mid: '#a3c99a', near: '#82b76e', treeline: 0.35, spiky: false, rim: '#d2ee95', top: '#8cc762', shade: '#68a44d', soil: ['#a8805b', '#8a6548', '#6c4f3c'], amp: 9, blades: true },
  { name: 'forest', tint: '#bfe4ff', far: '#93b1c9', mid: '#76a57b', near: '#548a5c', treeline: 1, spiky: false, rim: '#b4de80', top: '#64a854', shade: '#468345', soil: ['#8e6c4e', '#6f533f', '#534034'], amp: 13, blades: true },
  { name: 'desert', tint: '#ffe6b8', far: '#e9d2b3', mid: '#e6c595', near: '#dcb07d', treeline: 0, spiky: false, rim: '#fdebc6', top: '#f2d6a3', shade: '#e2bb86', soil: ['#d7ad78', '#c39667', '#a97e58'], amp: 15, blades: false },
  { name: 'village', tint: '#ffd9ae', far: '#bcbad6', mid: '#a7c792', near: '#87b56c', treeline: 0.45, spiky: false, rim: '#d6ec94', top: '#90c664', shade: '#6aa24e', soil: ['#a8805b', '#8a6548', '#6c4f3c'], amp: 7, blades: true },
  { name: 'cherry', tint: '#ffd0d6', far: '#d8bdd3', mid: '#dcadc6', near: '#c08cab', treeline: 0.9, spiky: false, rim: '#dcf0a2', top: '#9bcd6c', shade: '#73aa57', soil: ['#a07b63', '#816150', '#644c42'], amp: 11, blades: true },
  { name: 'snow', tint: '#bccbea', far: '#b6c3dc', mid: '#9fafcd', near: '#8396bb', treeline: 0.85, spiky: true, rim: '#ffffff', top: '#eef3fb', shade: '#cfd9ea', soil: ['#908c9c', '#716d80', '#565368'], amp: 15, blades: false },
];

const OFF = 1; // 起点（板块 0）在 BIOMES 里的下标
const SECTION = 320; // 相邻板块间的世界距离（逻辑像素）
const GROUND = 32; // 板块中心处地面高度
const CHAR_W = 14;
const CHAR_H = 20;
const STRIP_GROUND = 10; // 阅读时世界下沉，只露出这么高的地面
const NIGHT = 'rgba(14, 20, 38, 0.46)';

/* ---------- 小工具 ---------- */

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function parseColor(s: string): RGB {
  s = s.trim();
  if (s.startsWith('#')) {
    const hex = s.length === 4 ? s.slice(1).replace(/./g, (c) => c + c) : s.slice(1);
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/\d+(\.\d+)?/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [238, 241, 245];
}
const rgbCache = new Map<string, RGB>();
function rgb(c: string): RGB {
  let v = rgbCache.get(c);
  if (!v) rgbCache.set(c, (v = parseColor(c)));
  return v;
}
function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
function mix(a: string, b: string, t: number): string {
  return css(mixRGB(rgb(a), rgb(b), t));
}

/** 1D value noise，范围 [-1,1] */
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}

/* ---------- 群系插值 ---------- */

/** 世界坐标处的两个相邻群系及混合系数：交界在两板块正中，过渡带占整段的 40% */
function weights(wx: number): [number, number, number] {
  const f = wx / SECTION + OFF;
  const i = clamp(Math.floor(f), 0, BIOMES.length - 1);
  const j = Math.min(i + 1, BIOMES.length - 1);
  const t = i === j || f < 0 ? 0 : smooth(0.3, 0.7, f - i);
  return [i, j, t];
}

const STEPS = 24; // 颜色插值量化，便于缓存
interface Palette {
  rim: string;
  top: string;
  shade: string;
  soil: [string, string, string];
  path: string[]; // 村庄小路
}
const paletteCache = new Map<number, Palette>();
function paletteAt(wx: number): Palette {
  const [i, j, t] = weights(wx);
  const q = Math.round(t * STEPS);
  const key = i * 100 + q;
  let pal = paletteCache.get(key);
  if (!pal) {
    const a = BIOMES[i];
    const b = BIOMES[j];
    const k = q / STEPS;
    pal = {
      rim: mix(a.rim, b.rim, k),
      top: mix(a.top, b.top, k),
      shade: mix(a.shade, b.shade, k),
      soil: [mix(a.soil[0], b.soil[0], k), mix(a.soil[1], b.soil[1], k), mix(a.soil[2], b.soil[2], k)],
      path: ['#d8bb8c', '#c4a274', '#a9875d'],
    };
    paletteCache.set(key, pal);
  }
  return pal;
}

function biomeNum(wx: number, pick: (b: Biome) => number): number {
  const [i, j, t] = weights(wx);
  return pick(BIOMES[i]) * (1 - t) + pick(BIOMES[j]) * t;
}

/** 地面高度（逻辑像素，从屏幕底边数），板块中心附近压平 */
function heightAt(wx: number): number {
  const nearest = Math.round(wx / SECTION);
  const dist = Math.abs(wx - nearest * SECTION);
  const flat = smooth(16, 96, dist);
  const n = noise1(wx * 0.011) * 0.66 + noise1(wx * 0.027 + 40) * 0.27 + noise1(wx * 0.085 + 7) * 0.07;
  return GROUND + n * biomeNum(wx, (b) => b.amp) * flat;
}

/* ---------- 粒子 ---------- */

interface Particle {
  x: number; // 世界坐标
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'dust' | 'snow' | 'petal' | 'firefly' | 'spark' | 'smoke' | 'leaf';
}

/* ---------- 布景 ---------- */

interface Item {
  sprite: Sprite;
  wx: number; // 精灵底边中心的世界坐标
  z: number; // 绘制顺序：小的在前
  glow?: 'lamp' | 'window' | 'fire';
}

const SLOT = 9;

function slotItem(s: number, sc: Scenery): Item | null {
  const wx = s * SLOT + Math.floor(hash(s * 0.91 + 0.3) * 6);
  const center = Math.round(wx / SECTION) * SECTION;
  const rel = wx - center;
  if (Math.abs(rel) < 24) return null; // 小人脚下与路牌留空
  const [i, j, t] = weights(wx);
  const bi = hash(s * 1.73 + 3.1) < t ? j : i;
  const b = BIOMES[bi];
  if (b.name === 'village' && rel > 14 && rel < 124) return null;
  if (b.name === 'snow' && rel > 10 && rel < 40) return null;
  if (b.name === 'forest' && rel > 30 && rel < 64) return null; // 草堆周围留空
  const r = hash(s * 7.31 + bi * 13.7);
  const v = hash(s * 3.37 + 1.9);
  const pick = (arr: Sprite[]) => arr[Math.floor(v * arr.length)];
  const tree = (arr: Sprite[]): Item => ({ sprite: pick(arr), wx, z: 0 });
  const small = (arr: Sprite[], z = 3): Item => ({ sprite: pick(arr), wx, z });
  switch (b.name) {
    case 'autumn':
      if (r < 0.34) return tree(sc.autumn);
      if (r < 0.46) return small(sc.autumnBush, 2);
      if (r < 0.62) return small(sc.dryTuft);
      return null;
    case 'plains':
      if (r < 0.1) return tree(sc.oak);
      if (r < 0.2) return small(sc.bush, 2);
      if (r < 0.26) return small(sc.rock, 2);
      if (r < 0.55) return small(sc.tuft);
      if (r < 0.75) return small(sc.flowers);
      return null;
    case 'forest':
      if (r < 0.48) return tree(r < 0.3 ? sc.forest : sc.oak);
      if (r < 0.62) return small(sc.bush, 2);
      if (r < 0.85) return small(sc.tuft);
      return null;
    case 'desert':
      if (r < 0.1) return { sprite: pick(sc.cactus), wx, z: 1 };
      if (r < 0.2) return small(sc.sandRock, 2);
      if (r < 0.36) return small(sc.dryTuft);
      return null;
    case 'village':
      if (r < 0.08) return tree(sc.oak);
      if (r < 0.2) return small(sc.bush, 2);
      if (r < 0.48) return small(sc.tuft);
      if (r < 0.68) return small(sc.flowers);
      return null;
    case 'cherry':
      if (r < 0.32) return tree(sc.blossom);
      if (r < 0.44) return small(sc.blossomBush, 2);
      if (r < 0.66) return small(sc.tuft);
      if (r < 0.78) return small(sc.flowers);
      return null;
    case 'snow':
      if (r < 0.38) return tree(sc.pine);
      if (r < 0.5) return small(sc.snowRock, 2);
      return null;
  }
}

/** 每个板块的固定布景 */
function setPieces(sec: number, sc: Scenery): Item[] {
  const c = sec * SECTION;
  const items: Item[] = [{ sprite: sc.sign, wx: c - 32, z: 1 }];
  const name = BIOMES[sec + OFF]?.name;
  if (name === 'forest') items.push({ sprite: sc.hay, wx: c + 46, z: 2 }); // 草堆（彩蛋）
  if (name === 'village') {
    items.push(
      { sprite: sc.cottage, wx: c + 52, z: 1, glow: 'window' },
      { sprite: sc.fence, wx: c + 98, z: 2 },
      { sprite: sc.lamp, wx: c - 62, z: 1, glow: 'lamp' },
      { sprite: sc.lamp, wx: c + 120, z: 1, glow: 'lamp' },
    );
  }
  if (name === 'snow') items.push({ sprite: sc.campfire, wx: c + 24, z: 2, glow: 'fire' });
  return items;
}

/* ---------- 主体 ---------- */

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  sections: HTMLElement[];
  panels: HTMLElement[];
  slots: HTMLElement[];
  /** 起点左边藏着的一页（双击路牌翻过来才能进） */
  secretPanel?: HTMLElement | null;
}

export function startWorld({ canvas, sections, panels, slots, secretPanel }: WorldOptions) {
  const g = canvas.getContext('2d')!;
  // 前景（地面、植被）先画到离屏画布，深色模式在它上面盖夜色，不影响远景
  const fgCanvas = document.createElement('canvas');
  const f = fgCanvas.getContext('2d')!;
  const sc = buildScenery();
  const charR: CharacterFrames = buildCharacter(false);
  const charL: CharacterFrames = buildCharacter(true);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const N = sections.length;
  const root = document.documentElement;

  let S = 4; // 每个逻辑像素对应的 CSS 像素
  let W = 0;
  let H = 0;
  let heights = new Float32Array(0);

  function resize() {
    const vw = root.clientWidth;
    const vh = window.innerHeight;
    S = Math.max(2, Math.round(vh / 190));
    if (vw / S < 96) S = Math.max(2, Math.floor(vw / 96));
    W = Math.ceil(vw / S);
    H = Math.ceil(vh / S);
    canvas.width = fgCanvas.width = W;
    canvas.height = fgCanvas.height = H;
    canvas.style.width = `${W * S}px`;
    canvas.style.height = `${H * S}px`;
    g.imageSmoothingEnabled = false;
    heights = new Float32Array(W + 2);
    root.style.setProperty('--px', `${S}px`);
    // 面板底边留出：地面 + 小人 + 一点余量
    root.style.setProperty('--stage', `${(GROUND + CHAR_H + 14) * S}px`);
    root.style.setProperty('--ground', `${GROUND * S}px`);
    root.style.setProperty('--strip', `${(STRIP_GROUND + CHAR_H + 8) * S}px`);
    root.style.setProperty('--sink', `${(GROUND - STRIP_GROUND) * S}px`);
  }
  resize();
  window.addEventListener('resize', resize);

  /* 主题：雾色 = 页面底色 + 一点群系色调 */
  let dark = false;
  let bg = '#eef1f5';
  function readTheme() {
    dark = root.dataset.theme === 'dark';
    bg = getComputedStyle(root).getPropertyValue('--bg').trim() || (dark ? '#15181d' : '#eef1f5');
  }
  readTheme();
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* 滚动进度 */
  /**
   * 按各板块的实际位置算进度，而不是 scrollY / 一屏高度：手机地址栏收起展开时 100dvh 会变，
   * 用固定除数会让停稳的板块算成 2.03 之类，卡片就偏到一边。离整数很近时直接取整。
   */
  function progress(): number {
    const y = window.scrollY;
    let i = 0;
    while (i < N - 1 && sections[i + 1].offsetTop <= y) i++;
    const top = sections[i].offsetTop;
    const next = i < N - 1 ? sections[i + 1].offsetTop : top + (sections[i].offsetHeight || window.innerHeight);
    const v = clamp(i + (y - top) / Math.max(1, next - top), 0, N - 1);
    return Math.abs(v - Math.round(v)) < 0.015 ? Math.round(v) : v;
  }

  let p = progress();
  let camX = p * SECTION;
  let lastCam = camX;
  let charY = H - Math.round(heightAt(camX));
  let facing = 1;
  let runTimer = 0;
  let stride = 0;
  let time = 0;
  let nextBlink = 2.5;
  let activeIdx = -1;
  let lastTint = '';
  let reading = root.classList.contains('reading');
  let secret = false; // 正在隐藏页里
  let signFlip = 0; // 路牌翻转动画 0..1
  let signTarget = 0; // 1 = 已翻过来，可以往回走进隐藏页
  let runningNow = false;
  let nextTurn = 6;
  let lastDraw = 0;
  const particles: Particle[] = [];

  function spawn(pt: Particle) {
    if (particles.length < 420) particles.push(pt);
  }

  /* ---------- 面板与快捷栏 ---------- */

  function updatePanels() {
    const shift = SECTION * S;
    const pc = camX / SECTION; // 跟着相机走，进出隐藏页也是平滑的
    const place = (panel: HTMLElement, i: number) => {
      const d = i - pc;
      const a = clamp(1 - Math.abs(d) * 1.6);
      panel.style.transform = `translate3d(${(d * shift).toFixed(1)}px,0,0)`;
      panel.style.opacity = a.toFixed(3);
      panel.style.visibility = a <= 0.001 ? 'hidden' : 'visible';
    };
    if (secretPanel) {
      place(secretPanel, -1);
      secretPanel.toggleAttribute('inert', !secret);
    }
    panels.forEach((panel, i) => {
      const d = i - pc;
      const a = clamp(1 - Math.abs(d) * 1.6);
      panel.style.transform = `translate3d(${(d * shift).toFixed(1)}px,0,0)`;
      panel.style.opacity = a.toFixed(3);
      panel.style.visibility = a <= 0.001 ? 'hidden' : 'visible';
    });
    const idx = secret ? -1 : Math.round(p);
    if (idx !== activeIdx) {
      activeIdx = idx;
      panels.forEach((panel, i) => {
        const on = i === idx;
        panel.toggleAttribute('inert', !on);
        panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      slots.forEach((s, i) => {
        s.classList.toggle('is-active', i === idx);
        if (i === idx) s.setAttribute('aria-current', 'true');
        else s.removeAttribute('aria-current');
      });
    }
  }

  function goTo(i: number) {
    if (secret) exitSecret();
    const target = sections[clamp(i, 0, N - 1)];
    target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', `#${target.id}`);
  }

  slots.forEach((s, i) =>
    s.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(i);
    }),
  );

  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || reading) return;
    const t = e.target as HTMLElement;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const n = Number(e.key);
    if (n >= 1 && n <= N) {
      e.preventDefault();
      goTo(n - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
  });

  /* ---------- 左右滑动：触控板横扫、触屏左右划，都切到上一个 / 下一个板块 ---------- */

  let swipeAcc = 0;
  let swipeIdle = 0;
  let swipeLock = 0;
  const step = (dir: number) => {
    const now = performance.now();
    if (now < swipeLock) return;
    swipeLock = now + 650; // 一次横扫只走一格，惯性滚动不会连跳
    // 隐藏页：路牌翻过来以后，在起点往回走一步就进去；从里面往前走就出来
    if (secret) {
      if (dir > 0) exitSecret();
      return;
    }
    if (dir < 0 && Math.round(p) === 0 && signTarget === 1) {
      enterSecret();
      return;
    }
    goTo(Math.round(p) + dir);
  };
  /*
   * 手机上惯性滚动偶尔停在两屏之间（scroll-snap 没吸附到位），卡片就偏到一边、露不全。
   * 滚动停下 160ms 后如果还不在整屏上，就自己吸到最近的一屏。
   */
  let settleTimer = 0;
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (reading) return;
        const v = progress();
        const k = Math.round(v);
        if (v !== k) sections[k].scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
      }, 160);
    },
    { passive: true },
  );

  /*
   * 滚轮 / 触控板：一次手势只翻一页。触控板松手后的惯性会持续发几十个递减的 wheel 事件，
   * 所以「手势」以事件停顿 220ms 为界，停顿前只在开头翻一次；惯性还没完又用力扫了一下
   * （力度明显回升）算新手势。竖向和横向都这样处理。
   */
  let gesture = false;
  let lastMag = 0;
  let stepAt = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (reading || root.classList.contains('searching') || e.ctrlKey) return; // ctrl+滚轮是缩放
      const t = e.target as Element | null;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (horizontal && t?.closest('pre, .table-wrap, .math-block')) return; // 能横向滚动的内容优先
      e.preventDefault(); // 页面自己不滚，也挡住浏览器的「横扫返回」
      const delta = horizontal ? e.deltaX : e.deltaY;
      const mag = Math.abs(delta) * (e.deltaMode === 1 ? 16 : 1);
      clearTimeout(swipeIdle);
      swipeIdle = window.setTimeout(() => {
        gesture = false;
        swipeAcc = 0;
      }, 220);
      const now = performance.now();
      if (gesture && now - stepAt > 450 && mag > 40 && mag > lastMag * 1.8) {
        gesture = false; // 惯性中途又扫了一下
        swipeAcc = 0;
      }
      lastMag = mag;
      if (gesture) return;
      swipeAcc += delta;
      if (Math.abs(swipeAcc) > 30) {
        gesture = true;
        stepAt = now;
        swipeLock = 0;
        step(swipeAcc > 0 ? 1 : -1);
        swipeAcc = 0;
      }
    },
    { passive: false },
  );
  let touch: { x: number; y: number; t: number } | null = null;
  window.addEventListener(
    'touchstart',
    (e) => {
      const t0 = e.touches[0];
      touch = !reading && e.touches.length === 1 ? { x: t0.clientX, y: t0.clientY, t: performance.now() } : null;
    },
    { passive: true },
  );
  window.addEventListener(
    'touchend',
    (e) => {
      if (!touch || reading) return;
      const t1 = e.changedTouches[0];
      const dx = t1.clientX - touch.x;
      const dy = t1.clientY - touch.y;
      const fast = performance.now() - touch.t < 700;
      touch = null;
      // 明显的横向划动：手指往左划 = 往前走
      if (fast && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      // 竖向：起点顶部往下拉 = 往回走（进隐藏页）；隐藏页里往上推 = 出来
      else if (fast && Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        if (secret && dy < 0) step(1);
        else if (!secret && dy > 0 && window.scrollY <= 1) step(-1);
      }
    },
    { passive: true },
  );

  /* ---------- 远景三层 ---------- */

  const layerColorCache = new Map<string, [string, string]>();
  /** 某层在某处的颜色：先（深色模式下）入夜，再向雾色靠拢；第二个是轮廓上沿的受光线 */
  function layerColor(wx: number, which: 'far' | 'mid' | 'near', haze: number): [string, string] {
    const [i, j, t] = weights(wx);
    const q = Math.round(t * STEPS);
    const key = `${which}${i}${q}${dark ? 1 : 0}${bg}`;
    let c = layerColorCache.get(key);
    if (!c) {
      let base = mixRGB(rgb(BIOMES[i][which]), rgb(BIOMES[j][which]), q / STEPS);
      if (dark) base = mixRGB(base, rgb('#1d2639'), 0.62);
      const tintRGB = mixRGB(rgb(BIOMES[i].tint), rgb(BIOMES[j].tint), q / STEPS);
      const fog = mixRGB(rgb(bg), tintRGB, dark ? 0.08 : 0.25);
      const body = mixRGB(base, fog, haze);
      const lit = mixRGB(body, dark ? rgb('#8796b8') : [255, 255, 255], dark ? 0.12 : 0.28);
      c = [css(body), css(lit)];
      layerColorCache.set(key, c);
    }
    return c;
  }

  function treelineAt(lx: number, wx: number, freq: number, size: number): number {
    const amt = biomeNum(wx, (b) => b.treeline);
    if (amt < 0.02) return 0;
    const spiky = biomeNum(wx, (b) => (b.spiky ? 1 : 0));
    // 圆冠：一串高低错落的半圆；尖冠：锯齿
    const u = lx * freq;
    const cell = Math.floor(u);
    const fr = u - cell;
    const hgt = 0.55 + hash(cell * 1.9 + size) * 0.45;
    const round = Math.sqrt(Math.max(0, 1 - (fr * 2 - 1) ** 2)) * hgt;
    const tri = (1 - Math.abs(fr * 2 - 1)) * hgt * 1.4;
    const present = hash(cell * 4.3 + size) < amt ? 1 : 0.15;
    return (round * (1 - spiky) + tri * spiky) * size * present * Math.min(1, amt * 1.6);
  }

  function drawLayer(which: 'far' | 'mid' | 'near', factor: number, haze: number, camLeft: number) {
    const base = H - GROUND;
    const off = Math.round(camX * factor) - Math.floor(W / 2);
    for (let x = 0; x < W; x++) {
      const lx = off + x;
      const wx = camLeft + x;
      let h: number;
      if (which === 'far') {
        const ridge = 1 - Math.abs(noise1(lx * 0.0075 + 3));
        h = 26 + ridge * ridge * 46 + noise1(lx * 0.033) * 5;
      } else if (which === 'mid') {
        h = 14 + (noise1(lx * 0.013 + 20) * 0.5 + 0.5) * 18 + treelineAt(lx, wx, 0.11, 6);
      } else {
        h = 4 + (noise1(lx * 0.021 + 60) * 0.5 + 0.5) * 12 + treelineAt(lx, wx, 0.075, 10);
      }
      const y = Math.round(base - h);
      const [body, lit] = layerColor(wx, which, haze);
      g.fillStyle = body;
      g.fillRect(x, y, 1, H - y);
      g.fillStyle = lit;
      g.fillRect(x, y, 1, 1);
    }
  }

  /* ---------- 前景：地面 ---------- */

  function drawGround(camLeft: number) {
    for (let x = -1; x <= W; x++) heights[x + 1] = Math.round(heightAt(camLeft + x));
    for (let x = 0; x < W; x++) {
      const wx = camLeft + x;
      const pal = paletteAt(wx);
      const hgt = heights[x + 1];
      const sy = H - hgt;
      const center = Math.round(wx / SECTION) * SECTION;
      const sec = Math.round(wx / SECTION);
      const onPath = BIOMES[sec + OFF]?.name === 'village' && Math.abs(wx - center) < 70 - hash(wx * 0.37) * 6;
      const name = BIOMES[weights(wx)[0]].name;
      // 坡面：左高右低的一侧更亮（光从左上来）
      const slope = heights[x] - heights[x + 2];
      const rim = onPath ? pal.path[0] : slope < 0 ? pal.rim : slope > 0 ? pal.top : pal.rim;
      const top = onPath ? pal.path[1] : pal.top;
      const shade = onPath ? pal.path[2] : pal.shade;

      // 表层厚度起伏，底部一行抖动过渡到土层
      const band = 4 + Math.round((noise1(wx * 0.07) * 0.5 + 0.5) * 2);
      f.fillStyle = top;
      f.fillRect(x, sy, 1, band);
      f.fillStyle = shade;
      f.fillRect(x, sy + band - 1, 1, 1);
      if (hash(wx * 0.53 + 1) < 0.3) f.fillRect(x, sy + band, 1, 1);
      f.fillStyle = rim;
      f.fillRect(x, sy, 1, 1);

      // 土层：三道地层，交界随噪声起伏，边上零星散几个像素
      const d1 = sy + band + 1;
      const s1 = Math.round(sy + 11 + noise1(wx * 0.05 + 11) * 2);
      const s2 = Math.round(sy + 21 + noise1(wx * 0.04 + 77) * 3);
      f.fillStyle = pal.soil[0];
      f.fillRect(x, d1, 1, Math.max(0, s1 - d1));
      f.fillStyle = pal.soil[1];
      f.fillRect(x, s1, 1, Math.max(0, s2 - s1));
      if (hash(wx * 0.61 + 2) < 0.22) f.fillRect(x, s1 - 1, 1, 1);
      f.fillStyle = pal.soil[2];
      f.fillRect(x, s2, 1, H - s2);
      if (hash(wx * 0.67 + 3) < 0.22) f.fillRect(x, s2 - 1, 1, 1);

      // 嵌在土里的小石子
      const pr = hash(wx * 0.731 + 5);
      if (pr < 0.05) {
        const py = sy + 9 + Math.floor(hash(wx * 1.9) * 24);
        if (py < H - 1) {
          f.fillStyle = pal.soil[0];
          f.fillRect(x, py, 2, 1);
          f.fillStyle = pal.soil[2];
          f.fillRect(x, py + 1, 2, 1);
        }
      }
      // 草尖：地表冒出的零星像素，轮廓不再是一条硬线
      if (!onPath) {
        const br = hash(wx * 1.31 + 2);
        const bladeOK = biomeNum(wx, (b) => (b.blades ? 1 : 0));
        if (br < 0.42 * bladeOK) {
          f.fillStyle = br < 0.14 ? pal.rim : pal.top;
          f.fillRect(x, sy - 1, 1, 1);
          if (br < 0.06) f.fillRect(x, sy - 2, 1, 1);
        } else if (name === 'snow' && br < 0.12) {
          f.fillStyle = pal.rim;
          f.fillRect(x, sy - 1, 1, 1);
        }
      }
    }
  }

  /* ---------- 前景：植被与布景 ---------- */

  const glows: { x: number; y: number; kind: 'lamp' | 'window' | 'fire'; wx: number }[] = [];

  /* ---------- 彩蛋：路牌、小屋里的女孩、草堆里的三花猫 ---------- */

  interface Spot {
    kind: 'sign' | 'hay' | 'door' | 'cat';
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }
  let spots: Spot[] = [];
  const girlR = buildGirl(false);
  const girlL = buildGirl(true);
  const catR = buildCat(false);
  const catL = buildCat(true);
  let cottageX = 0;
  let cottageY = 0;
  let cottageWx = 0;
  const girl = { state: 'none' as 'none' | 'out' | 'wave' | 'in', t: 0, off: 0 };
  let hayShake = 0;
  let hayClicks = 0;
  let hayX = 0;
  let hayBase = 0;
  const cat = { state: 'hidden' as 'hidden' | 'jump' | 'sit', t: 0, x: 0, y: 0, meow: 0 };

  function enterSecret() {
    secret = true;
    root.classList.add('secret-open');
  }
  function exitSecret() {
    secret = false;
    signTarget = 0; // 走出来就翻回去，想再进得重新双击
    root.classList.remove('secret-open');
  }

  function onTap(lx: number, ly: number, double: boolean) {
    const hit = spots.find((sp) => lx >= sp.x0 && lx <= sp.x1 && ly >= sp.y0 && ly <= sp.y1);
    if (!hit) return false;
    if (hit.kind === 'sign' && double && Math.round(p) === 0 && !secret) signTarget = signTarget ? 0 : 1;
    if (hit.kind === 'door' && double && girl.state === 'none') Object.assign(girl, { state: 'out', t: 0, off: 0 });
    if (hit.kind === 'hay' && cat.state === 'hidden') {
      hayShake = 0.35;
      if (++hayClicks >= 4) {
        hayClicks = 0;
        Object.assign(cat, { state: 'jump', t: 0, x: hayX, y: 0 });
      }
    }
    if (hit.kind === 'cat') cat.meow = 1.4;
    return true;
  }

  let down: { x: number; y: number; t: number } | null = null;
  let lastTap = { x: -99, y: -99, t: 0 };
  const blocked = (t: EventTarget | null) =>
    reading || !!(t as Element | null)?.closest?.('.card, .hotbar, .topbar, .reader, .search, a, button');
  window.addEventListener('pointerdown', (e) => {
    down = blocked(e.target) ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  window.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const now = performance.now();
    down = null;
    if (moved > 10) return;
    const double = now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28;
    lastTap = double ? { x: -99, y: -99, t: 0 } : { x: e.clientX, y: e.clientY, t: now };
    if (onTap(e.clientX / S, e.clientY / S, double)) e.preventDefault();
  });
  window.addEventListener('dblclick', (e) => {
    if (!blocked(e.target) && spots.some((sp) => e.clientX / S >= sp.x0 && e.clientX / S <= sp.x1)) e.preventDefault(); // 别选中文字
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const lx = e.clientX / S;
    const ly = e.clientY / S;
    const over = !blocked(e.target) && spots.some((sp) => lx >= sp.x0 && lx <= sp.x1 && ly >= sp.y0 && ly <= sp.y1);
    root.classList.toggle('world-hover', over);
  });

  /** 3x5 像素字：只需要 H、i、! 和心形 */
  const GLYPHS: Record<string, string[]> = {
    H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'],
    i: ['.x.', '...', '.x.', '.x.', '.x.'],
    '!': ['.x.', '.x.', '.x.', '...', '.x.'],
    '♥': ['.....', 'xx.xx', 'xxxxx', '.xxx.', '..x..'],
  };
  function bubble(cx: number, bottom: number, text: string, color: string) {
    const glyphs = [...text].map((c) => GLYPHS[c]);
    const w = glyphs.reduce((a, gl) => a + gl[0].length + 1, 3);
    const h = 9;
    const x = Math.round(cx - w / 2);
    const y = bottom - h - 3;
    g.fillStyle = '#2a1f22';
    g.fillRect(x, y + 1, w, h - 2);
    g.fillRect(x + 1, y, w - 2, h);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillRect(Math.round(cx) - 1, y + h - 1, 2, 2); // 小尾巴
    g.fillStyle = '#2a1f22';
    g.fillRect(Math.round(cx) - 1, y + h + 1, 1, 1);
    g.fillStyle = color;
    let gx = x + 2;
    for (const gl of glyphs) {
      gl.forEach((row, ry) => [...row].forEach((c, rx) => c === 'x' && g.fillRect(gx + rx, y + 2 + ry, 1, 1)));
      gx += gl[0].length + 1;
    }
  }

  /** 每帧推进彩蛋动画，画在前景（夜色会盖上去） */
  function drawActors(dt: number, camLeft: number) {
    if (signFlip !== signTarget) {
      const dir = signTarget > signFlip ? 1 : -1;
      signFlip = clamp(signFlip + dir * dt * (reduced.matches ? 100 : 2.2), 0, 1);
    }
    hayShake = Math.max(0, hayShake - dt);
    // 女孩：开门 -> 走出来 -> 招手 -> 走回去 -> 关门
    if (girl.state !== 'none') {
      girl.t += dt;
      const doorX = cottageWx + 29.5;
      if (girl.state === 'out') {
        girl.off = Math.max(-18, -Math.max(0, girl.t - 0.35) * 20);
        if (girl.off <= -18) Object.assign(girl, { state: 'wave', t: 0 });
      } else if (girl.state === 'wave' && girl.t > 2.4) Object.assign(girl, { state: 'in', t: 0 });
      else if (girl.state === 'in') {
        girl.off = Math.min(0, -18 + girl.t * 20);
        if (girl.off >= 0 && girl.t > 1.2) Object.assign(girl, { state: 'none', t: 0, off: 0 });
      }
      const wx = doorX + girl.off;
      const facingLeft = girl.state !== 'in';
      const fr = facingLeft ? girlL : girlR;
      const walking = (girl.state === 'out' && girl.t > 0.35) || (girl.state === 'in' && girl.off < 0);
      const sp = girl.state === 'wave' ? fr.wave[Math.floor(girl.t / 0.25) % 2] : walking ? fr.walk[Math.floor(girl.t * 6) % 2] : fr.idle;
      const gy = H - Math.round(heightAt(wx));
      // 还在门里时只露出门框内的部分
      const inDoor = girl.off > -6;
      const x = Math.round(wx - 7 - camLeft);
      if (inDoor) {
        f.save();
        f.beginPath();
        f.rect(cottageX + 27 - (girl.off < -1 ? 6 : 0), cottageY + 26, 40, 13);
        f.clip();
      }
      if (girl.state !== 'in' || girl.off < 0 || girl.t < 1.0) f.drawImage(sp, x, gy - sp.height + (inDoor ? -1 : 0));
      if (inDoor) f.restore();
    }
    // 三花猫：从草堆里跳出来落在旁边，坐着甩尾巴、眨眼
    if (cat.state !== 'hidden') {
      cat.t += dt;
      const fr = catL;
      let sp = fr.sit;
      let cx = hayX - 18;
      let cy = H - Math.round(heightAt(cx));
      if (cat.state === 'jump') {
        const u = Math.min(1, cat.t / 0.7);
        cx = hayX - 2 - u * 16;
        cy = Math.round(hayBase - 6 + (H - heightAt(cx) - hayBase + 6) * u - Math.sin(u * Math.PI) * 16);
        sp = fr.jump;
        if (u >= 1) Object.assign(cat, { state: 'sit', t: 0 });
      } else {
        const ph = cat.t % 4;
        sp = ph > 3.2 ? fr.tail : ph > 1.5 && ph < 1.65 ? fr.blink : fr.sit;
      }
      cat.x = cx;
      const x = Math.round(cx - sp.width / 2 - camLeft);
      f.drawImage(sp, x, cy - sp.height + 1);
      spots.push({ kind: 'cat', x0: x - 2, y0: cy - sp.height - 2, x1: x + sp.width + 2, y1: cy + 1 });
    }
  }

  /** 招呼和喵的气泡画在夜色之上，晚上也看得清 */
  function drawBubbles(dt: number, camLeft: number) {
    if (girl.state === 'wave' && girl.t > 0.2) {
      const wx = cottageWx + 29.5 + girl.off;
      bubble(wx - camLeft, H - Math.round(heightAt(wx)) - 21, 'Hi!', '#d0603a');
    }
    if (cat.meow > 0) {
      cat.meow -= dt;
      bubble(cat.x - camLeft, H - Math.round(heightAt(cat.x)) - 10, '♥', '#e85d7a');
    }
  }

  function drawItems(camLeft: number) {
    glows.length = 0;
    const items: Item[] = [];
    const s0 = Math.floor((camLeft - 60) / SLOT);
    const s1 = Math.ceil((camLeft + W + 60) / SLOT);
    for (let s = s0; s <= s1; s++) {
      const it = slotItem(s, sc);
      if (it) items.push(it);
    }
    const sec0 = Math.floor((camLeft - 160) / SECTION);
    const sec1 = Math.ceil((camLeft + W + 160) / SECTION);
    for (let s = Math.max(-OFF, sec0); s <= Math.min(N - 1, sec1); s++) items.push(...setPieces(s, sc));
    items.sort((a, b) => a.z - b.z || a.wx - b.wx);
    for (const it of items) {
      const sp = it.sprite;
      const x = Math.round(it.wx - sp.width / 2 - camLeft);
      if (x > W || x + sp.width < 0) continue;
      // 底边陷进地面 1-2 像素，坡上取两端较低处，避免悬空
      const ground = Math.max(heightAt(it.wx - sp.width * 0.25), heightAt(it.wx + sp.width * 0.25));
      const base = H - Math.round(Math.min(ground, heightAt(it.wx))) + (it.z === 0 ? 2 : 1);
      const y = base - sp.height;
      if (sp === sc.sign && Math.abs(it.wx + 32) < 1) {
        // 起点的路牌：绕立柱水平翻转
        const k = Math.cos(signFlip * Math.PI);
        f.save();
        f.translate(x + sp.width / 2, 0);
        f.scale(Math.abs(k) < 0.08 ? 0.08 * Math.sign(k || 1) : k, 1);
        f.drawImage(sp, -sp.width / 2, y);
        f.restore();
        spots.push({ kind: 'sign', x0: x - 2, y0: y - 2, x1: x + sp.width + 2, y1: y + sp.height });
      } else if (sp === sc.hay) {
        const jig = hayShake > 0 ? Math.round(Math.sin(time * 70) * 1.5 * Math.min(1, hayShake * 4)) : 0;
        f.drawImage(sp, x + jig, y + (hayShake > 0.15 ? -1 : 0));
        hayX = it.wx;
        hayBase = base;
        spots.push({ kind: 'hay', x0: x - 2, y0: y - 3, x1: x + sp.width + 2, y1: base });
      } else f.drawImage(sp, x, y);
      if (sp === sc.cottage) {
        cottageX = x;
        cottageY = y;
        cottageWx = it.wx - sp.width / 2;
        // 门：女孩进出时是开着的（门洞发暗）
        if (girl.state !== 'none' && (girl.state !== 'wave' || girl.t < 0.3)) {
          f.fillStyle = '#3b2a22';
          f.fillRect(x + 27, y + 27, 6, 10);
          f.fillStyle = '#ffd77e';
          f.globalAlpha = 0.35;
          f.fillRect(x + 28, y + 30, 4, 7);
          f.globalAlpha = 1;
        }
        spots.push({ kind: 'door', x0: x + 25, y0: y + 24, x1: x + 35, y1: y + 38 });
      }
      if (it.glow === 'lamp') glows.push({ x: x + 3, y: y + 4, kind: 'lamp', wx: it.wx });
      if (it.glow === 'window') {
        glows.push({ x: x + COTTAGE.window[0], y: y + COTTAGE.window[1], kind: 'window', wx: it.wx });
        glows.push({ x: x + COTTAGE.lantern[0], y: y + COTTAGE.lantern[1], kind: 'lamp', wx: it.wx + 7 });
        // 炊烟
        if (!reduced.matches && Math.random() < 0.06) {
          const cx = it.wx - sp.width / 2 + COTTAGE.chimney[0];
          spawn({ x: cx + (Math.random() - 0.5) * 2, y: y + COTTAGE.chimney[1], vx: 0.05 + Math.random() * 0.06, vy: -0.12 - Math.random() * 0.08, life: 0, max: 140 + Math.random() * 60, color: dark ? '#7d8494' : '#c9ced8', size: Math.random() < 0.4 ? 2 : 1, kind: 'smoke' });
        }
      }
      if (it.glow === 'fire') glows.push({ x: x + 7, y: y + 2, kind: 'fire', wx: it.wx });
    }
  }

  function halo(x: number, y: number, r: number, color: string, a: number) {
    // 像素化的圆形光晕：按距离分 3 档透明度，越外越淡
    g.fillStyle = color;
    for (let band = 3; band >= 1; band--) {
      const rr = (r * band) / 3;
      g.globalAlpha = a / (band + 0.5);
      const ri = Math.ceil(rr);
      for (let dy = -ri; dy <= ri; dy++) {
        const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
        g.fillRect(x - half, y + dy, half * 2 + 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  function drawGlows() {
    const strength = dark ? 1 : 0.35;
    for (const gl of glows) {
      if (gl.kind === 'lamp') halo(gl.x, gl.y, 9, '#ffd36a', (0.22 + 0.04 * Math.sin(time * 3 + gl.wx)) * strength);
      if (gl.kind === 'window') halo(gl.x, gl.y, 8, '#ffcf70', 0.2 * strength);
      if (gl.kind === 'fire') drawFlame(gl.x, gl.y, gl.wx);
    }
  }

  function drawFlame(x: number, y: number, worldX: number) {
    const flick = reduced.matches ? 0 : Math.floor(time * 10) % 3;
    halo(x, y - 3, 13, '#ffb55a', dark ? 0.26 : 0.12);
    g.fillStyle = '#ff7a2a';
    g.fillRect(x - 3, y - 5 + flick, 6, 5 - flick);
    g.fillRect(x - 1, y - 8 + flick, 3, 3);
    g.fillStyle = '#ffc14d';
    g.fillRect(x - 2, y - 4 + (flick === 1 ? 1 : 0), 4, 4);
    g.fillStyle = '#fff2b0';
    g.fillRect(x - 1, y - 2, 2, 2);
    if (!reduced.matches && Math.random() < 0.15) {
      const spark = Math.random() < 0.35;
      spawn({ x: worldX + (Math.random() - 0.5) * 4, y: y - 7, vx: (Math.random() - 0.5) * 0.1, vy: -0.25 - Math.random() * 0.2, life: 0, max: 60 + Math.random() * 40, color: spark ? '#ffb84d' : '#9aa0aa', size: 1, kind: spark ? 'spark' : 'smoke' });
    }
  }

  function drawCharacter(running: boolean, sitting: boolean) {
    const frames = facing > 0 ? charR : charL;
    let sprite: Sprite;
    let bob = 0;
    if (sitting) {
      // 看书：偶尔眨眼，隔几秒翻一页
      const blinking = time > nextBlink && time < nextBlink + 0.13;
      if (time > nextBlink + 0.13) nextBlink = time + 2.5 + Math.random() * 3;
      const turning = !reduced.matches && time > nextTurn && time < nextTurn + 0.35;
      if (time > nextTurn + 0.35) nextTurn = time + 5 + Math.random() * 4;
      sprite = frames.sit[turning ? 2 : blinking ? 1 : 0];
    } else if (running) {
      const fr = Math.floor(stride / 5) % 4;
      sprite = frames.run[fr];
      bob = fr % 2 === 1 ? -1 : 0;
    } else {
      const blinking = time > nextBlink && time < nextBlink + 0.13;
      if (time > nextBlink + 0.13) nextBlink = time + 2.5 + Math.random() * 3;
      sprite = frames.idle[blinking ? 1 : 0];
    }
    const x = Math.round(W / 2 - CHAR_W / 2);
    const y = Math.round(charY - sprite.height + bob);
    g.globalAlpha = 0.22;
    g.fillStyle = '#000';
    g.fillRect(x + 2, Math.round(charY), CHAR_W - 4, 1);
    g.globalAlpha = 1;
    g.drawImage(sprite, x, y);
  }

  function weather(dt: number, camLeft: number) {
    if (reduced.matches) return;
    const w = (i: number) => clamp(1 - Math.abs(p - i) * 1.3);
    const k = dt * 60;
    if (Math.random() < w(5) * 0.8 * k) {
      spawn({ x: camLeft + Math.random() * W, y: H * 0.35, vx: 0, vy: 0.16 + Math.random() * 0.18, life: 0, max: 900, color: dark ? '#dfe7f5' : '#ffffff', size: Math.random() < 0.2 ? 2 : 1, kind: 'snow' });
    }
    if (Math.random() < w(4) * 0.35 * k) {
      spawn({ x: camLeft + Math.random() * W * 1.2, y: H * 0.4, vx: -0.15 - Math.random() * 0.15, vy: 0.2 + Math.random() * 0.12, life: 0, max: 900, color: Math.random() < 0.5 ? '#ffd6e6' : '#ef9fc2', size: Math.random() < 0.3 ? 2 : 1, kind: 'petal' });
    }
    if (Math.random() < w(1) * 0.08 * k) {
      spawn({ x: camLeft + Math.random() * W * 1.2, y: H - GROUND - 40 - Math.random() * 20, vx: -0.1 - Math.random() * 0.1, vy: 0.12 + Math.random() * 0.08, life: 0, max: 600, color: Math.random() < 0.5 ? '#8fc66b' : '#c9b25a', size: 1, kind: 'leaf' });
    }
    if (dark && Math.random() < w(1) * 0.06 * k) {
      spawn({ x: camLeft + Math.random() * W, y: H - GROUND - 6 - Math.random() * 36, vx: 0, vy: 0, life: 0, max: 240 + Math.random() * 200, color: '#fff27a', size: 1, kind: 'firefly' });
    }
  }

  function drawParticles(dt: number, camLeft: number) {
    const k = dt * 60;
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += k;
      if (pt.kind === 'snow') pt.vx = Math.sin((pt.life + pt.x) * 0.03) * 0.15;
      if (pt.kind === 'petal' || pt.kind === 'leaf') pt.vx += Math.sin(pt.life * 0.05) * 0.004;
      if (pt.kind === 'firefly') {
        pt.vx += (Math.random() - 0.5) * 0.02;
        pt.vy += (Math.random() - 0.5) * 0.02;
        pt.vx *= 0.98;
        pt.vy *= 0.98;
      }
      if (pt.kind === 'dust') {
        pt.vy += 0.01 * k;
        if (!runningNow) pt.life += k * 3; // 停下后脚边的灰很快散掉，不拖尾
      }
      pt.x += pt.vx * k;
      pt.y += pt.vy * k;
      const sx = Math.round(pt.x - camLeft);
      const groundY = H - heightAt(pt.x);
      if (pt.life > pt.max || pt.y > groundY + 1 || sx < -20 || sx > W + 20) {
        particles.splice(i, 1);
        continue;
      }
      let a = Math.min(1, pt.life / 30); // 从半空淡入，衔接上方的渐隐遮罩
      if (pt.kind === 'dust' || pt.kind === 'smoke' || pt.kind === 'spark') a = 1 - pt.life / pt.max;
      if (pt.kind === 'firefly') a = (0.5 + 0.5 * Math.sin(pt.life * 0.08)) * Math.min(1, (pt.max - pt.life) / 40);
      g.globalAlpha = clamp(a) * (pt.kind === 'smoke' ? 0.45 : 1);
      g.fillStyle = pt.color;
      g.fillRect(sx, Math.round(pt.y), pt.size, pt.size);
    }
    g.globalAlpha = 1;
  }

  /* ---------- 主循环 ---------- */

  let last = performance.now();
  function frame(now: number) {
    // 阅读时世界只露出一条，降到约 20 帧省电；相机还在赶路时照常全速
    if (reading && camX === (secret ? -1 : p) * SECTION && now - lastDraw < 50) {
      requestAnimationFrame(frame);
      return;
    }
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    p = progress();
    const target = (secret ? -1 : p) * SECTION;
    if (reduced.matches) camX = target;
    else camX += (target - camX) * Math.min(1, dt * 10);
    if (Math.abs(target - camX) < 0.05) camX = target;

    const v = camX - lastCam;
    lastCam = camX;
    if (Math.abs(v) > 0.04) {
      runTimer = 0.12;
      facing = v > 0 ? 1 : -1;
      stride += Math.min(Math.abs(v), 8);
    } else runTimer -= dt;
    const running = runTimer > 0 && !reduced.matches;
    runningNow = running;

    const camLeft = Math.round(camX - W / 2);
    const groundY = H - Math.round(heightAt(camX));
    if (reduced.matches) charY = groundY;
    else charY += (groundY - charY) * Math.min(1, dt * 18);

    if (running && Math.random() < 0.5) {
      const pal = paletteAt(camX);
      spawn({ x: camX - facing * 4, y: charY - 1, vx: -facing * (0.2 + Math.random() * 0.3), vy: -0.2 - Math.random() * 0.2, life: 0, max: 22, color: pal.rim, size: 1, kind: 'dust' });
    }

    const tint = mix(BIOMES[weights(camX)[0]].tint, BIOMES[weights(camX)[1]].tint, weights(camX)[2]);
    if (tint !== lastTint) {
      lastTint = tint;
      root.style.setProperty('--tint', tint);
    }

    g.clearRect(0, 0, W, H);
    drawLayer('far', 0.18, dark ? 0.55 : 0.62, camLeft);
    drawLayer('mid', 0.42, dark ? 0.32 : 0.36, camLeft);
    drawLayer('near', 0.7, dark ? 0.14 : 0.14, camLeft);

    f.clearRect(0, 0, W, H);
    spots = [];
    drawItems(camLeft);
    drawGround(camLeft);
    drawActors(dt, camLeft);
    if (dark) {
      f.globalCompositeOperation = 'source-atop';
      f.fillStyle = NIGHT;
      f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'source-over';
    }
    g.drawImage(fgCanvas, 0, 0);
    drawGlows();
    drawBubbles(dt, camLeft);
    weather(dt, camLeft);
    drawCharacter(running, reading && !running && Math.abs(p * SECTION - camX) < 1.5);
    drawParticles(dt, camLeft);

    updatePanels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  updatePanels();

  return {
    goTo,
    /** 进入 / 离开阅读状态：小人到地方后坐下看书，世界降帧 */
    setReading(on: boolean) {
      reading = on;
      nextTurn = time + 4;
    },
  };
}

export type World = ReturnType<typeof startWorld>;
