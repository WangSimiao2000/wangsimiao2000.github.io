/**
 * 灯光：自发光像素（灯泡、窗格）、光晕、营火。
 * 所有光源共用一套亮度：夜里的光晕强度和营火一致，白天按同样比例减弱。
 */
import type { Sprite } from './sprites.js';
import type { GlowKind } from './biomes.js';
import type { Particles } from './particles.js';
import type { Frame } from './frame.js';

export interface Glow {
  x: number; // 屏幕坐标（逻辑像素）
  y: number;
  kind: GlowKind;
  wx: number; // 世界坐标：灯的闪烁相位、火星的生成位置
}

export const GLOW = { night: 0.26, day: 0.12 };

/** 物体画进前景时同步维护自发光层：先擦掉它挡住的光，再画它自己的发光像素 */
export function emit(fr: Frame, sp: Sprite & { emissive?: HTMLCanvasElement }, x: number, y: number) {
  if (!fr.dark) return;
  const e = fr.e;
  e.globalCompositeOperation = 'destination-out';
  e.drawImage(sp, x, y);
  e.globalCompositeOperation = 'source-over';
  if (sp.emissive) e.drawImage(sp.emissive, x, y);
}

/** 像素化的圆形光晕：按距离分 3 档透明度，越外越淡 */
export function halo(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  g.fillStyle = color;
  for (let band = 3; band >= 1; band--) {
    const rr = (r * band) / 3;
    g.globalAlpha = a / (band + 0.5);
    const ri = Math.ceil(rr);
    for (let dy = -ri; dy <= ri; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
      g.fillRect(x - half, y + dy, half * 2 + 1, 1);
    }
  }
  g.globalAlpha = 1;
}

function drawFlame(fr: Frame, x: number, y: number, worldX: number, particles: Particles) {
  const { g } = fr;
  const flick = fr.reduced ? 0 : Math.floor(fr.time * 10) % 3;
  halo(g, x, y - 3, 13, '#ffb55a', fr.dark ? GLOW.night : GLOW.day);
  g.fillStyle = '#ff7a2a';
  g.fillRect(x - 3, y - 5 + flick, 6, 5 - flick);
  g.fillRect(x - 1, y - 8 + flick, 3, 3);
  g.fillStyle = '#ffc14d';
  g.fillRect(x - 2, y - 4 + (flick === 1 ? 1 : 0), 4, 4);
  g.fillStyle = '#fff2b0';
  g.fillRect(x - 1, y - 2, 2, 2);
  if (!fr.reduced && Math.random() < 0.15) {
    const spark = Math.random() < 0.35;
    particles.spawn({ x: worldX + (Math.random() - 0.5) * 4, y: y - 7, vx: (Math.random() - 0.5) * 0.1, vy: -0.25 - Math.random() * 0.2, life: 0, max: 60 + Math.random() * 40, color: spark ? '#ffb84d' : '#9aa0aa', size: 1, kind: spark ? 'spark' : 'smoke' });
  }
}

/** 光晕和火焰画在夜色之上、角色之下（角色经过会挡光） */
export function drawGlows(fr: Frame, glows: Glow[], particles: Particles) {
  const base = fr.dark ? GLOW.night : GLOW.day;
  for (const gl of glows) {
    if (gl.kind === 'lamp') halo(fr.g, gl.x, gl.y, 11, '#ffd36a', base * (0.92 + 0.08 * Math.sin(fr.time * 3 + gl.wx)));
    if (gl.kind === 'window') halo(fr.g, gl.x, gl.y, 11, '#ffcf70', base);
    if (gl.kind === 'fire') drawFlame(fr, gl.x, gl.y, gl.wx, particles);
  }
}
