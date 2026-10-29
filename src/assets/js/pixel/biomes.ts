/**
 * 群系与地形：数据表 + 纯函数，不碰 DOM。
 *
 * 要加一个群系，只需要在 BIOMES 里加一行：配色、起伏、植被（flora）、固定布景（pieces）、
 * 留空区（clear）都在这一行里声明，渲染、地形、布景生成会自动跟上。
 */
import { hash, type Sprite } from './sprites.js';
import type { Scenery } from './scenery.js';
import { clamp, css, mix, mixRGB, noise1, rgb, smooth, type RGB } from './util.js';

/** Scenery 里「一组变体」的键（树、灌木、草……） */
export type FloraKind = { [K in keyof Scenery]: Scenery[K] extends Sprite[] ? K : never }[keyof Scenery];
/** Scenery 里「单个精灵」的键（小屋、路灯、营火……） */
export type PieceKind = { [K in keyof Scenery]: Scenery[K] extends Sprite[] ? never : K }[keyof Scenery];
export type GlowKind = 'lamp' | 'window' | 'fire';
/** 可交互的彩蛋，由 eggs.ts 按这个标记接管绘制和点击 */
export type EggKind = 'sign' | 'hay' | 'door';

export interface Flora {
  /** 按随机数 r 从小到大匹配：r < until 时长这一种 */
  until: number;
  kind: FloraKind;
  /** 绘制顺序：0 树（最先画）、1 大件、2 灌木石头、3 小草花 */
  z: number;
}

export interface Piece {
  kind: PieceKind;
  /** 相对板块中心的世界坐标 */
  dx: number;
  z: number;
  glow?: GlowKind;
  egg?: EggKind;
}

export interface Biome {
  name: string;
  tint: string; // 地平线晕染（交给 CSS）
  far: string; // 远山
  mid: string; // 中景丘陵
  near: string; // 近景树线
  treeline: number; // 中/近景轮廓上的树冠起伏，0 = 光秃
  spiky: boolean; // 树线是尖的（针叶林）
  line: string; // 地表轮廓的描边（和素材的描边同色系）
  rim: string; // 地表最上沿的受光线
  top: string; // 表层（草 / 沙 / 雪）
  shade: string; // 表层底部
  soil: [string, string, string]; // 由浅到深的土层
  amp: number; // 地形起伏（逻辑像素）
  blades: boolean; // 地表冒出草尖
  /** 雪地上零星的亮点（没有草尖时用） */
  sparkle?: boolean;
  flora: Flora[];
  pieces?: Piece[];
  /** 不长植被的区间（相对板块中心），给布景和彩蛋留地方 */
  clear?: [number, number][];
  /** 板块中心两侧铺土路的半宽 */
  path?: number;
  /** 这一带飘的天气粒子，rate 是每帧（60fps）的生成概率 */
  weather?: { kind: WeatherKind; rate: number };
  /** 深色模式下萤火虫的生成概率 */
  fireflies?: number;
}

export type WeatherKind = 'snow' | 'petal' | 'leaf';

const SOIL: [string, string, string] = ['#a8805b', '#8a6548', '#6c4f3c'];

/**
 * 群系按世界里的板块顺序排列。第 0 个是起点左边藏着的「秋林」：双击起点的路牌把它翻过来，
 * 才能往回走进去（世界坐标为负）。OFF 是起点在数组里的下标。
 */
