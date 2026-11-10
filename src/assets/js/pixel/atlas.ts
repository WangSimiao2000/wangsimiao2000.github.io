/**
 * 图集：所有固定的像素精灵拼在一张 atlas.png 上。源图是 src/art/ 下每个精灵一张 PNG，
 * 构建时由 build/atlas.mjs 打包，同时生成坐标表 atlas-map.ts（生成文件，不进 git）。
 *
 * 精灵只是图集里的一块坐标（加上可选的发光遮罩「名字#glow」），不含像素：
 * sim/ 拿它算尺寸、往绘制清单里写，图片本身由渲染器加载（见 ATLAS_URL）。所以 sim/ 可以直接在 Node 里跑。
 */
import { ATLAS } from './atlas-map.js';

export type Rect = readonly [number, number, number, number];

export interface Sprite {
  name: string;
  width: number;
  height: number;
  /** 在图集里的 x y w h */
  rect: Rect;
  /** 发光遮罩在图集里的 x y w h（夜里亮着的窗格、灯泡） */
  glow?: Rect;
}

/** 图集地址：和脚本同在带版本号的资源目录里，内容一变地址就变 */
export const ATLAS_URL = new URL('../../img/atlas.png', import.meta.url).href;

const cache = new Map<string, Sprite>();

/** 按名字取一个精灵；名字不在坐标表里直接报错（src/art/ 里没有对应的图） */
export function sprite(name: string): Sprite {
  let s = cache.get(name);
  if (s) return s;
  const r = ATLAS[name];
  if (!r) throw new Error(`图集里没有精灵：${name}`);
  s = { name, width: r[2], height: r[3], rect: r, glow: ATLAS[`${name}#glow`] };
  cache.set(name, s);
  return s;
}

/** 一组编号连续的精灵：prefix.0、prefix.1……直到坐标表里没有为止 */
export function sprites(prefix: string): Sprite[] {
  const out: Sprite[] = [];
  for (let i = 0; ATLAS[`${prefix}.${i}`]; i++) out.push(sprite(`${prefix}.${i}`));
  return out;
}

/** 加载图集图片（渲染器用） */
export function loadAtlas(): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => {
    const el = new Image();
    el.decoding = 'async';
    el.onload = () => ok(el);
    el.onerror = () => bad(new Error(`图集加载失败：${ATLAS_URL}`));
    el.src = ATLAS_URL;
  });
}
