/**
 * 灯光：自发光像素（灯泡、窗格）、光晕、营火。
 * 所有光源共用一套亮度：夜里的光晕强度和营火一致，白天按同样比例减弱。
 */
import type { Sprite } from '../atlas.js';
import type { Beam, DrawList, LayerName } from '../drawlist.js';
import { heightAt, type GlowKind } from './biomes.js';
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
export function emit(fr: Frame, sp: Sprite, x: number, y: number) {
  if (!fr.dark) return;
  fr.dl.sprite('emissive', sp, x, y, { erase: true });
  if (sp.glow) fr.dl.sprite('emissive', sp, x, y, { glow: true });
}

/** 像素化的圆形光晕：按距离分 3 档透明度，越外越淡 */
export function halo(dl: DrawList, layer: LayerName, x: number, y: number, r: number, color: string, a: number) {
  for (let band = 3; band >= 1; band--) {
    const rr = (r * band) / 3;
    const alpha = a / (band + 0.5);
    const ri = Math.ceil(rr);
    for (let dy = -ri; dy <= ri; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
      dl.rect(layer, x - half, y + dy, half * 2 + 1, 1, color, alpha);
    }
  }
}

function drawFlame(fr: Frame, x: number, y: number, worldX: number, particles: Particles) {
  const { dl } = fr;
  const flick = fr.reduced ? 0 : Math.floor(fr.time * 10) % 3;
  halo(dl, 'glow', x, y - 3, 13, '#ffb55a', fr.dark ? GLOW.night : GLOW.day);
  dl.rect('glow', x - 3, y - 5 + flick, 6, 5 - flick, '#ff7a2a');
  dl.rect('glow', x - 1, y - 8 + flick, 3, 3, '#ff7a2a');
  dl.rect('glow', x - 2, y - 4 + (flick === 1 ? 1 : 0), 4, 4, '#ffc14d');
  dl.rect('glow', x - 1, y - 2, 2, 2, '#fff2b0');
  if (!fr.reduced && Math.random() < 0.15) {
    const spark = Math.random() < 0.35;
    particles.spawn({ x: worldX + (Math.random() - 0.5) * 4, y: y - 7, vx: (Math.random() - 0.5) * 0.1, vy: -0.25 - Math.random() * 0.2, life: 0, max: 60 + Math.random() * 40, color: spark ? '#ffb84d' : '#9aa0aa', size: 1, kind: spark ? 'spark' : 'smoke' });
  }
}

/**
 * 点光源（照多远、多亮、什么颜色）：夜里把周围的夜色照淡、染上暖色。只有 WebGPU 渲染器用，
 * 白天不点灯（营火白天也亮，但弱很多）。
 * beam 是夜里洒出来的体积光：灯泡、窗户、营火都是露在外面的光源，往四周散开（照到地面为止）
 */
const LIGHT: Record<Glow['kind'], { radius: number; intensity: number; color: string; beam: Beam }> = {
  lamp: { radius: 30, intensity: 0.9, color: '#ffd38a', beam: { dir: [0, 1], cos: -1, length: 36 } },
  window: { radius: 28, intensity: 0.8, color: '#ffc874', beam: { dir: [0, 1], cos: -1, length: 34 } },
  fire: { radius: 44, intensity: 1.2, color: '#ff9a4a', beam: { dir: [0, -1], cos: -1, length: 42 } },
};

/** 光晕和火焰画在夜色之上、角色之下（角色经过会挡光） */
export function drawGlows(fr: Frame, glows: Glow[], particles: Particles) {
  const base = fr.dark ? GLOW.night : GLOW.day;
  for (const gl of glows) {
    const flicker = gl.kind === 'fire' ? 0.85 + 0.15 * Math.sin(fr.time * 9 + gl.wx) * Math.sin(fr.time * 5.3) : gl.kind === 'lamp' ? 0.92 + 0.08 * Math.sin(fr.time * 3 + gl.wx) : 1;
    if (gl.kind === 'lamp') halo(fr.dl, 'glow', gl.x, gl.y, 11, '#ffd36a', base * flicker);
    if (gl.kind === 'window') halo(fr.dl, 'glow', gl.x, gl.y, 11, '#ffcf70', base);
    if (gl.kind === 'fire') drawFlame(fr, gl.x, gl.y, gl.wx, particles);
    const l = LIGHT[gl.kind];
    const ly = gl.kind === 'fire' ? gl.y - 3 : gl.y;
    const floor = fr.H - Math.round(heightAt(gl.wx));
    fr.dl.light(gl.x, ly, l.radius, l.intensity * flicker * (fr.dark ? 1 : gl.kind === 'fire' ? 0.25 : 0), l.color, { ...l.beam, floor });
  }
}
