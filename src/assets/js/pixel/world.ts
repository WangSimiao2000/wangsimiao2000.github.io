/**
 * 像素世界：页面纵向滚动 -> 世界横向前进。
 *
 * - 每个 <section> 占一屏并带 scroll-snap，滚动进度 p（0..N-1）映射到相机世界坐标 p*SECTION。
 * - 每个板块对应一个生物群系，板块中心附近地形压平，小人总能稳稳站住。
 * - 小人在相机移动时播放跑步帧（按移动距离推进，脚步和地面同步），停下后待机、眨眼。
 * - 内容面板固定在上方，随世界同速横移并淡入淡出；非当前面板设为 inert。
 */
import {
  BLOCK,
  buildBlocks,
  buildCharacter,
  buildDecorations,
  hash,
  type BlockKind,
  type CharacterFrames,
  type Decorations,
  type Sprite,
} from './sprites.js';

interface Biome {
  name: string;
  sky: [string, string]; // 顶部、地平线
  far: string; // 远山
  mid: string; // 近丘
  top: BlockKind;
  under: BlockKind;
  deep: BlockKind;
  amp: number; // 地形起伏（方块）
}

const BIOMES: Biome[] = [
  { name: 'plains', sky: ['#5ea9f2', '#cdebff'], far: '#9cc3dd', mid: '#7fb36a', top: 'grass', under: 'dirt', deep: 'stone', amp: 1.2 },
  { name: 'forest', sky: ['#4f9de6', '#bfe4ff'], far: '#86aecb', mid: '#4f8d45', top: 'grass', under: 'dirt', deep: 'stone', amp: 2 },
  { name: 'desert', sky: ['#6fb0ea', '#ffe6b8'], far: '#e2c08d', mid: '#d9b56e', top: 'sand', under: 'sand', deep: 'sandstone', amp: 2.2 },
  { name: 'village', sky: ['#6b8fd8', '#ffd2a1'], far: '#a59bc4', mid: '#6f9a58', top: 'grass', under: 'dirt', deep: 'stone', amp: 1.4 },
  { name: 'cherry', sky: ['#5b4f9c', '#ff9f9a'], far: '#b48bb8', mid: '#a7759a', top: 'cherryGrass', under: 'dirt', deep: 'stone', amp: 1.8 },
  { name: 'snow', sky: ['#0b1430', '#2d3f74'], far: '#3c4d7d', mid: '#5a6d9c', top: 'snow', under: 'dirt', deep: 'stone', amp: 2.4 },
];

const SECTION_BLOCKS = 40;
const SECTION = SECTION_BLOCKS * BLOCK; // 相邻板块间的世界距离（逻辑像素）
const GROUND = 4; // 板块中心处地面厚度（方块）
const CHAR_W = 14;
const CHAR_H = 20;

/* ---------- 小工具 ---------- */

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string) {
  let v = rgbCache.get(hex);
  if (!v) rgbCache.set(hex, (v = hexToRgb(hex)));
  return v;
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}
function mixRgbStr(a: string, b: string, t: number) {
  return mix(a, b, t);
}

/** 1D value noise，范围 [-1,1] */
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}

/** 按进度 p 在相邻群系间插值某个颜色字段 */
function biomeColor(p: number, pick: (b: Biome) => string): string {
  const i = clamp(Math.floor(p), 0, BIOMES.length - 1);
  const j = Math.min(i + 1, BIOMES.length - 1);
  const t = smooth(0.25, 0.75, p - i);
  return mixRgbStr(pick(BIOMES[i]), pick(BIOMES[j]), t);
}

/* ---------- 地形 ---------- */

function biomeAt(wx: number, col: number): number {
  const f = wx / SECTION;
  const j = Math.floor(f);
  const frac = f - j;
  // 板块交界在 frac=0.5，用抖动混合两边方块，像素风的「渐变」
  const pRight = clamp((frac - 0.5) / 0.1 + 0.5);
  const idx = hash(col * 1.37 + 9.1) < pRight ? j + 1 : j;
  return clamp(idx, 0, BIOMES.length - 1);
}

