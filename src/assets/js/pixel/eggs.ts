/**
 * 彩蛋：起点的路牌（双击翻过来通往隐藏页）、小屋里的女孩（双击门）、草堆里的彩狸猫（点几下）。
 *
 * 布景里带 egg 标记的物体由这里接管绘制；每帧登记可点击区域（spots），
 * 点击判定、动画推进、气泡都在这里。world.ts 只负责转发点击和告诉它「现在是不是在起点」。
 */
import type { Item } from './biomes.js';
import { heightAt } from './biomes.js';
import { COTTAGE } from './scenery.js';
import { buildCat, buildGirl } from './npcs.js';
import { emit } from './lights.js';
import { clamp } from './util.js';
import type { Frame } from './frame.js';

export interface Spot {
  kind: 'sign' | 'hay' | 'door' | 'cat';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 3x5 像素字：只需要 H、i、! 和心形 */
const GLYPHS: Record<string, string[]> = {
  H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'],
  i: ['.x.', '...', '.x.', '.x.', '.x.'],
  '!': ['.x.', '.x.', '.x.', '...', '.x.'],
  '♥': ['.....', 'xx.xx', 'xxxxx', '.xxx.', '..x..'],
};

function bubble(g: CanvasRenderingContext2D, cx: number, bottom: number, text: string, color: string) {
  const glyphs = [...text].map((c) => GLYPHS[c]);
  const w = glyphs.reduce((a, gl) => a + gl[0].length + 1, 3);
  const h = 9;
  const x = Math.round(cx - w / 2);
  const y = bottom - h - 3;
  g.fillStyle = '#2a1f22';
  g.fillRect(x, y + 1, w, h - 2);
  g.fillRect(x + 1, y, w - 2, h);
  g.fillStyle = '#ffffff';
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillRect(Math.round(cx) - 1, y + h - 1, 2, 2); // 小尾巴
  g.fillStyle = '#2a1f22';
  g.fillRect(Math.round(cx) - 1, y + h + 1, 1, 1);
  g.fillStyle = color;
  let gx = x + 2;
  for (const gl of glyphs) {
    gl.forEach((row, ry) => [...row].forEach((c, rx) => c === 'x' && g.fillRect(gx + rx, y + 2 + ry, 1, 1)));
    gx += gl[0].length + 1;
  }
}

export const inside = (sp: Spot, lx: number, ly: number) => lx >= sp.x0 && lx <= sp.x1 && ly >= sp.y0 && ly <= sp.y1;

export class Eggs {
  spots: Spot[] = [];
  /** 路牌翻转动画 0..1；signOpen = 已翻过来，可以往回走进隐藏页 */
  signFlip = 0;
  signOpen = false;
  private girlR = buildGirl(false);
  private girlL = buildGirl(true);
  private catL = buildCat(true);
  private cottageWx = 0;
  private girl = { state: 'none' as 'none' | 'out' | 'wave' | 'in', t: 0, off: 0 };
  private hayShake = 0;
  private hayClicks = 0;
  private hayX = 0;
  private hayBase = 0;
  private cat = { state: 'hidden' as 'hidden' | 'jump' | 'sit', t: 0, x: 0, meow: 0 };

  /** 每帧开始时清掉上一帧登记的点击区域 */
  beginFrame() {
    this.spots = [];
  }

  /**
   * 画一个带 egg 标记的布景。路牌、草堆自己画（有翻转和抖动）；小屋照常画，再叠上开着的门。
   * 返回 false 表示这个物体不归彩蛋管
   */
  drawItem(fr: Frame, it: Item, x: number, y: number, base: number): boolean {
    const sp = it.sprite;
    const { f } = fr;
    if (it.egg === 'sign') {
      // 起点的路牌：绕立柱水平翻转
      const k = Math.cos(this.signFlip * Math.PI);
      f.save();
      f.translate(x + sp.width / 2, 0);
      f.scale(Math.abs(k) < 0.08 ? 0.08 * Math.sign(k || 1) : k, 1);
      f.drawImage(sp, -sp.width / 2, y);
      f.restore();
      this.spots.push({ kind: 'sign', x0: x - 2, y0: y - 2, x1: x + sp.width + 2, y1: y + sp.height });
      return true;
    }
    if (it.egg === 'hay') {
      const jig = this.hayShake > 0 ? Math.round(Math.sin(fr.time * 70) * 1.5 * Math.min(1, this.hayShake * 4)) : 0;
      f.drawImage(sp, x + jig, y + (this.hayShake > 0.15 ? -1 : 0));
      this.hayX = it.wx;
      this.hayBase = base;
      this.spots.push({ kind: 'hay', x0: x - 2, y0: y - 3, x1: x + sp.width + 2, y1: base });
      return true;
    }
    if (it.egg === 'door') {
      f.drawImage(sp, x, y);
      emit(fr, sp, x, y);
      this.cottageWx = it.wx - sp.width / 2;
      // 门：女孩进出时是开着的（门洞发暗，屋里的暖光透出来，算自发光）
      const g = this.girl;
      if (g.state !== 'none' && (g.state !== 'wave' || g.t < 0.3)) {
        const [dx, dy, dw, dh] = COTTAGE.door;
        const [lx, ly, lw, lh] = COTTAGE.doorLight;
        f.fillStyle = '#3b2a22';
        f.fillRect(x + dx, y + dy, dw, dh);
        for (const ctx of [f, fr.e]) {
          ctx.fillStyle = '#ffd77e';
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x + lx, y + ly, lw, lh);
          ctx.globalAlpha = 1;
        }
      }
      const [x0, y0, x1, y1] = COTTAGE.doorHit;
      this.spots.push({ kind: 'door', x0: x + x0, y0: y + y0, x1: x + x1, y1: y + y1 });
      return true;
    }
    return false;
  }

