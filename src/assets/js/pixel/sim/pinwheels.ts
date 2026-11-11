/**
 * 友链板块（花林）地上插的彩色纸风车：有几个友链就插几个（首页友链板块的 data-friends，构建时按 friends.yml 写好）。
 *
 * 风车头和杆子是分开的两张图（src/art/pinwheel/head、stick，头压在杆子图的上半截、钉子在头的正中）。
 * 头不换帧，每帧按当前角度绕钉子转（绘制清单的 rotate），角度是连续的，所以转起来是顺的，不是序列帧那种一顿一顿。
 *
 * 风车是普通布景（Item）：和植被一起按 z 排序、落地、投影、入夜变暗。每个风车的起始角度和转速都错开一点，
 * 像被同一阵风吹着；镜头在走时风大一些、转得快，停下来慢慢缓回去。开了「减少动态效果」就不转。
 */
import { SECTION, type Item } from './biomes.js';
import { hash } from './sprites.js';
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

/** 第 i 个风车相对板块中心的位置：左右交替，从里往外排，稍微错开一点不那么整齐 */
export function pinwheelDx(i: number): number {
  const k = Math.floor(i / 2);
  const jitter = Math.round((hash(i * 4.7 + 1.3) - 0.5) * 6);
  return (i % 2 === 0 ? FIRST_RIGHT + k * STEP : FIRST_LEFT - k * STEP) + jitter;
}

/** 转了 turns 圈时风车头的转角（弧度，顺时针） */
export const pinwheelAngle = (turns: number) => (((turns % 1) + 1) % 1) * Math.PI * 2;

export class Pinwheels {
  private stick: Sprite | null = null;
  private head: Sprite | null = null;
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

  /** 镜头附近的话，返回这些风车这一帧的布景：杆子是布景本身，风车头在 paint 里按当前角度转着画 */
  items(fr: Frame): Item[] {
    const c = this.sec * SECTION;
    if (!this.count || fr.camLeft > c + SECTION / 2 || fr.camLeft + fr.W < c - SECTION / 2) return [];
    this.stick ??= sprite('pinwheel.stick');
    this.head ??= sprite('pinwheel.head');
    const head = this.head;
    const { dl } = fr;
    return this.turns.map((t, i) => ({
      sprite: this.stick!,
      wx: c + pinwheelDx(i),
      z: 2,
      paint: (x: number, y: number) => dl.sprite('fg', head, x, y, { rotate: pinwheelAngle(t) }),
    }));
  }
}
