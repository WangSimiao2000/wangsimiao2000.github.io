/**
 * 地形绘制：远景三层（远山、中景丘陵、近景树线）和前景地面。
 * 远景直接画到主画布；地面画到前景层（深色模式下会盖夜色）。
 */
import { hash } from './sprites.js';
import { BIOMES, GROUND, biomeNum, heightAt, layerColor, onPath, paletteAt, weights, type Layer } from './biomes.js';
import { noise1, FADE_STOPS } from './util.js';
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

/** 远景一层：factor 是视差系数，haze 是向雾色靠拢的程度 */
export function drawLayer(fr: Frame, which: Layer, factor: number, haze: number) {
  const { g, W, H } = fr;
  const base = H - GROUND;
  const off = Math.round(fr.camX * factor - fr.frac) - Math.floor(fr.HALF);
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
    const [body, lit] = layerColor(wx, which, haze, fr.dark, fr.bg);
    g.fillStyle = body;
    g.fillRect(x, y, 1, H - y);
    g.fillStyle = lit;
    g.fillRect(x, y, 1, 1);
  }
}

let heights = new Float32Array(0);

/**
 * 远景三层画完后整体自下而上淡出（只作用于这时主画布上已有的远景），树梢、小屋这些前景之后才画，不受影响。
 * 渐变按逻辑像素算，放大后每行一档，和像素风一致。
 */
let fadeGrad: CanvasGradient | null = null;
let fadeH = 0;
let fadeCtx: CanvasRenderingContext2D | null = null;
export function fadeFar(g: CanvasRenderingContext2D, W: number, H: number) {
  if (!fadeGrad || fadeH !== H || fadeCtx !== g) {
    fadeGrad = g.createLinearGradient(0, 0, 0, H);
    for (const [t, a] of FADE_STOPS) fadeGrad.addColorStop(t, `rgba(0,0,0,${a})`);
    fadeH = H;
    fadeCtx = g;
  }
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = fadeGrad;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

/** 前景地面：表层、三道土层、石子、草尖，逐列绘制 */
export function drawGround(fr: Frame) {
  const { f, W, H, camLeft } = fr;
  if (heights.length < W + 2) heights = new Float32Array(W + 2);
  for (let x = -1; x <= W; x++) heights[x + 1] = Math.round(heightAt(camLeft + x));
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
    f.fillStyle = top;
    f.fillRect(x, sy, 1, band);
    f.fillStyle = shade;
    f.fillRect(x, sy + band - 1, 1, 1);
    if (hash(wx * 0.53 + 1) < 0.3) f.fillRect(x, sy + band, 1, 1);
    f.fillStyle = rim;
    f.fillRect(x, sy, 1, 1);

    // 土层：三道地层，交界随噪声起伏，边上零星散几个像素
    const d1 = sy + band + 1;
    const s1 = Math.round(sy + 11 + noise1(wx * 0.05 + 11) * 2);
    const s2 = Math.round(sy + 21 + noise1(wx * 0.04 + 77) * 3);
    f.fillStyle = pal.soil[0];
    f.fillRect(x, d1, 1, Math.max(0, s1 - d1));
    f.fillStyle = pal.soil[1];
    f.fillRect(x, s1, 1, Math.max(0, s2 - s1));
    if (hash(wx * 0.61 + 2) < 0.22) f.fillRect(x, s1 - 1, 1, 1);
    f.fillStyle = pal.soil[2];
    f.fillRect(x, s2, 1, H - s2);
    if (hash(wx * 0.67 + 3) < 0.22) f.fillRect(x, s2 - 1, 1, 1);

    // 嵌在土里的小石子
    if (hash(wx * 0.731 + 5) < 0.05) {
      const py = sy + 9 + Math.floor(hash(wx * 1.9) * 24);
      if (py < H - 1) {
        f.fillStyle = pal.soil[0];
        f.fillRect(x, py, 2, 1);
        f.fillStyle = pal.soil[2];
        f.fillRect(x, py + 1, 2, 1);
      }
    }
    // 草尖：地表冒出的零星像素，轮廓不再是一条硬线；雪地上换成零星亮点
    if (!path) {
      const br = hash(wx * 1.31 + 2);
      const bladeOK = biomeNum(wx, (b) => (b.blades ? 1 : 0));
      if (br < 0.42 * bladeOK) {
        f.fillStyle = br < 0.14 ? pal.rim : pal.top;
        f.fillRect(x, sy - 1, 1, 1);
        if (br < 0.06) f.fillRect(x, sy - 2, 1, 1);
      } else if (BIOMES[weights(wx)[0]].sparkle && br < 0.12) {
        f.fillStyle = pal.rim;
        f.fillRect(x, sy - 1, 1, 1);
      }
    }
  }
}
