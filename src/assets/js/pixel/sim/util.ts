/**
 * 像素世界用到的纯函数：数值、缓动、颜色、噪声。不碰 DOM，可以直接在 Node 里单测。
 */
import { hash } from './sprites.js';

export type RGB = [number, number, number];

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * 远景自下而上淡出的不透明度（t = 画布高度里的位置，0 顶 1 底）：上面 38% 全透明、82% 以下不透明。
 * 只用在远山、丘陵、近景树线和飘在半空的粒子上；树、小屋、角色这些前景不淡。
 */
export const FADE_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0.38, 0],
  [0.52, 0.12],
  [0.66, 0.55],
  [0.82, 1],
];
export function fadeAt(t: number): number {
  const s = FADE_STOPS;
  if (t <= s[0][0]) return s[0][1];
  for (let i = 1; i < s.length; i++) {
    if (t <= s[i][0]) {
      const [t0, a0] = s[i - 1];
      const [t1, a1] = s[i];
      return a0 + ((t - t0) / (t1 - t0)) * (a1 - a0);
    }
  }
  return s[s.length - 1][1];
}

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
