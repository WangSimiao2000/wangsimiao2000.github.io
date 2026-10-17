/**
 * 像素世界用到的纯函数：数值、缓动、颜色、噪声。不碰 DOM，可以直接在 Node 里单测。
 */
import { hash } from './sprites.js';

export type RGB = [number, number, number];

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** smoothstep：x 在 [a,b] 之间平滑地从 0 到 1 */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 三次缓入缓出，和浏览器平滑滚动的手感接近 */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 解析 #rgb / #rrggbb / rgb(...)；解析不了时退回浅色底 */
export function parseColor(s: string): RGB {
  s = s.trim();
  if (s.startsWith('#')) {
    const hex = s.length === 4 ? s.slice(1).replace(/./g, (c) => c + c) : s.slice(1);
    const n = parseInt(hex, 16);
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [238, 241, 245];
}

const rgbCache = new Map<string, RGB>();
export function rgb(c: string): RGB {
  let v = rgbCache.get(c);
  if (!v) rgbCache.set(c, (v = parseColor(c)));
  return v;
}
export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
export function mix(a: string, b: string, t: number): string {
  return css(mixRGB(rgb(a), rgb(b), t));
}

/** 1D value noise，范围 [-1,1]，对同一个 x 永远返回同一个值 */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}
