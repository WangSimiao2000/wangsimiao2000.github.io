/**
 * 场景精灵：树、灌木、石头、小屋……全部在运行时程序化生成到离屏 canvas。
 *
 * 风格取向是现代独立游戏的像素插画，而不是方块：
 * - 形状是有机的（圆的并集、锥形分层），不贴网格；
 * - 统一光源在左上，每个形状按法线分 4 档明暗，档位之间用哈希噪声打散成像素簇；
 * - 不描黑边，轮廓靠最暗一档和背景对比出来。
 */
import { hash } from './sprites.js';

export type Sprite = HTMLCanvasElement;
type Put = (x: number, y: number, color: string) => void;

function make(w: number, h: number, draw: (put: Put, g: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const put: Put = (x, y, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, 1, 1);
  };
  draw(put, g);
  return c;
}

/** 4 档色：高光 / 亮面 / 暗面 / 最暗 */
type Ramp = [string, string, string, string];

const LIGHT = [-0.55, -0.83]; // 左上方光源

function tone(ramp: Ramp, v: number): string {
  if (v > 0.42) return ramp[0];
  if (v > -0.05) return ramp[1];
  if (v > -0.55) return ramp[2];
  return ramp[3];
}

interface Circle {
  x: number;
  y: number;
  r: number;
}

/** 按圆的并集绘制一团体积（树冠、灌木），像素级明暗 */
function blob(put: Put, circles: Circle[], ramp: Ramp, seed: number, w: number, h: number, darkBottom = 0.35) {
  const top = Math.min(...circles.map((c) => c.y - c.r));
  const bottom = Math.max(...circles.map((c) => c.y + c.r));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = 0;
      let bc: Circle | null = null;
      for (const c of circles) {
        const d = c.r - Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
        if (d > best) {
          best = d;
          bc = c;
        }
      }
      if (!bc) continue;
      const dx = x + 0.5 - bc.x;
      const dy = y + 0.5 - bc.y;
      const len = Math.hypot(dx, dy) || 1;
      // 球面法线：越靠圆心越朝外（z），边缘越朝侧面
      const k = len / bc.r;
      let v = (dx / len) * LIGHT[0] * k + (dy / len) * LIGHT[1] * k + 0.15;
      v -= ((y - top) / Math.max(1, bottom - top)) * darkBottom; // 整体下暗
      v += (hash(seed + x * 17.3 + y * 31.1) - 0.5) * 0.38; // 打散成像素簇
      put(x, y, tone(ramp, v));
    }
  }
}

/* ---------------- 树 ---------------- */

export interface TreeStyle {
  leaves: Ramp;
  trunk: [string, string, string];
  /** 冠上零星的点缀色（花、果） */
  dots?: string[];
}

function broadleaf(seed: number, size: number, style: TreeStyle): Sprite {
  const r0 = size * 0.62;
  const w = Math.ceil(size * 2.4) + 4;
  const cx = w / 2;
  const cy = r0 + 3;
  const trunkH = Math.round(size * 0.9) + 4;
  const h = Math.ceil(cy + r0 * 0.7 + trunkH);
  const circles: Circle[] = [{ x: cx, y: cy + r0 * 0.15, r: r0 }];
  const n = 4 + Math.floor(hash(seed) * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(seed + i) * 0.8;
    const d = r0 * (0.55 + hash(seed + i * 3.1) * 0.25);
    circles.push({
      x: cx + Math.cos(a) * d * 1.15,
      y: cy + r0 * 0.15 + Math.sin(a) * d * 0.7,
      r: r0 * (0.42 + hash(seed + i * 7.7) * 0.18),
    });
  }
  return make(w, h, (put) => {
    // 树干：左亮右暗，根部外扩
    const tw = size > 9 ? 4 : 3;
    const tx = Math.round(cx - tw / 2);
    const ty = Math.round(cy);
    for (let y = ty; y < h; y++) {
      const flare = y >= h - 2 ? 1 : 0;
      for (let x = tx - flare; x < tx + tw + flare; x++) {
        const col = x <= tx ? style.trunk[0] : x >= tx + tw - 1 ? style.trunk[2] : style.trunk[1];
        put(x, y, y < ty + r0 * 0.9 ? style.trunk[2] : col);
      }
    }
    // 一根斜枝
    const side = hash(seed + 9) < 0.5 ? -1 : 1;
    for (let i = 0; i < 3; i++) put(Math.round(cx + side * (2 + i)), Math.round(cy + r0 * 0.6 - i), style.trunk[1]);
    blob(put, circles, style.leaves, seed, w, h);
    if (style.dots) {
      for (let i = 0; i < size * 1.2; i++) {
        const c = circles[Math.floor(hash(seed + i * 5.3) * circles.length)];
        const a = hash(seed + i * 2.9) * Math.PI * 2;
        const d = hash(seed + i * 8.1) * c.r * 0.85;
        put(Math.round(c.x + Math.cos(a) * d), Math.round(c.y + Math.sin(a) * d), style.dots[i % style.dots.length]);
      }
    }
  });
}

