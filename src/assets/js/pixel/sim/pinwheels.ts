/**
 * 友链板块（花林）地上插的彩色纸风车：有几个友链就插几个（首页友链板块的 data-friends，构建时按 friends.yml 写好）。
 *
 * 杆子是一张图（src/art/pinwheel/stick），风车头不用序列帧，每帧按当前角度现画：
 * 一张正方形纸剪开四角、对折到中心，俯看是四片三角形叶片（红、黄、蓝、绿）。每个像素超采样判断落在哪片叶片上，
 * 靠折痕的一半亮、外侧一半暗，右下再暗一档（光从左上来，转到哪光都从左上来）；外面一圈彩色描边 = 相邻叶片颜色压暗，
 * 中间一颗钉子。角度量化成 STEPS 档，每档算一次就缓存下来。
 *
 * 风车是普通布景（Item）：和植被一起按 z 排序、落地、投影、入夜变暗。每个风车的起始角度和转速都错开一点，
 * 像被同一阵风吹着；镜头在走时风大一些、转得快，停下来慢慢缓回去。开了「减少动态效果」就不转。
 */
import { SECTION, type Item } from './biomes.js';
import { hash } from './sprites.js';
import { css, mixRGB, rgb } from './util.js';
import { sprite, type Sprite } from '../atlas.js';
import type { Frame } from './frame.js';

/** 最多插几个：再多就排到邻近板块去了（左右各 5 个，最外面离中心约 150） */
export const MAX_PINWHEELS = 10;
const TURN = 0.7; // 平时每秒转几圈
const GUST = 2.2; // 镜头在走时，转速乘这么多
const STEP = 24; // 相邻两个风车隔多远（世界像素）
/** 板块中心两侧留空：小人脚下（右边）、路牌（左边，在 -32 附近） */
const FIRST_RIGHT = 28;
const FIRST_LEFT = -52;

/** 风车头：SIZE 见方的叶片，外面一圈描边，正好压在杆子图（13 宽）的上半截 */
const SIZE = 11;
const STEPS = 32; // 一圈分多少档角度
const SS = 4; // 每个像素超采样 SS×SS
/** 四片叶片：亮、中、暗 */
const PAPER = [
  ['#f68476', '#de5248', '#b03434'],
  ['#ffe080', '#f2be48', '#cc922e'],
  ['#80baf0', '#4c8ed6', '#3466aa'],
  ['#8cd688', '#58b060', '#3c8848'],
];
const PIN = ['#f6ecdc', '#bca88a'];
const outline = (c: string) => css(mixRGB(rgb(c), [0, 0, 0], 0.42));

/** 第 i 个风车相对板块中心的位置：左右交替，从里往外排，稍微错开一点不那么整齐 */
export function pinwheelDx(i: number): number {
  const k = Math.floor(i / 2);
  const jitter = Math.round((hash(i * 4.7 + 1.3) - 0.5) * 6);
  return (i % 2 === 0 ? FIRST_RIGHT + k * STEP : FIRST_LEFT - k * STEP) + jitter;
}

const cross = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

/** 0 度时，叶片坐标 (u, v)（以风车中心为原点）落在第几片、哪一半上：[片, 0 = 亮的一半 / 1 = 暗的一半]，不在叶片上返回 null */
function bladeAt(u: number, v: number, R: number): [number, number] | null {
  for (let k = 0; k < 4; k++) {
    const a0 = ((225 + 90 * k) * Math.PI) / 180;
    const a1 = a0 + Math.PI / 2;
    const [c0x, c0y] = [R * Math.cos(a0), R * Math.sin(a0)];
    const [c1x, c1y] = [R * Math.cos(a1), R * Math.sin(a1)];
    const [mx, my] = [(c0x + c1x) / 2, (c0y + c1y) / 2];
    // 三角形（中心, 角 k, 角 k 到角 k+1 那条边的中点）
    const d1 = cross(0, 0, c0x, c0y, u, v);
    const d2 = cross(c0x, c0y, mx, my, u, v);
    const d3 = cross(mx, my, 0, 0, u, v);
    if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue;
    // 折痕：中心到「角和边中点之间」那条线，靠角的一半亮
    const [fx, fy] = [(c0x + mx) / 2, (c0y + my) / 2];
    return [k, cross(0, 0, fx, fy, u, v) * cross(0, 0, fx, fy, c0x, c0y) > 0 ? 0 : 1];
  }
  return null;
}

type Px = [number, number, string];
const heads: Px[][] = [];

