/**
 * 绘制清单：模拟（sim/）和渲染器（render/）之间唯一的约定。
 *
 * sim/ 每帧只往清单里写「在哪一层、哪个位置、画图集里的哪块 / 填什么颜色」，不碰画布；
 * 渲染器只读清单，按 COMPOSE 里写好的顺序和规则把各层合成到画布上，不知道画的是什么。
 * 坐标都是逻辑像素（一格 = 一个像素画像素），原点在画布左上角。
 */
import type { Sprite } from './atlas.js';
import { rgb } from './sim/util.js';

/**
 * 图层，按合成顺序排列。每层先单独画好，再合成：
 *   sky      天空画布：日月星、孔明灯、烟花（在世界画布后面）
 *   far      远山 \
 *   mid      丘陵  > 远景三层，合成时一起自下而上淡出；开了景深时越远越糊
 *   near     树线 /
 *   back     后排树：树线和主平面之间一排真正的树，比主平面走得慢、糊一点；只有 WebGPU 渲染器画
 *   fg       布景和地面，深色模式下盖一层夜色
 *   emissive 灯泡、亮着的窗：只在深色模式合成，叠在夜色之上
 *   halo     灯、窗户、营火周围一圈圈的像素光晕：只有 Canvas 2D 画（WebGPU 下由光束和辉光代替）
 *   glow     营火火焰
 *   actors   女孩、猫：画在光晕之后（经过窗前会挡光），盖夜色
 *   over     气泡和粒子，不盖夜色
 *   hero     主角画布：始终在屏幕正中，不跟世界做亚像素平移，盖夜色
 *   front    镜头前的前景（画面两边的大树和灌木）：单独一张画布，压在卡片上面，糊得很厉害；只有 WebGPU 渲染器画
 */
export const LAYERS = ['sky', 'far', 'mid', 'near', 'back', 'fg', 'emissive', 'halo', 'glow', 'actors', 'over', 'hero', 'front'] as const;
export type LayerName = (typeof LAYERS)[number];

/**
 * 合成组：组里的层按顺序叠好以后，再整体做淡出、盖夜色，然后叠到画布上。
 * 下面这些开关里，fade / night / darkOnly 两个渲染器都认；lit / depth / bloom 是光效，只有 WebGPU 渲染器认。
 */
export interface Group {
  layers: LayerName[];
  /** 自下而上淡出（util.ts 的 FADE_STOPS） */
  fade?: boolean;
  /** 深色模式下用 source-atop 盖一层夜色：只染已有的像素，不改透明度 */
  night?: boolean;
  /** 只在深色模式下合成 */
  darkOnly?: boolean;
  /** 被点光源照亮：夜色在灯旁边变淡，染上灯的颜色 */
  lit?: boolean;
  /** 每层离对焦的主平面多远（0 = 主平面），开了景深时按这个模糊；镜头前的前景也用正数 */
  depth?: number[];
  /** 亮的部分往外泛光（辉光） */
  bloom?: boolean;
  /** 只有 WebGPU 渲染器合成（靠景深区分远近的层，Canvas 2D 下画出来会和主平面混在一起） */
  gpuOnly?: boolean;
  /** 只有 Canvas 2D 渲染器合成（WebGPU 下有更好的替代，比如像素光晕换成光束和辉光） */
  classicOnly?: boolean;
}
export type CanvasName = 'sky' | 'world' | 'hero' | 'front';
export const COMPOSE: Record<CanvasName, Group[]> = {
  sky: [{ layers: ['sky'] }],
  world: [
    { layers: ['far', 'mid', 'near'], fade: true, depth: [5, 4, 3] },
    { layers: ['back'], night: true, lit: true, depth: [2], gpuOnly: true },
    { layers: ['fg'], night: true, lit: true },
    { layers: ['emissive'], darkOnly: true, bloom: true },
    { layers: ['halo'], classicOnly: true },
    { layers: ['glow'], bloom: true },
    { layers: ['actors'], night: true, lit: true },
    { layers: ['over'] },
  ],
  hero: [{ layers: ['hero'], night: true, lit: true }],
  front: [{ layers: ['front'], night: true, lit: true, depth: [6] }],
};
/** 夜色：rgba(14, 20, 38, 0.46) */
export const NIGHT = [14, 20, 38, 0.46] as const;

/**
 * 夜里从灯里洒出来的一束光（体积光）：往 dir 方向张开，半张角的余弦是 cos（-1 = 四面八方），照 length 这么远。
 * 人物从光束里走过会挡出一道影子
 */
export interface Beam {
  dir: readonly [number, number];
  cos: number;
  length: number;
  /** 地面在哪一行（屏幕 y）：光束照到地面就停，不照进土层的剖面 */
  floor?: number;
}

/** 点光源：屏幕坐标（逻辑像素）、照多远、多亮、什么颜色，可选一束体积光 */
export interface Light {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: string;
  beam?: Beam;
}

/**
 * 一个失焦的光点（散景）：画成六边形（光圈的形状），紧跟在 layer 所在的合成组后面叠上去，
 * 于是后排的光点会被主平面挡住，前景的光点压在卡片上。坐标是逻辑像素，r 是外接圆半径。只有 WebGPU 渲染器画
 */
export interface Bokeh {
  layer: LayerName;
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
}

/** 这一帧的环境：随相机所在的群系插值，渲染器拿来调光效 */
export interface Env {
  /** 群系的地平线色调，调色时轻轻往这个颜色偏 */
  tint: string;
  /** 白天体积光的强度（0 = 没有） */
  rays: number;
}

/**
 * 一条命令 14 个 float：
 *   0 flags  1 alpha  2-5 目标 x y w h  6-9 图集里的 x y w h（纯色块时不用）  10-12 颜色 r g b（0-255）  13 留空
 * 渲染器可以把这段内存直接当实例数据上传。
 */
