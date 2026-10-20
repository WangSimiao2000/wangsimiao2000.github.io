/**
 * 节日：站长生日（11 月 6 日，按访客本地日期）营火边放烟花、主角戴上生日帽。
 * 网址加 ?date=11-06 可以在别的日子预览。
 */
import { heightAt } from './biomes.js';
import { halo } from './lights.js';
import { sprite } from './atlas.js';
import type { Frame } from './frame.js';

const BIRTHDAY = '11-06';

/** 今天的「月-日」；?date=MM-DD 可覆盖，方便预览 */
export function todayKey(now = new Date(), search = typeof location === 'undefined' ? '' : location.search): string {
  const q = new URLSearchParams(search).get('date');
  if (q && /^\d{2}-\d{2}$/.test(q)) return q;
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const isBirthday = (key = todayKey()) => key === BIRTHDAY;

/* ---------- 生日帽：粉黄条纹的小圆锥，顶上一个白绒球，戴在主角头顶（图集里的 hat） ---------- */

/** 帽子画在主角头顶：x 是主角精灵左边缘，y 是精灵顶边（头发最上面一行） */
export function drawHat(hc: CanvasRenderingContext2D, x: number, y: number, charW: number) {
  const hat = sprite('hat');
  hc.drawImage(hat, x + Math.floor(charW / 2) - Math.floor(hat.width / 2), y - hat.height + 2);
}

/* ---------- 烟花 ---------- */

interface Spark {
  x: number; // 世界坐标
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  rocket: boolean;
  size?: number;
  burstAt?: number; // 火箭：升到这个高度（屏幕 y）就炸开
}

const COLORS = [
  ['#ff5d73', '#ffd1d8'],
  ['#ffd84d', '#fff3b8'],
  ['#5dd6ff', '#d4f4ff'],
  ['#9b7bff', '#e2d8ff'],
  ['#7be08a', '#dcf8df'],
  ['#ff9f43', '#ffe2c2'],
];

export class Fireworks {
  private list: Spark[] = [];
  private next = 1.2;
  private flashes: { x: number; y: number; t: number; color: string }[] = [];

  /**
   * 推进并画到天空层（不吃世界的自下而上渐隐，在卡片上方也看得见）。
   * fireX = 画面里营火的世界坐标；营火不在画面里就在画面内随机找个地方放
   */
  draw(fr: Frame, dt: number, fireX: number | null) {
    if (fr.reduced) return;
    const { sk, W, H, camLeft, time } = fr;
    const k = dt * 60;
    if (time > this.next) {
      this.next = time + 1.1 + Math.random() * 1.8;
      const x = fireX !== null ? fireX + (Math.random() - 0.5) * 50 : camLeft + W * (0.15 + Math.random() * 0.7);
      const pal = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.list.push({ x, y: H - heightAt(x) - 4, vx: (Math.random() - 0.5) * 0.15, vy: -2.1 - Math.random() * 0.5, life: 0, max: 400, color: pal[0], rocket: true, burstAt: H * (0.17 + Math.random() * 0.1) });
    }
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.life += k;
      if (s.rocket) {
        s.vy += 0.018 * k;
        s.x += s.vx * k;
        s.y += s.vy * k;
        if (s.y <= (s.burstAt ?? 0) || s.vy > -0.4) {
          list.splice(i, 1);
          this.burst(s.x, s.y);
          continue;
        }
      } else {
        s.vy += 0.012 * k;
        s.vx *= 0.985 ** k;
        s.vy *= 0.985 ** k;
        s.x += s.vx * k;
        s.y += s.vy * k;
        if (s.life > s.max) {
          list.splice(i, 1);
          continue;
        }
      }
      const sx = Math.round(s.x - camLeft);
      const sy = Math.round(s.y);
      if (sx < -10 || sx > W + 10) continue;
      sk.globalAlpha = s.rocket ? 1 : Math.max(0, 1 - s.life / s.max) ** 0.7;
      sk.fillStyle = s.color;
      const sz = s.rocket ? 2 : (s.size ?? 1);
      sk.fillRect(sx, sy, sz, sz);
      if (s.rocket) {
        sk.globalAlpha = 0.5;
        sk.fillRect(sx, sy + 2, 2, 3); // 拖尾
        sk.globalAlpha = 0.25;
        sk.fillRect(sx, sy + 5, 2, 3);
      }
    }
    sk.globalAlpha = 1;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const fl = this.flashes[i];
      fl.t += dt;
      if (fl.t > 0.35) {
        this.flashes.splice(i, 1);
        continue;
      }
      halo(sk, Math.round(fl.x - camLeft), Math.round(fl.y), 18, fl.color, (fr.dark ? 0.45 : 0.22) * (1 - fl.t / 0.35));
    }
  }

  private burst(x: number, y: number) {
    const pal = COLORS[Math.floor(Math.random() * COLORS.length)];
    const n = 40 + Math.floor(Math.random() * 16);
    const speed = 0.9 + Math.random() * 0.5;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + Math.random() * 0.15;
      const v = speed * (0.75 + Math.random() * 0.25); // 速度相近才炸成一个圆
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 85 + Math.random() * 40, color: Math.random() < 0.3 ? pal[1] : pal[0], rocket: false, size: Math.random() < 0.6 ? 2 : 1 });
    }
    this.flashes.push({ x, y, t: 0, color: pal[1] });
  }
}