/** 第 step 档角度的风车头：一串 [x, y, 颜色]，坐标相对杆子图的左上角 */
export function pinwheelHead(step: number): Px[] {
  const s = ((step % STEPS) + STEPS) % STEPS;
  const cached = heads[s];
  if (cached) return cached;
  const R = SIZE / 2;
  const a = (-s * 2 * Math.PI) / STEPS; // 转回 0 度的坐标系
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const grid = new Map<number, [number, number]>();
  const key = (x: number, y: number) => y * 64 + x;
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const votes = new Map<number, number>();
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS - R;
          const y = py + (sy + 0.5) / SS - R;
          const hit = bladeAt(x * ca - y * sa, x * sa + y * ca, R * 0.98);
          if (hit) votes.set(hit[0] * 2 + hit[1], (votes.get(hit[0] * 2 + hit[1]) ?? 0) + 1);
        }
      }
      // 先按「落在任何叶片上」的总覆盖率决定这格画不画，再看哪片叶片占得多、这片里哪一半占得多。
      // 分开投票的话，折痕两边各占一半，两边都不够数，转到斜角时叶片会碎掉
      let total = 0;
      for (const c of votes.values()) total += c;
      if (total <= SS * SS * 0.45) continue;
      let k = 0;
      let kn = -1;
      for (let b = 0; b < 4; b++) {
        const n = (votes.get(b * 2) ?? 0) + (votes.get(b * 2 + 1) ?? 0);
        if (n > kn) [k, kn] = [b, n];
      }
      grid.set(key(px, py), [k, (votes.get(k * 2) ?? 0) >= (votes.get(k * 2 + 1) ?? 0) ? 0 : 1]);
    }
  }
  // 去掉孤零零的像素：一个同片邻居都没有的，转起来会一闪一闪
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const lone: number[] = [];
  for (const [p, [k]] of grid) {
    const x = p % 64;
    const y = Math.floor(p / 64);
    if (!N4.some(([dx, dy]) => grid.get(key(x + dx, y + dy))?.[0] === k)) lone.push(p);
  }
  for (const p of lone) grid.delete(p);
  const out: Px[] = [];
  // 描边：叶片外面一圈 = 相邻叶片的颜色压暗（先画，叶片盖在上面）
  for (let y = -1; y <= SIZE; y++) {
    for (let x = -1; x <= SIZE; x++) {
      if (grid.has(key(x, y))) continue;
      const nb = N4.map(([dx, dy]) => grid.get(key(x + dx, y + dy))).find((v) => v);
      if (nb) out.push([x + 1, y + 1, outline(PAPER[nb[0]][1])]);
    }
  }
  for (const [p, [k, tone]] of grid) {
    const x = p % 64;
    const y = Math.floor(p / 64);
    const col = PAPER[k];
    out.push([x + 1, y + 1, tone === 0 ? col[0] : x + y > SIZE ? col[2] : col[1]]);
  }
  const c = (SIZE + 2) >> 1;
  out.push([c, c, PIN[0]], [c + 1, c, PIN[1]]);
  heads[s] = out;
  return out;
}

export class Pinwheels {
  private stick: Sprite | null = null;
  private turns: number[] = []; // 每个风车转了多少圈
  private wind = 1; // 当前的风：1 = 平时，GUST = 镜头在走
  private readonly sec: number;
  private readonly count: number;

  /** sec：友链在第几个板块；count：插几个 */
  constructor(sec: number, count: number) {
    this.sec = sec;
    this.count = count;
    for (let i = 0; i < count; i++) this.turns.push(hash(i * 2.3 + 0.7));
  }

  /** 推进转动（每帧一次） */
  update(fr: Frame, dt: number) {
    if (fr.reduced || !this.count) return;
    const want = fr.running ? GUST : 1;
    this.wind += (want - this.wind) * Math.min(1, dt * 2);
    for (let i = 0; i < this.count; i++) this.turns[i] += dt * TURN * this.wind * (0.8 + hash(i * 5.1 + 2.9) * 0.4);
  }

  /** 镜头附近的话，返回这些风车这一帧的布景：杆子是图，风车头在 paint 里按角度现画 */
  items(fr: Frame): Item[] {
    const c = this.sec * SECTION;
    if (!this.count || fr.camLeft > c + SECTION / 2 || fr.camLeft + fr.W < c - SECTION / 2) return [];
    this.stick ??= sprite('pinwheel.stick');
    const { dl } = fr;
    return this.turns.map((t, i) => ({
      sprite: this.stick!,
      wx: c + pinwheelDx(i),
      z: 2,
      paint: (x: number, y: number) => {
        for (const [px, py, col] of pinwheelHead(Math.floor(t * STEPS))) dl.rect('fg', x + px, y + py, 1, 1, col);
      },
    }));
  }
}
