/**
 * 粒子：群系天气（雪、花瓣、落叶、萤火虫）、小人脚下的灰、篝火的火星和烟。
 * 粒子用世界坐标，画到主画布上（不吃夜色）。
 */
import { BIOMES, OFF, heightAt, GROUND, type WeatherKind } from './biomes.js';
import { clamp } from './util.js';
import type { Frame } from './frame.js';

export type ParticleKind = WeatherKind | 'firefly' | 'dust' | 'spark' | 'smoke';

export interface Particle {
  x: number; // 世界坐标
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: ParticleKind;
}

const MAX = 420;

export class Particles {
  readonly list: Particle[] = [];

  spawn(pt: Particle) {
    if (this.list.length < MAX) this.list.push(pt);
  }

  /** 按离各群系的远近（滚动进度）撒天气粒子 */
  weather(fr: Frame, dt: number) {
    if (fr.reduced) return;
    const k = dt * 60;
    const { W, H, camLeft } = fr;
    BIOMES.forEach((b, bi) => {
      const near = clamp(1 - Math.abs(fr.p - (bi - OFF)) * 1.3);
      if (near <= 0) return;
      const wt = b.weather;
      if (wt && Math.random() < near * wt.rate * k) {
        if (wt.kind === 'snow') this.spawn({ x: camLeft + Math.random() * W, y: H * 0.35, vx: 0, vy: 0.16 + Math.random() * 0.18, life: 0, max: 900, color: fr.dark ? '#dfe7f5' : '#ffffff', size: Math.random() < 0.2 ? 2 : 1, kind: 'snow' });
        if (wt.kind === 'petal') this.spawn({ x: camLeft + Math.random() * W * 1.2, y: H * 0.4, vx: -0.15 - Math.random() * 0.15, vy: 0.2 + Math.random() * 0.12, life: 0, max: 900, color: Math.random() < 0.5 ? '#ffd6e6' : '#ef9fc2', size: Math.random() < 0.3 ? 2 : 1, kind: 'petal' });
        if (wt.kind === 'leaf') this.spawn({ x: camLeft + Math.random() * W * 1.2, y: H - GROUND - 40 - Math.random() * 20, vx: -0.1 - Math.random() * 0.1, vy: 0.12 + Math.random() * 0.08, life: 0, max: 600, color: Math.random() < 0.5 ? '#8fc66b' : '#c9b25a', size: 1, kind: 'leaf' });
      }
      if (b.fireflies && fr.dark && Math.random() < near * b.fireflies * k) {
        this.spawn({ x: camLeft + Math.random() * W, y: H - GROUND - 6 - Math.random() * 36, vx: 0, vy: 0, life: 0, max: 240 + Math.random() * 200, color: '#fff27a', size: 1, kind: 'firefly' });
      }
    });
  }

  /** 推进并绘制所有粒子；落地、出屏、寿命到了的移除 */
  draw(fr: Frame, dt: number) {
    const { g, W, H, camLeft } = fr;
    const k = dt * 60;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const pt = list[i];
      pt.life += k;
      if (pt.kind === 'snow') pt.vx = Math.sin((pt.life + pt.x) * 0.03) * 0.15;
      if (pt.kind === 'petal' || pt.kind === 'leaf') pt.vx += Math.sin(pt.life * 0.05) * 0.004;
      if (pt.kind === 'firefly') {
        pt.vx += (Math.random() - 0.5) * 0.02;
        pt.vy += (Math.random() - 0.5) * 0.02;
        pt.vx *= 0.98;
        pt.vy *= 0.98;
      }
      if (pt.kind === 'dust') {
        pt.vy += 0.01 * k;
        if (!fr.running) pt.life += k * 3; // 停下后脚边的灰很快散掉，不拖尾
      }
      pt.x += pt.vx * k;
      pt.y += pt.vy * k;
      const sx = Math.round(pt.x - camLeft);
      const groundY = H - heightAt(pt.x);
      if (pt.life > pt.max || pt.y > groundY + 1 || sx < -20 || sx > W + 20) {
        list.splice(i, 1);
        continue;
      }
      let a = Math.min(1, pt.life / 30); // 从半空淡入，衔接上方的渐隐遮罩
      if (pt.kind === 'dust' || pt.kind === 'smoke' || pt.kind === 'spark') a = 1 - pt.life / pt.max;
      if (pt.kind === 'firefly') a = (0.5 + 0.5 * Math.sin(pt.life * 0.08)) * Math.min(1, (pt.max - pt.life) / 40);
      g.globalAlpha = clamp(a) * (pt.kind === 'smoke' ? 0.45 : 1);
      g.fillStyle = pt.color;
      g.fillRect(sx, Math.round(pt.y), pt.size, pt.size);
    }
    g.globalAlpha = 1;
  }
}