function pine(seed: number, size: number, leaves: Ramp, snow: [string, string] | null): Sprite {
  const w = size * 2 + 3;
  const h = Math.round(size * 3.1) + 5;
  const cx = Math.floor(w / 2);
  const tiers = 4;
  const crownH = h - 5;
  return make(w, h, (put) => {
    for (let y = crownH - 3; y < h; y++) {
      put(cx - 1, y, '#5b4030');
      put(cx, y, '#3f2c22');
    }
    const tierH = crownH / tiers;
    for (let t = 0; t < tiers; t++) {
      const y0 = Math.round(t * tierH * 0.82);
      const y1 = Math.round(y0 + tierH * 1.35);
      const maxHalf = ((t + 1) / tiers) * size;
      for (let y = y0; y < Math.min(y1, crownH); y++) {
        const u = (y - y0) / (y1 - y0);
        const jag = hash(seed + y * 3.7 + t) < 0.35 ? -1 : 0;
        const half = Math.max(0, Math.round(maxHalf * (0.25 + u * 0.75)) + jag);
        for (let x = cx - half; x <= cx + half; x++) {
          const side = (x - cx) / Math.max(1, half); // -1 左（亮）..1 右（暗）
          const v = -side * 0.65 + 0.15 - u * 0.5 + (hash(seed + x * 13.1 + y * 7.3) - 0.5) * 0.35;
          let col = tone(leaves, v);
          if (snow) {
            // 每层斜面上沿积雪，左侧受光
            const edge = Math.abs(x - cx) >= half - 1 && u < 0.85;
            const cap = u < 0.22 && hash(seed + x * 5 + y) < 0.8;
            if ((edge && hash(seed + x + y * 9.1) < 0.55) || cap) col = side < 0.2 ? snow[0] : snow[1];
          }
          put(x, y, col);
        }
      }
    }
  });
}

function bush(seed: number, size: number, ramp: Ramp, dots?: string[]): Sprite {
  const w = size * 2 + 2;
  const h = Math.round(size * 1.3) + 1;
  const circles: Circle[] = [
    { x: w / 2, y: h - size * 0.55, r: size * 0.75 },
    { x: w / 2 - size * 0.55, y: h - size * 0.35, r: size * 0.5 },
    { x: w / 2 + size * 0.6, y: h - size * 0.3, r: size * 0.48 },
  ];
  return make(w, h, (put) => {
    blob(put, circles, ramp, seed, w, h, 0.25);
    if (dots) for (let i = 0; i < size; i++) put(Math.floor(hash(seed + i * 3.3) * w), Math.floor(hash(seed + i * 9.1) * (h - 2)), dots[i % dots.length]);
  });
}