const surfaceCache = new Map<number, number>();
/** 某列地面高度（方块数，从屏幕底部数） */
function surfaceBlocks(col: number): number {
  const cached = surfaceCache.get(col);
  if (cached !== undefined) return cached;
  const wx = col * BLOCK + BLOCK / 2;
  const nearest = Math.round(wx / SECTION);
  const dist = Math.abs(wx - nearest * SECTION) / BLOCK;
  const flat = smooth(3, 11, dist);
  const b = BIOMES[biomeAt(wx, col)];
  const n = noise1(col * 0.16) * 0.7 + noise1(col * 0.41 + 50) * 0.3;
  const h = Math.max(2, GROUND + Math.round(n * b.amp * flat));
  surfaceCache.set(col, h);
  return h;
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
  kind: 'dust' | 'snow' | 'petal' | 'firefly' | 'spark' | 'smoke';
}

/* ---------- 主体 ---------- */

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  sections: HTMLElement[];
  panels: HTMLElement[];
  slots: HTMLElement[];
}

export function startWorld({ canvas, sections, panels, slots }: WorldOptions) {
  const g = canvas.getContext('2d')!;
  const blocks = buildBlocks();
  const deco: Decorations = buildDecorations(blocks);
  const charR: CharacterFrames = buildCharacter(false);
  const charL: CharacterFrames = buildCharacter(true);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const N = sections.length;

  let S = 4; // 每个逻辑像素对应的 CSS 像素
  let W = 0;
  let H = 0;

  function resize() {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    S = Math.max(2, Math.round(vh / 190));
    if (vw / S < 96) S = Math.max(2, Math.floor(vw / 96));
    W = Math.ceil(vw / S);
    H = Math.ceil(vh / S);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${W * S}px`;
    canvas.style.height = `${H * S}px`;
    g.imageSmoothingEnabled = false;
    const root = document.documentElement.style;
    root.setProperty('--px', `${S}px`);
    // 面板底边留出：地面 + 小人 + 一点余量
    root.setProperty('--stage', `${(GROUND * BLOCK + CHAR_H + 14) * S}px`);
    root.setProperty('--ground', `${GROUND * BLOCK * S}px`);
  }
  resize();
  window.addEventListener('resize', resize);

  /* 滚动进度 */
  function progress(): number {
    const h = sections[0].offsetHeight || window.innerHeight;
    return clamp(window.scrollY / h, 0, N - 1);
  }

  let p = progress();
  let camX = p * SECTION;
  let lastCam = camX;
  let charY = H - surfaceBlocks(Math.floor(camX / BLOCK)) * BLOCK;
  let facing = 1;
  let runTimer = 0;
  let stride = 0;
  let time = 0;
  let nextBlink = 2.5;
  let activeIdx = -1;
  let lastTint = '';
  const particles: Particle[] = [];

  function spawn(pt: Particle) {
    if (particles.length < 420) particles.push(pt);
  }

  /* ---------- 面板与快捷栏 ---------- */

  function updatePanels() {
    const shift = SECTION * S;
    panels.forEach((panel, i) => {
      const d = i - p;
      const a = clamp(1 - Math.abs(d) * 1.6);
      panel.style.transform = `translate3d(${(d * shift).toFixed(1)}px,0,0)`;
      panel.style.opacity = a.toFixed(3);
      panel.style.visibility = a <= 0.001 ? 'hidden' : 'visible';
    });
    const idx = Math.round(p);
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
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // 和 MC 一样：数字键切换快捷栏
    const n = Number(e.key);
    if (n >= 1 && n <= N) {
      e.preventDefault();
      goTo(n - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(Math.round(p) + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(Math.round(p) - 1);
    }
  });

  /* ---------- 绘制 ---------- */

  const horizon = () => H - GROUND * BLOCK;

  function drawLayer(factor: number, color: string, base: number, amp: number, freq: number, seed: number) {
    const hz = horizon();
    const off = camX * factor;
    g.fillStyle = color;
    let runX = 0;
    let runH = -1;
    for (let x = 0; x <= W; x++) {
      const wx = Math.floor((off + x) / 2); // 2px 一阶，更有像素感
      const h = x === W ? -2 : Math.round((base + (noise1(wx * freq + seed) * 0.5 + 0.5) * amp) / 2) * 2;
      if (h !== runH) {
        if (runH > 0) g.fillRect(runX, hz + 4 - runH, x - runX, runH);
        runX = x;
        runH = h;
      }
    }
  }

  function drawBlockAt(kind: BlockKind, x: number, y: number) {
    g.drawImage(blocks[kind], x, y);
  }

  function decoAt(col: number, b: number, center: number): { sprite: Sprite; ox: number } | null {
    const rel = col - center;
    const r = hash(col * 7.31 + b * 13.7);
    const near = Math.abs(rel) <= 2;
    const m2 = ((col % 2) + 2) % 2;
    const m3 = ((col % 3) + 3) % 3;
    // 树等大件的变体，与列号取模无关，避免同一群系里总是同一棵树
    const v3 = Math.floor(hash(col * 3.3 + 1) * 3);
    const v2 = v3 % 2;
    // 每个板块的固定布景
    if (rel === -4) return { sprite: deco.sign, ox: 0 };
    if (b === 3) {
      if (rel === 4) return { sprite: deco.house, ox: 0 };
      if (rel === -8 || rel === 13) return { sprite: deco.lamp, ox: 2 };
      if (rel >= 3 && rel <= 10) return null;
    }
    if (near) return null;
    switch (BIOMES[b].name) {
      case 'plains':
        if (r < 0.07 && m2 === 0) return { sprite: deco.oak[v3], ox: -6 };
        if (r < 0.3) return { sprite: deco.tuft[m3], ox: 2 };
        if (r < 0.38) return { sprite: m2 ? deco.flowerRed : deco.flowerYellow, ox: 3 };
        return null;
      case 'forest':
        if (m3 === 0 && r < 0.75) return { sprite: r < 0.4 ? deco.birch[v2] : deco.oak[v3], ox: -6 };
        if (r < 0.85) return { sprite: deco.tuft[m3], ox: 2 };
        if (r < 0.93) return { sprite: deco.mushroom, ox: 2 };
        return null;
      case 'desert':
        if (r < 0.12 && m2 === 0) return { sprite: deco.cactus[v3], ox: -2 };
        if (r < 0.24) return { sprite: deco.deadBush, ox: 1 };
        return null;
      case 'village':
        if (r < 0.06 && m2 === 0) return { sprite: deco.oak[v3], ox: -6 };
        if (r < 0.35) return { sprite: deco.tuft[m3], ox: 2 };
        if (r < 0.42) return { sprite: deco.flowerYellow, ox: 3 };
        return null;
      case 'cherry':
        if (m3 === 0 && r < 0.5) return { sprite: deco.cherry[v3], ox: -8 };
        if (r < 0.6) return { sprite: deco.tuft[m3], ox: 2 };
        if (r < 0.68) return { sprite: deco.flowerRed, ox: 3 };
        return null;
      case 'snow':
        if (rel === 3) return { sprite: deco.campfire, ox: -1 };
        if (m3 === 0 && r < 0.55) return { sprite: deco.spruce[v3], ox: -6 };
        return null;
    }
    return null;
  }

  function drawWorld(camLeft: number) {
    const c0 = Math.floor(camLeft / BLOCK) - 6;
    const c1 = Math.ceil((camLeft + W) / BLOCK) + 6;
    // 先画装饰（在地面方块之上、小人之后）
    for (let c = c0; c <= c1; c++) {
      const wx = c * BLOCK + BLOCK / 2;
      const b = biomeAt(wx, c);
      const center = Math.round(wx / SECTION) * SECTION_BLOCKS;
      const d = decoAt(c, b, center);
      if (!d) continue;
      const sy = H - surfaceBlocks(c) * BLOCK;
      const x = Math.round(c * BLOCK + d.ox - camLeft);
      g.drawImage(d.sprite, x, sy - d.sprite.height);
      if (d.sprite === deco.campfire) drawFlame(x + 5, sy - 3, c * BLOCK + d.ox + 5);
      if (d.sprite === deco.lamp) {
        g.globalAlpha = 0.18 + 0.05 * Math.sin(time * 3 + c);
        g.fillStyle = '#ffd36a';
        g.fillRect(x - 3, sy - d.sprite.height - 3, 11, 12);
        g.globalAlpha = 1;
      }
    }
    // 地面
    for (let c = c0; c <= c1; c++) {
      const wx = c * BLOCK + BLOCK / 2;
      const bi = biomeAt(wx, c);
      const b = BIOMES[bi];
      const sb = surfaceBlocks(c);
      const x = Math.round(c * BLOCK - camLeft);
      const center = Math.round(wx / SECTION) * SECTION_BLOCKS;
      const top: BlockKind = bi === 3 && Math.abs(c - center) <= 7 ? 'path' : b.top;
      const rows = sb + 1; // 多画一层，盖住非 8 倍数的屏幕底边
      for (let k = 0; k < rows; k++) {
        const kind: BlockKind = k === 0 ? top : k < 3 ? b.under : b.deep;
        drawBlockAt(kind, x, H - (sb - k) * BLOCK);
      }
    }
  }

  function drawFlame(x: number, y: number, worldX: number) {
    const flick = reduced.matches ? 0 : Math.floor(time * 10) % 3;
    g.fillStyle = '#ff8c1a';
    g.fillRect(x - 3, y - 6 + flick, 6, 6 - flick);
    g.fillStyle = '#ffd34d';
    g.fillRect(x - 1, y - 4 + (flick === 1 ? 1 : 0), 3, 4);
    g.globalAlpha = 0.1;
    g.fillStyle = '#ffb84d';
    g.fillRect(x - 10, y - 12, 20, 14);
    g.globalAlpha = 1;
    if (!reduced.matches && Math.random() < 0.15) {
      spawn({ x: worldX + (Math.random() - 0.5) * 4, y: y - 6, vx: (Math.random() - 0.5) * 0.1, vy: -0.25 - Math.random() * 0.2, life: 0, max: 60 + Math.random() * 40, color: Math.random() < 0.3 ? '#ffb84d' : '#8a8a8a', size: 1, kind: Math.random() < 0.3 ? 'spark' : 'smoke' });
    }
  }

  function drawCharacter(running: boolean) {
    const frames = facing > 0 ? charR : charL;
    let sprite: Sprite;
    let bob = 0;
    if (running) {
      const f = Math.floor(stride / 5) % 4;
      sprite = frames.run[f];
      bob = f % 2 === 1 ? -1 : 0;
    } else {
      const blinking = time > nextBlink && time < nextBlink + 0.13;
      if (time > nextBlink + 0.13) nextBlink = time + 2.5 + Math.random() * 3;
      sprite = frames.idle[blinking ? 1 : 0];
    }
    const x = Math.round(W / 2 - CHAR_W / 2);
    const y = Math.round(charY - CHAR_H + bob);
    // 影子
    g.globalAlpha = 0.25;
    g.fillStyle = '#000';
    g.fillRect(x + 2, Math.round(charY), CHAR_W - 4, 1);
    g.globalAlpha = 1;
    g.drawImage(sprite, x, y);
  }

  function weather(dt: number, camLeft: number) {
    if (reduced.matches) return;
    const w = (i: number) => clamp(1 - Math.abs(p - i) * 1.3);
    const k = dt * 60;
    if (Math.random() < w(5) * 0.9 * k) {
      spawn({ x: camLeft + Math.random() * W, y: -2, vx: 0, vy: 0.18 + Math.random() * 0.2, life: 0, max: 900, color: '#e6edf7', size: Math.random() < 0.2 ? 2 : 1, kind: 'snow' });
    }
    if (Math.random() < w(4) * 0.35 * k) {
      spawn({ x: camLeft + Math.random() * W * 1.2, y: -2, vx: -0.15 - Math.random() * 0.15, vy: 0.2 + Math.random() * 0.12, life: 0, max: 900, color: Math.random() < 0.5 ? '#f8cfe0' : '#e89bbd', size: Math.random() < 0.3 ? 2 : 1, kind: 'petal' });
    }
    if (Math.random() < w(1) * 0.05 * k) {
      spawn({ x: camLeft + Math.random() * W, y: horizon() - 6 - Math.random() * 40, vx: 0, vy: 0, life: 0, max: 240 + Math.random() * 200, color: '#fff27a', size: 1, kind: 'firefly' });
    }
  }

  function drawParticles(dt: number, camLeft: number) {
    const k = dt * 60;
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += k;
      if (pt.kind === 'snow') pt.vx = Math.sin((pt.life + pt.x) * 0.03) * 0.15;
      if (pt.kind === 'petal') pt.vx += Math.sin(pt.life * 0.05) * 0.004;
      if (pt.kind === 'firefly') {
        pt.vx += (Math.random() - 0.5) * 0.02;
        pt.vy += (Math.random() - 0.5) * 0.02;
        pt.vx *= 0.98;
        pt.vy *= 0.98;
      }
      if (pt.kind === 'dust') pt.vy += 0.01 * k;
      pt.x += pt.vx * k;
      pt.y += pt.vy * k;
      const sx = Math.round(pt.x - camLeft);
      const groundY = H - surfaceBlocks(Math.floor(pt.x / BLOCK)) * BLOCK;
      if (pt.life > pt.max || pt.y > groundY + 1 || sx < -20 || sx > W + 20) {
        particles.splice(i, 1);
        continue;
      }
      let a = 1;
      if (pt.kind === 'dust' || pt.kind === 'smoke' || pt.kind === 'spark') a = 1 - pt.life / pt.max;
      if (pt.kind === 'firefly') a = (0.5 + 0.5 * Math.sin(pt.life * 0.08)) * Math.min(1, (pt.max - pt.life) / 40);
      g.globalAlpha = clamp(a) * (pt.kind === 'smoke' ? 0.5 : 1);
      g.fillStyle = pt.color;
      g.fillRect(sx, Math.round(pt.y), pt.size, pt.size);
    }
    g.globalAlpha = 1;
  }

  /* ---------- 主循环 ---------- */

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    p = progress();
    const target = p * SECTION;
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

    const camLeft = Math.round(camX - W / 2);
    const footCol = Math.floor(camX / BLOCK);
    const groundY = H - surfaceBlocks(footCol) * BLOCK;
    if (reduced.matches) charY = groundY;
    else charY += (groundY - charY) * Math.min(1, dt * 18);

    if (running && Math.random() < 0.5) {
      spawn({ x: camX - facing * 4, y: charY - 1, vx: -facing * (0.2 + Math.random() * 0.3), vy: -0.2 - Math.random() * 0.2, life: 0, max: 22, color: '#d8cfc0', size: 1, kind: 'dust' });
    }

    g.clearRect(0, 0, W, H);
    // 天空不再画像素：页面背景本身就是天空（亮色近白 / 暗色深灰），
    // 只把当前群系的色调交给 CSS，在地平线附近做一层很淡的晕染
    const tint = biomeColor(p, (b) => b.sky[1]);
    if (tint !== lastTint) {
      lastTint = tint;
      document.documentElement.style.setProperty('--tint', tint);
    }
    // 远景越远越淡，最终交给 CSS 遮罩融进天空
    g.globalAlpha = 0.4;
    drawLayer(0.2, biomeColor(p, (b) => b.far), 24, 46, 0.035, 10);
    g.globalAlpha = 0.75;
    drawLayer(0.45, biomeColor(p, (b) => b.mid), 6, 22, 0.06, 90);
    g.globalAlpha = 1;
    drawWorld(camLeft);
    weather(dt, camLeft);
    drawCharacter(running);
    drawParticles(dt, camLeft);

    updatePanels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  updatePanels();
}
