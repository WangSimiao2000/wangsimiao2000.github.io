/**
 * 镜头光斑：太阳 / 月亮照进镜头，在镜片间反射出一串六边形（光圈的形状）的光斑。
 * 光斑排在「太阳 -> 画面中心」这条线上，并越过中心到另一边，所以太阳在哪、光斑就朝哪个方向排开；
 * 颜色跟着光源走（daytime.ts 的 light：正午淡黄、日落橘红、月光冷白），每个光斑再往不同色相偏一点，像镜片镀膜反出来的颜色。
 * 太阳随镜头视差慢慢挪动时，光斑跟着在画面上滑动。
 * 画在 over 层后面（世界画布最上面、卡片下面），透过毛玻璃也能隐约看到。
 */
import { mixRGB, rgb, css } from './util.js';
import type { Frame } from './frame.js';

/** 每个光斑：在线上的位置（0 = 光源，1 = 画面中心）、半径（逻辑像素）、相对亮度、往哪个颜色偏、偏多少 */
const GHOSTS: readonly (readonly [number, number, number, string, number])[] = [
  [0.45, 2.5, 0.9, '#ffffff', 0.2],
  [0.8, 5, 0.55, '#ffb070', 0.35],
  [1.2, 3, 0.8, '#b8ff9a', 0.3],
  [1.45, 9, 0.35, '#8fc4ff', 0.35],
  [1.8, 4, 0.6, '#ffffff', 0.1],
  [2.15, 13, 0.25, '#c9a0ff', 0.3],
];
const ALPHA = { day: 0.2, night: 0.12 };

export function drawBokeh(fr: Frame) {
  const { dl, H } = fr;
  const vis = Math.min(H, fr.visH);
  // 镜头光斑长在镜头上：全用屏幕坐标（光源 = 日月在屏幕上的真实位置，含天空视差的小数；中心 = 屏幕中心）
  const sx = dl.sun[0] + (dl.shift.sky ?? 0);
  const sy = dl.sun[1];
  const cx = fr.HALF;
  const cy = H - vis / 2;
  const alpha = fr.dark ? ALPHA.night : ALPHA.day;
  const base = rgb(dl.env.light);
  for (const [t, r, k, tint, mix] of GHOSTS) {
    dl.bokeh.push({
      layer: 'over',
      x: sx + (cx - sx) * t,
      y: sy + (cy - sy) * t,
      r,
      color: css(mixRGB(base, rgb(tint), mix)),
      alpha: alpha * k,
      screen: true,
    });
  }
}