function rock(seed: number, w: number, h: number, ramp: Ramp, snowCap?: string): Sprite {
  const circles: Circle[] = [
    { x: w * 0.45, y: h, r: h * 0.95 },
    { x: w * 0.72, y: h + 1, r: h * 0.7 },
  ];
  return make(w, h, (put) => {
    blob(put, circles, ramp, seed, w, h, 0.2);
    if (snowCap) for (let x = 2; x < w - 2; x++) if (hash(seed + x) < 0.7) put(x, Math.max(0, Math.round(h - Math.sqrt(Math.max(0, (h * 0.95) ** 2 - (x - w * 0.45) ** 2)))), snowCap);
  });
}

function cactus(seed: number, height: number): Sprite {
  const ramp: Ramp = ['#a9cf7a', '#7fb35c', '#5c8f45', '#3f6b34'];
  const w = 13;
  return make(w, height, (put) => {
    const col = (x0: number, x1: number, y0: number, y1: number) => {
      const half = (x1 - x0) / 2;
      const mid = (x0 + x1) / 2;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dx = (x + 0.5 - mid) / half;
          // 圆顶
          if (y - y0 < half && Math.hypot(dx, (y - y0 - half + 0.5) / half) > 1) continue;
          const v = -dx * 0.75 + 0.1 + (hash(seed + x * 7 + y * 3) - 0.5) * 0.2;
          put(x, y, tone(ramp, v));
        }
      }
    };
    const armY = Math.round(height * 0.38);
    col(0, 3, armY - 5, armY + 2);
    for (let x = 1; x < 5; x++) put(x, armY + 1, x < 3 ? ramp[1] : ramp[2]);
    col(10, 13, armY - 1, armY + 5);
    for (let x = 8; x < 12; x++) put(x, armY + 4, ramp[2]);
    col(4, 9, 0, height);
    // 竖棱与刺
    for (let y = 3; y < height; y += 3) {
      put(5, y, ramp[0]);
      put(8, y + 1, ramp[3]);
    }
  });
}

function tuft(seed: number, colors: [string, string], tall = 4): Sprite {
  return make(7, tall + 1, (put) => {
    for (let i = 0; i < 5; i++) {
      const x = 1 + i;
      const hgt = 1 + Math.floor(hash(seed + i * 2.3) * tall);
      const lean = hash(seed + i * 5.1) < 0.3 ? (i < 2 ? -1 : 1) : 0;
      for (let k = 0; k < hgt; k++) put(x + (k === hgt - 1 ? lean : 0), tall - k, k > hgt / 2 ? colors[0] : colors[1]);
    }
  });
}

function flower(petal: string, petalDark: string, stem = '#4f8f3c'): Sprite {
  return make(3, 5, (put) => {
    put(1, 3, stem);
    put(1, 4, stem);
    put(1, 0, petal);
    put(0, 1, petal);
    put(2, 1, petalDark);
    put(1, 2, petalDark);
    put(1, 1, '#ffe9a8');
  });
}

/* ---------------- 人造物 ---------------- */