  /** 点击（逻辑像素坐标）。atStart = 当前停在起点且不在隐藏页。命中了返回 true */
  tap(lx: number, ly: number, double: boolean, atStart: boolean): boolean {
    const hit = this.spots.find((sp) => inside(sp, lx, ly));
    if (!hit) return false;
    if (hit.kind === 'sign' && double && atStart) this.signOpen = !this.signOpen;
    if (hit.kind === 'door' && double && this.girl.state === 'none') Object.assign(this.girl, { state: 'out', t: 0, off: 0 });
    if (hit.kind === 'hay' && this.cat.state === 'hidden') {
      this.hayShake = 0.35;
      if (++this.hayClicks >= 4) {
        this.hayClicks = 0;
        Object.assign(this.cat, { state: 'jump', t: 0, x: this.hayX });
      }
    }
    if (hit.kind === 'cat') this.cat.meow = 1.4;
    return true;
  }

  /** 推进彩蛋动画；女孩和猫画到角色层（夜色会盖上去，经过窗前会挡光） */
  drawActors(fr: Frame, dt: number) {
    const { a, H, camLeft } = fr;
    const target = this.signOpen ? 1 : 0;
    if (this.signFlip !== target) {
      const dir = target > this.signFlip ? 1 : -1;
      this.signFlip = clamp(this.signFlip + dir * dt * (fr.reduced ? 100 : 2.2), 0, 1);
    }
    this.hayShake = Math.max(0, this.hayShake - dt);
    // 女孩：开门 -> 走出来 -> 招手 -> 走回去 -> 关门
    const girl = this.girl;
    if (girl.state !== 'none') {
      girl.t += dt;
      const doorX = this.cottageWx + COTTAGE.doorCenter;
      if (girl.state === 'out') {
        girl.off = Math.max(-18, -Math.max(0, girl.t - 0.35) * 20);
        if (girl.off <= -18) Object.assign(girl, { state: 'wave', t: 0 });
      } else if (girl.state === 'wave' && girl.t > 2.4) Object.assign(girl, { state: 'in', t: 0 });
      else if (girl.state === 'in') {
        girl.off = Math.min(0, -18 + girl.t * 20);
        if (girl.off >= 0 && girl.t > 1.2) Object.assign(girl, { state: 'none', t: 0, off: 0 });
      }
      const wx = doorX + girl.off;
      const fr2 = girl.state !== 'in' ? this.girlL : this.girlR;
      const walking = (girl.state === 'out' && girl.t > 0.35) || (girl.state === 'in' && girl.off < 0);
      const sp = girl.state === 'wave' ? fr2.wave[Math.floor(girl.t / 0.25) % 2] : walking ? fr2.walk[Math.floor(girl.t * 6) % 2] : fr2.idle;
      const gy = H - Math.round(heightAt(wx));
      const x = Math.round(wx - 7 - camLeft);
      // 人比门框高，不能「从门里探出来」（会被门框截掉半个头）：门先打开，人在门口
      // 淡入后走出来；回去时走到门口淡出，门再关上
      let alpha = 1;
      if (girl.state === 'out') alpha = clamp((girl.t - 0.3) / 0.3);
      if (girl.state === 'in' && girl.off > -4) alpha = clamp(-girl.off / 4);
      if (alpha > 0) {
        a.globalAlpha = alpha;
        a.drawImage(sp, x, gy - sp.height);
        a.globalAlpha = 1;
      }
    }
    // 彩狸猫：从草堆里跳出来落在旁边，坐着甩尾巴、眨眼
    const cat = this.cat;
    if (cat.state !== 'hidden') {
      cat.t += dt;
      const frames = this.catL;
      let sp = frames.sit;
      let cx = this.hayX - 18;
      let cy = H - Math.round(heightAt(cx));
      if (cat.state === 'jump') {
        const u = Math.min(1, cat.t / 0.7);
        cx = this.hayX - 2 - u * 16;
        cy = Math.round(this.hayBase - 6 + (H - heightAt(cx) - this.hayBase + 6) * u - Math.sin(u * Math.PI) * 16);
        sp = frames.jump;
        if (u >= 1) Object.assign(cat, { state: 'sit', t: 0 });
      } else {
        const ph = cat.t % 4;
        sp = ph > 3.2 ? frames.tail : ph > 1.5 && ph < 1.65 ? frames.blink : frames.sit;
      }
      cat.x = cx;
      const x = Math.round(cx - sp.width / 2 - camLeft);
      a.drawImage(sp, x, cy - sp.height + 1);
      this.spots.push({ kind: 'cat', x0: x - 2, y0: cy - sp.height - 2, x1: x + sp.width + 2, y1: cy + 1 });
    }
  }

  /** 招呼和喵的气泡画在夜色之上，晚上也看得清 */
  drawBubbles(fr: Frame, dt: number) {
    const { g, H, camLeft } = fr;
    const girl = this.girl;
    if (girl.state === 'wave' && girl.t > 0.2) {
      const wx = this.cottageWx + COTTAGE.doorCenter + girl.off;
      bubble(g, wx - camLeft, H - Math.round(heightAt(wx)) - 21, 'Hi!', '#d0603a');
    }
    if (this.cat.meow > 0) {
      this.cat.meow -= dt;
      bubble(g, this.cat.x - camLeft, H - Math.round(heightAt(this.cat.x)) - 10, '♥', '#e85d7a');
    }
  }
}
