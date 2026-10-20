/**
 * 图集：所有固定的像素精灵拼在一张 atlas.png 上。源图是 src/art/ 下每个精灵一张 PNG，
 * 构建时由 build/atlas.mjs 打包，同时生成坐标表 atlas-map.ts（生成文件，不进 git）。
 *
 * sprite(name) 立刻返回一张尺寸正确的小 canvas，图集加载好后再把像素画进去：
 * 用到精灵的代码不用关心加载时机（还没加载完的那几帧只是画了空白），世界也不用等它才开始跑。
 * 「名字#glow」存在时挂到 .emissive 上，供夜里的自发光层用。
 */
import { ATLAS } from './atlas-map.js';

export type Sprite = HTMLCanvasElement & { emissive?: HTMLCanvasElement };

/** 图集地址：和脚本同在带版本号的资源目录里，内容一变地址就变 */
export const ATLAS_URL = new URL('../../img/atlas.png', import.meta.url).href;

const pending: [HTMLCanvasElement, readonly [number, number, number, number]][] = [];
let image: HTMLImageElement | null = null;
let img: HTMLImageElement | null = null;

/** 第一次要精灵时才开始加载（单元测试在 Node 里引入这些模块时不会碰到 Image） */
function load(): HTMLImageElement {
  if (img) return img;
  const el = new Image();
  el.decoding = 'async';
  el.onload = () => {
    image = el;
    for (const [c, r] of pending.splice(0)) paint(c, r);
  };
  el.onerror = () => console.error('[atlas] 图集加载失败', ATLAS_URL);
  el.src = ATLAS_URL;
  return (img = el);
}

function paint(c: HTMLCanvasElement, [x, y, w, h]: readonly [number, number, number, number]) {
  c.getContext('2d')!.drawImage(image!, x, y, w, h, 0, 0, w, h);
}

function cut(r: readonly [number, number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = r[2];
  c.height = r[3];
  if (image) paint(c, r);
  else {
    load();
    pending.push([c, r]);
  }
  return c;
}

const cache = new Map<string, Sprite>();

/** 按名字取一个精灵；名字不在坐标表里直接报错（src/art/ 里没有对应的图） */
export function sprite(name: string): Sprite {
  let s = cache.get(name);
  if (s) return s;
  const r = ATLAS[name];
  if (!r) throw new Error(`图集里没有精灵：${name}`);
  s = cut(r) as Sprite;
  const glow = ATLAS[`${name}#glow`];
  if (glow) s.emissive = cut(glow);
  cache.set(name, s);
  return s;
}

/** 一组编号连续的精灵：prefix.0、prefix.1……直到坐标表里没有为止 */
export function sprites(prefix: string): Sprite[] {
  const out: Sprite[] = [];
  for (let i = 0; ATLAS[`${prefix}.${i}`]; i++) out.push(sprite(`${prefix}.${i}`));
  return out;
}

/** 图集加载完成（给需要「画好之后再做事」的地方用，比如测试截图） */
export const atlasReady = () =>
  image ? Promise.resolve() : new Promise<void>((ok) => load().addEventListener('load', () => ok(), { once: true }));