function cottage(): Sprite {
  const w = 40;
  const h = 34;
  const roof: Ramp = ['#e38b6a', '#c96a4f', '#a5513f', '#7e3d33'];
  return make(w, h, (put) => {
    const wallTop = 15;
    // 烟囱
    for (let y = 2; y < 12; y++) for (let x = 28; x < 32; x++) put(x, y, x === 28 ? '#a08a7e' : x === 31 ? '#5e5048' : '#7d6a60');
    for (let x = 27; x < 33; x++) put(x, 2, '#5e5048');
    // 墙：灰泥 + 木框
    for (let y = wallTop; y < h; y++) {
      for (let x = 4; x < 36; x++) {
        const shade = x > 31 ? '#d9c7a6' : y > h - 3 ? '#dccbad' : '#f1e5cb';
        put(x, y, shade);
      }
    }
    const beam = '#7a5236';
    const beamD = '#5a3b27';
    for (let y = wallTop; y < h; y++) {
      put(4, y, beam);
      put(19, y, beam);
      put(35, y, beamD);
    }
    for (let x = 4; x < 36; x++) {
      put(x, wallTop, beamD);
      put(x, h - 1, beamD);
    }
    // 窗（暖光）
    for (let y = 20; y < 27; y++) {
      for (let x = 8; x < 15; x++) {
        const frame = y === 20 || y === 26 || x === 8 || x === 14 || x === 11 || y === 23;
        put(x, y, frame ? beam : y < 23 && x < 11 ? '#fff1bf' : '#ffd27a');
      }
    }
    for (let x = 7; x < 16; x++) put(x, 27, '#8f6544');
    // 门
    for (let y = 21; y < h - 1; y++) {
      for (let x = 24; x < 31; x++) {
        const top = y === 21 && (x === 24 || x === 30);
        if (top) continue;
        put(x, y, x === 24 ? '#8c5f3e' : x === 30 ? '#4d3322' : '#6e4a31');
      }
    }
    put(29, 27, '#e6c06a');
    // 屋顶：两坡，左坡受光，瓦片错缝
    const peak = 20;
    for (let y = 3; y < wallTop + 2; y++) {
      const half = Math.round(((y - 3) / (wallTop - 1)) * 20) + 1;
      for (let x = peak - half; x <= peak + half; x++) {
        if (x < 0 || x >= w) continue;
        const left = x < peak;
        const row = Math.floor((y - 3) / 3);
        const seam = (y - 3) % 3 === 2 || (x + row * 2) % 5 === 0;
        let col = left ? roof[1] : roof[2];
        if (seam) col = left ? roof[2] : roof[3];
        if (Math.abs(x - (peak - half)) < 1 || Math.abs(x - (peak + half)) < 1) col = roof[3];
        if (left && !seam && hash(x * 3.1 + y * 7.9) < 0.18) col = roof[0];
        put(x, y, col);
      }
    }
  });
}

function fence(len: number): Sprite {
  return make(len, 8, (put) => {
    for (let x = 0; x < len; x++) {
      put(x, 2, '#c49a6c');
      put(x, 3, '#9a7350');
      put(x, 5, '#c49a6c');
      put(x, 6, '#9a7350');
      if (x % 6 === 1) for (let y = 0; y < 8; y++) {
        put(x, y, '#d8b282');
        put(x + 1, y, '#8a6545');
      }
    }
  });
}

function lamp(): Sprite {
  return make(7, 26, (put) => {
    for (let y = 8; y < 26; y++) {
      put(3, y, '#3d4148');
      put(2, y, y > 23 ? '#3d4148' : '#5a5f68');
    }
    for (let x = 1; x < 6; x++) put(x, 25, '#2e3137');
    // 灯笼
    for (let x = 0; x < 7; x++) put(x, 1, '#2e3137');
    for (let y = 2; y < 7; y++) for (let x = 1; x < 6; x++) put(x, y, x === 1 || x === 5 ? '#2e3137' : y < 4 ? '#fff3c4' : '#ffd36a');
    put(3, 0, '#2e3137');
    for (let x = 1; x < 6; x++) put(x, 7, '#2e3137');
  });
}

function signpost(): Sprite {
  return make(15, 16, (put) => {
    for (let y = 5; y < 16; y++) {
      put(7, y, '#8a6545');
      put(8, y, '#5e4430');
    }
    // 箭头形木牌
    for (let y = 1; y < 6; y++) {
      for (let x = 1; x < 14; x++) {
        if (x === 13 && (y === 1 || y === 5)) continue;
        if (x === 14) continue;
        const col = y === 1 ? '#e2bd8c' : y === 5 ? '#8f6847' : '#c99a68';
        put(x, y, col);
      }
    }
    put(14, 3, '#c99a68');
    for (let x = 3; x < 10; x += 2) put(x, 3, '#9a7350');
  });
}