export const BIOMES: Biome[] = [
  {
    name: 'autumn', tint: '#ffe0bf', far: '#d9c3b4', mid: '#d9a77a', near: '#c98a5a', treeline: 0.9, spiky: false,
    line: '#6a360d', rim: '#f3dc8e', top: '#d6b45c', shade: '#b48d43', soil: SOIL, amp: 9, blades: true,
    flora: [{ until: 0.34, kind: 'autumn', z: 0 }, { until: 0.46, kind: 'autumnBush', z: 2 }, { until: 0.62, kind: 'dryTuft', z: 3 }],
  },
  {
    name: 'plains', tint: '#cdebff', far: '#a9c3da', mid: '#a3c99a', near: '#82b76e', treeline: 0.35, spiky: false,
    line: '#1e462b', rim: '#d2ee95', top: '#8cc762', shade: '#68a44d', soil: SOIL, amp: 9, blades: true,
    flora: [
      { until: 0.1, kind: 'oak', z: 0 }, { until: 0.2, kind: 'bush', z: 2 }, { until: 0.26, kind: 'rock', z: 2 },
      { until: 0.55, kind: 'tuft', z: 3 }, { until: 0.75, kind: 'flowers', z: 3 },
    ],
  },
  {
    name: 'forest', tint: '#bfe4ff', far: '#93b1c9', mid: '#76a57b', near: '#548a5c', treeline: 1, spiky: false,
    line: '#1e462b', rim: '#b4de80', top: '#64a854', shade: '#468345', soil: ['#8e6c4e', '#6f533f', '#534034'], amp: 13, blades: true,
    flora: [
      { until: 0.3, kind: 'forest', z: 0 }, { until: 0.48, kind: 'oak', z: 0 },
      { until: 0.62, kind: 'bush', z: 2 }, { until: 0.85, kind: 'tuft', z: 3 },
    ],
    pieces: [{ kind: 'hay', dx: 46, z: 2, egg: 'hay' }],
    clear: [[30, 64]], // 草堆周围
    weather: { kind: 'leaf', rate: 0.08 },
    fireflies: 0.06,
  },
  {
    name: 'desert', tint: '#ffe6b8', far: '#e9d2b3', mid: '#e6c595', near: '#dcb07d', treeline: 0, spiky: false,
    line: '#9a6f42', rim: '#fdebc6', top: '#f2d6a3', shade: '#e2bb86', soil: ['#d7ad78', '#c39667', '#a97e58'], amp: 15, blades: false,
    flora: [{ until: 0.1, kind: 'cactus', z: 1 }, { until: 0.2, kind: 'sandRock', z: 2 }, { until: 0.36, kind: 'dryTuft', z: 3 }],
  },
  {
    name: 'village', tint: '#ffd9ae', far: '#bcbad6', mid: '#a7c792', near: '#87b56c', treeline: 0.45, spiky: false,
    line: '#1e462b', rim: '#d6ec94', top: '#90c664', shade: '#6aa24e', soil: SOIL, amp: 7, blades: true,
    flora: [
      { until: 0.08, kind: 'oak', z: 0 }, { until: 0.2, kind: 'bush', z: 2 },
      { until: 0.48, kind: 'tuft', z: 3 }, { until: 0.68, kind: 'flowers', z: 3 },
    ],
    pieces: [
      { kind: 'cottage', dx: 52, z: 1, glow: 'window', egg: 'door' },
      { kind: 'fence', dx: 98, z: 2 },
      { kind: 'lamp', dx: -62, z: 1, glow: 'lamp' },
      { kind: 'lamp', dx: 120, z: 1, glow: 'lamp' },
    ],
    clear: [[14, 124]], // 小屋和栅栏
    path: 70,
  },
  {
    name: 'cherry', tint: '#ffd0d6', far: '#d8bdd3', mid: '#dcadc6', near: '#c08cab', treeline: 0.9, spiky: false,
    line: '#1e462b', rim: '#dcf0a2', top: '#9bcd6c', shade: '#73aa57', soil: ['#a07b63', '#816150', '#644c42'], amp: 11, blades: true,
    flora: [
      { until: 0.32, kind: 'blossom', z: 0 }, { until: 0.44, kind: 'blossomBush', z: 2 },
      { until: 0.66, kind: 'tuft', z: 3 }, { until: 0.78, kind: 'flowers', z: 3 },
    ],
    weather: { kind: 'petal', rate: 0.35 },
  },
  {
    name: 'snow', tint: '#bccbea', far: '#b6c3dc', mid: '#9fafcd', near: '#8396bb', treeline: 0.85, spiky: true,
    line: '#5e6b8a', rim: '#ffffff', top: '#eef3fb', shade: '#cfd9ea', soil: ['#908c9c', '#716d80', '#565368'], amp: 15, blades: false, sparkle: true,
    flora: [{ until: 0.38, kind: 'pine', z: 0 }, { until: 0.5, kind: 'snowRock', z: 2 }],
    pieces: [{ kind: 'campfire', dx: 24, z: 2, glow: 'fire' }],
    clear: [[10, 40]], // 篝火
    weather: { kind: 'snow', rate: 0.8 },
  },
];

export const OFF = 1; // 起点（板块 0）在 BIOMES 里的下标
export const SECTION = 320; // 相邻板块间的世界距离（逻辑像素）
export const GROUND = 32; // 板块中心处地面高度
export const SLOT = 9; // 植被的槽位间距

/** 板块编号对应的群系（-1 是隐藏的秋林），越界时返回 undefined */
export const biomeOf = (sec: number): Biome | undefined => BIOMES[sec + OFF];

/** 世界坐标处的两个相邻群系及混合系数：交界在两板块正中，过渡带占整段的 40% */
export function weights(wx: number): [number, number, number] {
  const f = wx / SECTION + OFF;
  const i = clamp(Math.floor(f), 0, BIOMES.length - 1);
  const j = Math.min(i + 1, BIOMES.length - 1);
  const t = i === j || f < 0 ? 0 : smooth(0.3, 0.7, f - i);
  return [i, j, t];
}

