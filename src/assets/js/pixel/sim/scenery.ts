/**
 * 场景精灵：树、灌木、石头、小屋……源图在 src/art/scenery/，构建时打包进图集（见 atlas.ts）。
 *
 * 画风：现代独立游戏的像素插画——有机的形状、统一的左上光源、每个形状 4 档明暗、
 * 档位之间用噪声打散成像素簇、描边用相邻颜色压暗（不用纯黑）。改素材直接改 src/art/ 下对应的 PNG。
 */
import { sprite, sprites, type Sprite } from '../atlas.js';

export type { Sprite };

/** 小屋上会发光 / 冒烟 / 可交互的位置（相对精灵左上角），world.ts 和 eggs.ts 用来画光晕、开门和判定点击 */
export const COTTAGE = {
  window: [13, 30],
  lantern: [37, 31],
  chimney: [31, 0],
  /** 门洞（x, y, w, h）、门洞顶上几行的拱形内收（每行左右各缩几格）、门里透出的暖光、门的点击区域（x0, y0, x1, y1）、门口中心的 x */
  door: [24, 28, 9, 12],
  doorArch: [2, 1],
  doorLight: [25, 31, 7, 8],
  doorHit: [21, 25, 36, 41],
  doorCenter: 28.5,
} as const;
/** 路灯灯泡、营火火焰的中心（相对精灵左上角） */
export const LAMP_BULB = [4, 5] as const;
export const CAMPFIRE_FLAME = [7, 2] as const;

/**
 * 会发光的布景，光从哪里出来（相对精灵左上角）：灯泡、火焰、纸窗、南瓜刻出来的脸……
 * 小屋的窗户和门口的灯另算（见 COTTAGE）。新加一种发光的布景，在这里写上位置、在 biomes.ts 里给它 glow 就行
 */
export const GLOW_AT: Partial<Record<keyof Scenery, readonly [number, number]>> = {
  lamp: LAMP_BULB,
  campfire: CAMPFIRE_FLAME,
};

export interface Scenery {
  oak: Sprite[];
  forest: Sprite[];
  blossom: Sprite[];
  pine: Sprite[];
  bush: Sprite[];
  blossomBush: Sprite[];
  rock: Sprite[];
  sandRock: Sprite[];
  snowRock: Sprite[];
  cactus: Sprite[];
  tuft: Sprite[];
  dryTuft: Sprite[];
  flowers: Sprite[];
  cottage: Sprite;
  fence: Sprite;
  lamp: Sprite;
  sign: Sprite;
  campfire: Sprite;
  hay: Sprite;
  autumn: Sprite[];
  autumnBush: Sprite[];
  mushroom: Sprite[];
  stump: Sprite[];
  log: Sprite[];
  berryBush: Sprite[];
  pebbles: Sprite[];
  fern: Sprite[];
  reeds: Sprite[];
  pumpkin: Sprite[];
  snowPile: Sprite[];
  leafPile: Sprite[];
  /** 风滚草滚动的 4 帧（每帧转 90 度），由 tumbleweed.ts 画 */
  tumbleweed: Sprite[];
}

const SETS = ['oak', 'forest', 'blossom', 'pine', 'bush', 'blossomBush', 'rock', 'sandRock', 'snowRock', 'cactus', 'tuft', 'dryTuft', 'flowers', 'autumn', 'autumnBush', 'mushroom', 'stump', 'log', 'berryBush',
  'pebbles', 'fern', 'reeds', 'pumpkin', 'snowPile', 'leafPile', 'tumbleweed'] as const;
const SINGLES = ['cottage', 'fence', 'lamp', 'sign', 'campfire', 'hay'] as const;

export function buildScenery(): Scenery {
  const sc = {} as Record<string, Sprite | Sprite[]>;
  for (const k of SETS) sc[k] = sprites(`scenery.${k}`);
  for (const k of SINGLES) sc[k] = sprite(`scenery.${k}`);
  return sc as unknown as Scenery;
}