function campfire(): Sprite {
  return make(14, 5, (put) => {
    const stones: [number, string][] = [
      [0, '#8d96a8'],
      [3, '#6f788b'],
      [10, '#8d96a8'],
      [12, '#6f788b'],
    ];
    for (const [x, c] of stones) {
      put(x, 3, c);
      put(x + 1, 3, c);
      put(x, 4, '#565e70');
      put(x + 1, 4, '#565e70');
    }
    for (let x = 3; x < 11; x++) {
      put(x, 2, x < 7 ? '#8a5a3a' : '#6b4429');
      put(13 - x, 3, x < 7 ? '#a06a44' : '#7a4f31');
    }
  });
}

/* ---------------- 汇总 ---------------- */

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
}

export function buildScenery(): Scenery {
  const oakStyle: TreeStyle = { leaves: ['#b6dc7c', '#7fbf5a', '#529447', '#356b3a'], trunk: ['#9b7352', '#73533b', '#4f392b'] };
  const forestStyle: TreeStyle = { leaves: ['#8fc66b', '#5c9e4e', '#3d7743', '#285438'], trunk: ['#8a6448', '#624632', '#432f25'] };
  const blossomStyle: TreeStyle = {
    leaves: ['#ffe1ec', '#f7b9d1', '#e48fb3', '#b86a91'],
    trunk: ['#8a5f58', '#644240', '#45302f'],
    dots: ['#ffffff', '#ffd0e2'],
  };
  const pineLeaves: Ramp = ['#6f9e86', '#4b7c6b', '#335d55', '#223f40'];
  const greens: Ramp = ['#b2da7e', '#7cbb5a', '#55954a', '#3a713f'];
  const stone: Ramp = ['#c9ccd2', '#a3a8b2', '#7f8592', '#5e6372'];
  return {
    oak: [0, 1, 2, 3].map((i) => broadleaf(11 + i * 7, 9 + (i % 3) * 2, oakStyle)),
    forest: [0, 1, 2, 3, 4].map((i) => broadleaf(61 + i * 5, 10 + (i % 3) * 3, forestStyle)),
    blossom: [0, 1, 2].map((i) => broadleaf(131 + i * 9, 11 + i * 2, blossomStyle)),
    pine: [0, 1, 2, 3].map((i) => pine(201 + i * 3, 6 + (i % 3) * 2, pineLeaves, ['#f5f8fd', '#c9d4e8'])),
    bush: [0, 1, 2].map((i) => bush(301 + i, 4 + i, greens, i === 1 ? ['#f3e17a'] : undefined)),
    blossomBush: [0, 1].map((i) => bush(331 + i, 4 + i, ['#ffe1ec', '#f2b0cb', '#d986aa', '#a95e83'])),
    rock: [0, 1].map((i) => rock(401 + i, 9 + i * 4, 5 + i * 2, stone)),
    sandRock: [0, 1].map((i) => rock(431 + i, 10 + i * 5, 5 + i * 2, ['#f2d7ad', '#d9b384', '#b98f64', '#93704f'])),
    snowRock: [0, 1].map((i) => rock(461 + i, 10 + i * 4, 5 + i * 2, ['#b8c3d8', '#8d99b3', '#6b7792', '#4f5a76'], '#f3f7fd')),
    cactus: [16, 22, 27].map((hgt, i) => cactus(501 + i, hgt)),
    tuft: [0, 1, 2].map((i) => tuft(601 + i, ['#9fd472', '#5f9f4b'])),
    dryTuft: [0, 1].map((i) => tuft(631 + i, ['#e4c98f', '#b8975f'], 3)),
    flowers: [
      flower('#ffffff', '#dfe3ea'),
      flower('#ffd166', '#e3a83d'),
      flower('#ff8fab', '#d9617f'),
      flower('#b9a7ff', '#8a77d9'),
    ],
    cottage: cottage(),
    fence: fence(26),
    lamp: lamp(),
    sign: signpost(),
    campfire: campfire(),
  };
}
