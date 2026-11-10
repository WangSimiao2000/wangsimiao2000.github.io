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
 *   far      远山、丘陵、近景树线，合成时自下而上淡出
 *   fg       布景和地面，深色模式下盖一层夜色
 *   emissive 灯泡、亮着的窗：只在深色模式合成，叠在夜色之上
 *   glow     光晕和营火火焰
 *   actors   女孩、猫：画在光晕之后（经过窗前会挡光），盖夜色
 *   over     气泡和粒子，不盖夜色
 *   hero     主角画布：始终在屏幕正中，不跟世界做亚像素平移，盖夜色
 */
export const LAYERS = ['sky', 'far', 'fg', 'emissive', 'glow', 'actors', 'over', 'hero'] as const;
export type LayerName = (typeof LAYERS)[number];

/** 三张画布，以及每张画布由哪些层、按什么规则合成 */
export interface LayerRule {
  layer: LayerName;
  /** 合成时按画布高度自下而上淡出（util.ts 的 FADE_STOPS） */
  fade?: boolean;
  /** 深色模式下用 source-atop 盖一层夜色：只染已有的像素，不改透明度 */
  night?: boolean;
  /** 只在深色模式下合成 */
  darkOnly?: boolean;
}
export const COMPOSE: Record<'sky' | 'world' | 'hero', LayerRule[]> = {
  sky: [{ layer: 'sky' }],
  world: [
    { layer: 'far', fade: true },
    { layer: 'fg', night: true },
    { layer: 'emissive', darkOnly: true },
    { layer: 'glow' },
    { layer: 'actors', night: true },
    { layer: 'over' },
  ],
  hero: [{ layer: 'hero', night: true }],
};
/** 夜色：rgba(14, 20, 38, 0.46) */
export const NIGHT = [14, 20, 38, 0.46] as const;

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

  clear() {
    for (const l of LAYERS) this.layers[l].clear();
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

/** 世界的三张画布：天空在世界和卡片后面；世界跟着相机做亚像素平移；主角始终在屏幕正中 */
export interface Canvases {
  sky: HTMLCanvasElement;
  world: HTMLCanvasElement;
  hero: HTMLCanvasElement;
}

/** 渲染器的统一接口：world.ts 每帧交给它一份清单 */
export interface Renderer {
  /** 三张画布的逻辑尺寸变了（resize） */
  resize(W: number, H: number): void;
  draw(dl: DrawList, dark: boolean): void;
}
