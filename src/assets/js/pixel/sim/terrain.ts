/**
 * 地形：远景三层（远山、中景丘陵、近景树线）和前景地面，逐列写进绘制清单。
 * 远景三层各进 far / mid / near 层（合成时一起自下而上淡出）；地面进 fg 层（深色模式下会盖夜色）。
 */
import { hash } from './sprites.js';
import { BIOMES, GROUND, biomeNum, heightAt, layerColor, onPath, paletteAt, weights, type Layer } from './biomes.js';
import { noise1 } from './util.js';
import type { Frame } from './frame.js';

function treelineAt(lx: number, wx: number, freq: number, size: number): number {
  const amt = biomeNum(wx, (b) => b.treeline);
  if (amt < 0.02) return 0;
  const spiky = biomeNum(wx, (b) => (b.spiky ? 1 : 0));
  // 圆冠：一串高低错落的半圆；尖冠：锯齿
  const u = lx * freq;
  const cell = Math.floor(u);
  const fr = u - cell;
  const hgt = 0.55 + hash(cell * 1.9 + size) * 0.45;
  const round = Math.sqrt(Math.max(0, 1 - (fr * 2 - 1) ** 2)) * hgt;
  const tri = (1 - Math.abs(fr * 2 - 1)) * hgt * 1.4;
  const present = hash(cell * 4.3 + size) < amt ? 1 : 0.15;
  return (round * (1 - spiky) + tri * spiky) * size * present * Math.min(1, amt * 1.6);
}

/** 远景一层：factor 是视差系数（远近的空气透视由渲染器按层的深度做） */
export function drawLayer(fr: Frame, which: Layer, factor: number) {
  const { dl, W, H } = fr;
  const base = H - GROUND;
  const exact = fr.camX * factor - fr.frac - Math.floor(fr.HALF);
  const off = Math.round(exact);
  dl.shift[which] = off - exact; // 按整格画，剩下的小数交给渲染器（见 DrawList.shift）
  for (let x = 0; x < W; x++) {
    const lx = off + x;
    const wx = fr.camLeft + x;
    let h: number;
    if (which === 'far') {
      const ridge = 1 - Math.abs(noise1(lx * 0.0075 + 3));
      h = 26 + ridge * ridge * 46 + noise1(lx * 0.033) * 5;
    } else if (which === 'mid') {
      h = 14 + (noise1(lx * 0.013 + 20) * 0.5 + 0.5) * 18 + treelineAt(lx, wx, 0.11, 6);
    } else {
      h = 4 + (noise1(lx * 0.021 + 60) * 0.5 + 0.5) * 12 + treelineAt(lx, wx, 0.075, 10);
    }
    const y = Math.round(base - h);
    const [body, lit] = layerColor(wx, which, fr.dark);
    dl.rect(which, x, y, 1, H - y, body);
    dl.rect(which, x, y, 1, 1, lit);
  }
}

let heights = new Float32Array(0);
let tops = new Int32Array(0); // 每列地面最高的像素（含草尖），用来算描边

/** 这一列冒出的草尖高度（0~2 像素） */
function bladeAt(wx: number): number {
  if (onPath(wx)) return 0;
  const br = hash(wx * 1.31 + 2);
  if (br >= 0.42 * biomeNum(wx, (b) => (b.blades ? 1 : 0))) return 0;
  return br < 0.06 ? 2 : 1;
}

/**
 * 前景地面：表层、三道土层、石子、草尖，逐列绘制。
 * 地表轮廓（含草尖和坡面的竖边）描一圈内描边，和素材的描边一样：最外一圈像素换成深色，轮廓不变，
 * 受光线挪到描边下面一格。
 */
export function drawGround(fr: Frame) {
  const { dl, W, H, camLeft } = fr;
  const fill = (x: number, y: number, w: number, h: number, c: string) => dl.rect('fg', x, y, w, h, c);
  if (heights.length < W + 2) {
    heights = new Float32Array(W + 2);
    tops = new Int32Array(W + 2);
  }
  for (let x = -1; x <= W; x++) {
    heights[x + 1] = Math.round(heightAt(camLeft + x));
    tops[x + 1] = H - heights[x + 1] - bladeAt(camLeft + x);
  }
  for (let x = 0; x < W; x++) {
    const wx = camLeft + x;
    const pal = paletteAt(wx);
    const hgt = heights[x + 1];
    const sy = H - hgt;
    const path = onPath(wx);
    // 坡面：左高右低的一侧更亮（光从左上来）
    const slope = heights[x] - heights[x + 2];
    const rim = path ? pal.path[0] : slope < 0 ? pal.rim : slope > 0 ? pal.top : pal.rim;
    const top = path ? pal.path[1] : pal.top;
    const shade = path ? pal.path[2] : pal.shade;
    // 表层厚度起伏，底部一行抖动过渡到土层
    const band = 4 + Math.round((noise1(wx * 0.07) * 0.5 + 0.5) * 2);
    fill(x, sy, 1, band, top);
    fill(x, sy + band - 1, 1, 1, shade);
    if (hash(wx * 0.53 + 1) < 0.3) fill(x, sy + band, 1, 1, shade);

    // 土层：三道地层，交界随噪声起伏，边上零星散几个像素
    const d1 = sy + band + 1;
    const s1 = Math.round(sy + 11 + noise1(wx * 0.05 + 11) * 2);
    const s2 = Math.round(sy + 21 + noise1(wx * 0.04 + 77) * 3);
    fill(x, d1, 1, Math.max(0, s1 - d1), pal.soil[0]);
    fill(x, s1, 1, Math.max(0, s2 - s1), pal.soil[1]);
    if (hash(wx * 0.61 + 2) < 0.22) fill(x, s1 - 1, 1, 1, pal.soil[1]);
    fill(x, s2, 1, H - s2, pal.soil[2]);
    if (hash(wx * 0.67 + 3) < 0.22) fill(x, s2 - 1, 1, 1, pal.soil[2]);

    // 嵌在土里的小石子
    if (hash(wx * 0.731 + 5) < 0.05) {
      const py = sy + 9 + Math.floor(hash(wx * 1.9) * 24);
      if (py < H - 1) {
        fill(x, py, 2, 1, pal.soil[0]);
        fill(x, py + 1, 2, 1, pal.soil[2]);
      }
    }

    // 描边：这一列最上面的像素，加上比左右邻居高出来的那段竖边（四邻接里挨着空气的像素）
    const t = tops[x + 1];
    const lineEnd = Math.max(t, tops[x] - 1, tops[x + 2] - 1);
    fill(x, t, 1, lineEnd - t + 1, path ? pal.path[3] : pal.line);
    // 受光线：描边下面那一格（草尖整根都是描边，受光线还在地表那一行的下面）
    const rimY = Math.max(lineEnd + 1, sy);
    if (rimY < sy + band - 1) {
      fill(x, rimY, 1, 1, rim);
    }
    // 雪地上零星的亮点，压在描边上
    if (!path && t === sy && BIOMES[weights(wx)[0]].sparkle && hash(wx * 1.31 + 2) < 0.12) {
      fill(x, sy - 1, 1, 1, pal.rim);
    }
  }
}