export const STEPS = 24; // 颜色插值量化，便于缓存
export interface Palette {
  line: string;
  rim: string;
  top: string;
  shade: string;
  soil: [string, string, string];
  path: string[]; // 村庄小路：受光线、表层、表层底部、描边
}
const PATH = ['#d8bb8c', '#c4a274', '#a9875d', '#5c3d24'];
const paletteCache = new Map<number, Palette>();
export function paletteAt(wx: number): Palette {
  const [i, j, t] = weights(wx);
  const q = Math.round(t * STEPS);
  const key = i * 100 + q;
  let pal = paletteCache.get(key);
  if (!pal) {
    const a = BIOMES[i];
    const b = BIOMES[j];
    const k = q / STEPS;
    pal = {
      line: mix(a.line, b.line, k),
      rim: mix(a.rim, b.rim, k),
      top: mix(a.top, b.top, k),
      shade: mix(a.shade, b.shade, k),
      soil: [mix(a.soil[0], b.soil[0], k), mix(a.soil[1], b.soil[1], k), mix(a.soil[2], b.soil[2], k)],
      path: PATH,
    };
    paletteCache.set(key, pal);
  }
  return pal;
}

/** 两个相邻群系的某个数值属性按混合系数插值 */
export function biomeNum(wx: number, pick: (b: Biome) => number): number {
  const [i, j, t] = weights(wx);
  return pick(BIOMES[i]) * (1 - t) + pick(BIOMES[j]) * t;
}

/** 地面高度（逻辑像素，从屏幕底边数），板块中心附近压平 */
export function heightAt(wx: number): number {
  const nearest = Math.round(wx / SECTION);
  const dist = Math.abs(wx - nearest * SECTION);
  const flat = smooth(16, 96, dist);
  const n = noise1(wx * 0.011) * 0.66 + noise1(wx * 0.027 + 40) * 0.27 + noise1(wx * 0.085 + 7) * 0.07;
  return GROUND + n * biomeNum(wx, (b) => b.amp) * flat;
}

/** 这一列是否在村庄小路上 */
export function onPath(wx: number): boolean {
  const sec = Math.round(wx / SECTION);
  const half = biomeOf(sec)?.path;
  return !!half && Math.abs(wx - sec * SECTION) < half - hash(wx * 0.37) * 6;
}

export type Layer = 'far' | 'mid' | 'near';
const layerColorCache = new Map<string, [string, string]>();
/** 远景某层在某处的颜色：先（深色模式下）入夜，再向雾色靠拢；第二个是轮廓上沿的受光线 */
export function layerColor(wx: number, which: Layer, haze: number, dark: boolean, bg: string): [string, string] {
  const [i, j, t] = weights(wx);
  const q = Math.round(t * STEPS);
  const key = `${which}${i}${q}${dark ? 1 : 0}${bg}${haze}`;
  let c = layerColorCache.get(key);
  if (!c) {
    let base = mixRGB(rgb(BIOMES[i][which]), rgb(BIOMES[j][which]), q / STEPS);
    if (dark) base = mixRGB(base, rgb('#1d2639'), 0.62);
    const tintRGB = mixRGB(rgb(BIOMES[i].tint), rgb(BIOMES[j].tint), q / STEPS);
    const fog = mixRGB(rgb(bg), tintRGB, dark ? 0.08 : 0.25);
    const body = mixRGB(base, fog, haze);
    const lit = mixRGB(body, dark ? rgb('#8796b8') : ([255, 255, 255] as RGB), dark ? 0.12 : 0.28);
    c = [css(body), css(lit)];
    layerColorCache.set(key, c);
  }
  return c;
}

/* ---------- 布景生成 ---------- */

export interface Item {
  sprite: Sprite;
  wx: number; // 精灵底边中心的世界坐标
  z: number; // 绘制顺序：小的在前
  glow?: GlowKind;
  egg?: EggKind;
}

/** 第 s 个植被槽位长什么（或者什么都不长）。同一个槽位永远返回同一个结果 */
export function slotItem(s: number, sc: Scenery): Item | null {
  const wx = s * SLOT + Math.floor(hash(s * 0.91 + 0.3) * 6);
  const center = Math.round(wx / SECTION) * SECTION;
  const rel = wx - center;
  if (Math.abs(rel) < 24) return null; // 小人脚下与路牌留空
  const [i, j, t] = weights(wx);
  const bi = hash(s * 1.73 + 3.1) < t ? j : i;
  const b = BIOMES[bi];
  if (b.clear?.some(([lo, hi]) => rel > lo && rel < hi)) return null;
  const r = hash(s * 7.31 + bi * 13.7);
  const v = hash(s * 3.37 + 1.9);
  const fl = b.flora.find((x) => r < x.until);
  if (!fl) return null;
  const arr = sc[fl.kind];
  return { sprite: arr[Math.floor(v * arr.length)], wx, z: fl.z };
}

/** 每个板块的固定布景：每块都有路牌（起点那块可以翻转），再加上群系自己的布景 */
export function setPieces(sec: number, sc: Scenery): Item[] {
  const c = sec * SECTION;
  const items: Item[] = [{ sprite: sc.sign, wx: c - 32, z: 1, egg: sec === 0 ? 'sign' : undefined }];
  for (const pc of biomeOf(sec)?.pieces ?? []) items.push({ sprite: sc[pc.kind], wx: c + pc.dx, z: pc.z, glow: pc.glow, egg: pc.egg });
  return items;
}