export const STRIDE = 14;
export const SOLID = 1; // 纯色块（不采样图集）
export const ERASE = 2; // 擦除：按这块的不透明度把已画的东西擦掉（destination-out）
export const FLIP = 4; // 水平翻转图集里那块

export interface SpriteOpts {
  alpha?: number;
  flip?: boolean;
  erase?: boolean;
  /** 只画图集块里的一部分（相对精灵左上角的 x y w h） */
  part?: readonly [number, number, number, number];
  /** 画到目标上的宽高（拉伸），默认和取的那块一样大 */
  w?: number;
  h?: number;
  /** 用精灵的发光遮罩代替本体 */
  glow?: boolean;
}

export class Commands {
  data = new Float32Array(STRIDE * 256);
  count = 0;

  push(flags: number, alpha: number, dx: number, dy: number, dw: number, dh: number, sx: number, sy: number, sw: number, sh: number, r: number, g: number, b: number) {
    if ((this.count + 1) * STRIDE > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    const d = this.data;
    const o = this.count++ * STRIDE;
    d[o] = flags;
    d[o + 1] = alpha;
    d[o + 2] = dx;
    d[o + 3] = dy;
    d[o + 4] = dw;
    d[o + 5] = dh;
    d[o + 6] = sx;
    d[o + 7] = sy;
    d[o + 8] = sw;
    d[o + 9] = sh;
    d[o + 10] = r;
    d[o + 11] = g;
    d[o + 12] = b;
  }

  clear() {
    this.count = 0;
  }
}

export class DrawList {
  readonly layers = Object.fromEntries(LAYERS.map((l) => [l, new Commands()])) as Record<LayerName, Commands>;
  readonly lights: Light[] = [];
  readonly bokeh: Bokeh[] = [];
  /** 太阳 / 月亮在天空画布上的位置（逻辑像素），体积光从这里射出 */
  sun: [number, number] = [0, 0];
  env: Env = { tint: '#ffffff', rays: 0 };
  /**
   * 每层整体再往右挪的亚像素（逻辑像素，可以是负数）。远景、后排、前景按整格画，走得比主平面慢或快，
   * 镜头快停下时会隔几帧才挪一格；渲染器合成时按这个小数偏移取样，移动就是连续的。Canvas 2D 不管它
   */
  readonly shift: Partial<Record<LayerName, number>> = {};

  clear() {
    for (const l of LAYERS) {
      this.layers[l].clear();
      delete this.shift[l];
    }
    this.lights.length = 0;
    this.bokeh.length = 0;
  }

  light(x: number, y: number, radius: number, intensity: number, color: string, beam?: Beam) {
    if (intensity > 0) this.lights.push({ x, y, radius, intensity, color, beam });
  }

  /** 画一个精灵（或它的一部分），左上角在 (x, y) */
  sprite(layer: LayerName, sp: Sprite, x: number, y: number, o: SpriteOpts = {}) {
    const r = o.glow ? sp.glow : sp.rect;
    if (!r) return;
    const [px, py, pw, ph] = o.part ?? [0, 0, r[2], r[3]];
    const flags = (o.erase ? ERASE : 0) | (o.flip ? FLIP : 0);
    this.layers[layer].push(flags, o.alpha ?? 1, x, y, o.w ?? pw, o.h ?? ph, r[0] + px, r[1] + py, pw, ph, 0, 0, 0);
  }

  /** 填一个纯色矩形 */
  rect(layer: LayerName, x: number, y: number, w: number, h: number, color: string, alpha = 1, erase = false) {
    // 和 Canvas 的 fillRect 一样：宽高是负数时往反方向画
    if (w < 0) [x, w] = [x + w, -w];
    if (h < 0) [y, h] = [y + h, -h];
    if (w === 0 || h === 0 || alpha <= 0) return;
    const [r, g, b] = rgb(color);
    this.layers[layer].push(SOLID | (erase ? ERASE : 0), alpha, x, y, w, h, 0, 0, 0, 0, r, g, b);
  }
}

/**
 * 世界的画布：天空在世界和卡片后面；世界跟着相机做亚像素平移；主角始终在屏幕正中；
 * 前景压在卡片上面（只有 WebGPU 渲染器画）
 */
export interface Canvases {
  sky: HTMLCanvasElement;
  world: HTMLCanvasElement;
  hero: HTMLCanvasElement;
  front: HTMLCanvasElement;
}

/** 一块毛玻璃：在世界画布上的位置（画布像素）、圆角、不透明度（卡片淡入淡出时跟着变） */
export interface GlassRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  alpha: number;
}

/** 页面 UI 传给渲染器的东西（见 ui-bridge.ts）：哪些地方要画毛玻璃、镜头对焦拉近了多少（0..1） */
export interface View {
  glass: GlassRect[];
  focus: number;
}

/** 渲染器的统一接口：world.ts 每帧交给它一份清单 */
export interface Renderer {
  /**
   * 画布的逻辑尺寸变了（resize）。S 是一个逻辑像素占几个 CSS 像素：画布的 CSS 尺寸由 world.ts 定，
   * 实际分辨率由渲染器自己定（Canvas 2D 按逻辑像素画再放大；WebGPU 的世界画布按屏幕像素画，模糊和泛光才是平滑的）
   */
  resize(W: number, H: number, S: number): void;
  draw(dl: DrawList, dark: boolean, view: View): void;
  /**
   * 有没有景深。有景深时远近靠模糊区分，远景不再往雾色靠（sim/terrain.ts 的 haze）；
   * 没有（Canvas 2D）时远景照旧雾化，不然几层叠在一起分不清
   */
  readonly depthOfField: boolean;
}
