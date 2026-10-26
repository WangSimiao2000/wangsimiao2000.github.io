/**
 * 主角：始终在屏幕正中。相机移动时按移动距离推进跑步帧，停下后待机眨眼，阅读时坐下看书。
 */
import { buildCharacter, type Sprite } from './sprites.js';
import type { Frame } from './frame.js';
import { drawHat } from './festive.js';

export const CHAR_W = 14;
export const CHAR_H = 22;

/**
 * 生日帽左上角相对朝右精灵左上角的位置，按画师原稿里帽子图层的位置量出来的
 * （跑步帧里身体有起伏，帽子跟着走）。朝左时水平镜像。
 */
const HAT = {
  idle: [[4, -5], [4, -5]],
  run: [[5, -4], [5, -5], [5, -4], [5, -5]],
  sit: [[4, -2], [4, -2], [4, -2]],
} as const;

export class Hero {
  facing: 1 | -1 = 1;
  /** 累计跑过的距离，决定跑步帧 */
  stride = 0;
  /** 脚底的屏幕 y（逻辑像素），平滑地贴着地面 */
  y = 0;
  /** 戴生日帽（站长生日那天） */
  hat = false;
  private right = buildCharacter(false);
  private left = buildCharacter(true);
  private nextBlink = 2.5;
  private nextTurn = 6;

  /** 进入阅读后几秒才第一次翻页 */
  resetReading(time: number) {
    this.nextTurn = time + 4;
  }

  private blink(time: number) {
    const on = time > this.nextBlink && time < this.nextBlink + 0.13;
    if (time > this.nextBlink + 0.13) this.nextBlink = time + 2.5 + Math.random() * 3;
    return on;
  }

  draw(fr: Frame, running: boolean, sitting: boolean) {
    const frames = this.facing > 0 ? this.right : this.left;
    const { time, hc, W, H } = fr;
    let sprite: Sprite;
    let hat: readonly [number, number];
    if (sitting) {
      // 看书：偶尔眨眼，隔几秒翻一页
      const blinking = this.blink(time);
      const turning = !fr.reduced && time > this.nextTurn && time < this.nextTurn + 0.35;
      if (time > this.nextTurn + 0.35) this.nextTurn = time + 5 + Math.random() * 4;
      const i = turning ? 2 : blinking ? 1 : 0;
      sprite = frames.sit[i];
      hat = HAT.sit[i];
    } else if (running) {
      // 跑步的上下起伏画在帧里了，这里不再额外颠动
      const i = Math.floor(this.stride / 5) % 4;
      sprite = frames.run[i];
      hat = HAT.run[i];
    } else {
      const i = this.blink(time) ? 1 : 0;
      sprite = frames.idle[i];
      hat = HAT.idle[i];
    }
    const x = Math.round(fr.HALF - CHAR_W / 2);
    const y = Math.round(this.y - sprite.height);
    hc.clearRect(0, 0, W, H);
    hc.globalAlpha = 0.22;
    hc.fillStyle = '#000';
    hc.fillRect(x + 2, Math.round(this.y), CHAR_W - 4, 1);
    hc.globalAlpha = 1;
    hc.drawImage(sprite, x, y);
    if (this.hat) drawHat(hc, x, y, hat, this.facing < 0 ? sprite.width : 0);
  }
}
