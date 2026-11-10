/**
 * 灯光：自发光像素（灯泡、窗格）、光晕、营火和火把的火焰，以及每种光源的点光源。
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
  halo(dl, 'halo', x, y - 3, 13, '#ffb55a', fr.dark ? GLOW.night : GLOW.day);
  dl.rect('glow', x - 3, y - 5 + flick, 6, 5 - flick, '#ff7a2a');
  dl.rect('glow', x - 1, y - 8 + flick, 3, 3, '#ff7a2a');
  dl.rect('glow', x - 2, y - 4 + (flick === 1 ? 1 : 0), 4, 4, '#ffc14d');
  dl.rect('glow', x - 1, y - 2, 2, 2, '#fff2b0');
  if (!fr.reduced && Math.random() < 0.15) {
    const spark = Math.random() < 0.35;
    particles.spawn({ x: worldX + (Math.random() - 0.5) * 4, y: y - 7, vx: (Math.random() - 0.5) * 0.1, vy: -0.25 - Math.random() * 0.2, life: 0, max: 60 + Math.random() * 40, color: spark ? '#ffb84d' : '#9aa0aa', size: 1, kind: spark ? 'spark' : 'smoke' });
  }
}

/** 火把的小火苗：3 格宽，跳动比营火快，偶尔冒一点火星 */
function drawTorch(fr: Frame, x: number, y: number, worldX: number, particles: Particles) {
  const { dl } = fr;
  const flick = fr.reduced ? 0 : Math.floor(fr.time * 12 + worldX) % 2;
  halo(dl, 'halo', x, y - 2, 9, '#ffb55a', fr.dark ? GLOW.night : GLOW.day);
  dl.rect('glow', x - 1, y - 3 + flick, 3, 3 - flick, '#ff7a2a');
  dl.rect('glow', x, y - 5 + flick, 1, 2, '#ff9a3a');
  dl.rect('glow', x, y - 2, 1, 2, '#fff2b0');
  if (!fr.reduced && Math.random() < 0.05) {
    particles.spawn({ x: worldX + (Math.random() - 0.5) * 2, y: y - 5, vx: (Math.random() - 0.5) * 0.08, vy: -0.25 - Math.random() * 0.15, life: 0, max: 40 + Math.random() * 30, color: '#ffb84d', size: 1, kind: 'spark' });
  }
}

/** 光晕的颜色和半径（只有 Canvas 2D 画；火焰类的光晕在 drawFlame / drawTorch 里） */
const HALO: Partial<Record<GlowKind, [string, number]>> = {
  lamp: ['#ffd36a', 11],
  window: ['#ffcf70', 11],
  lantern: ['#ffd38a', 9],
  pumpkin: ['#ff9a3a', 8],
  glowcap: ['#7fe8e0', 7],
};

/**
 * 点光源（照多远、多亮、什么颜色）：夜里把周围的夜色照淡、染上暖色。只有 WebGPU 渲染器用，
 * 白天不点灯（营火白天也亮，但弱很多）。
 * beam 是夜里洒出来的体积光：灯泡、窗户、营火都是露在外面的光源，往四周散开（照到地面为止）
 */
const LIGHT: Record<GlowKind, { radius: number; intensity: number; color: string; beam: Beam }> = {
  lamp: { radius: 30, intensity: 0.9, color: '#ffd38a', beam: { dir: [0, 1], cos: -1, length: 36 } },
  window: { radius: 28, intensity: 0.8, color: '#ffc874', beam: { dir: [0, 1], cos: -1, length: 34 } },
  fire: { radius: 44, intensity: 1.2, color: '#ff9a4a', beam: { dir: [0, -1], cos: -1, length: 42 } },
  torch: { radius: 32, intensity: 0.95, color: '#ffa24e', beam: { dir: [0, -1], cos: -1, length: 30 } },
  lantern: { radius: 26, intensity: 0.75, color: '#ffd38a', beam: { dir: [0, 1], cos: -1, length: 24 } },
  pumpkin: { radius: 22, intensity: 0.7, color: '#ff9a4a', beam: { dir: [0, 1], cos: -1, length: 18 } },
  glowcap: { radius: 20, intensity: 0.6, color: '#7fe8e0', beam: { dir: [0, -1], cos: -1, length: 14 } },
};
/** 火：白天也亮着（弱很多），火苗会跳 */
const FLAMES = new Set<GlowKind>(['fire', 'torch', 'pumpkin']);

/** 光晕和火焰画在夜色之上、角色之下（角色经过会挡光）。光晕单独一层，WebGPU 下不画 */
export function drawGlows(fr: Frame, glows: Glow[], particles: Particles) {
  const base = fr.dark ? GLOW.night : GLOW.day;
  for (const gl of glows) {
    const flame = FLAMES.has(gl.kind);
    const flicker = flame ? 0.85 + 0.15 * Math.sin(fr.time * 9 + gl.wx) * Math.sin(fr.time * 5.3) : gl.kind === 'window' ? 1 : 0.92 + 0.08 * Math.sin(fr.time * 3 + gl.wx);
    const h = HALO[gl.kind];
    // 路灯和窗户白天也有一圈淡淡的光晕（原来就这样）；石灯笼、南瓜灯、发光蘑菇只在夜里亮
    if (h && (fr.dark || gl.kind === 'lamp' || gl.kind === 'window')) halo(fr.dl, 'halo', gl.x, gl.y, h[1], h[0], base * flicker);
    if (gl.kind === 'fire') drawFlame(fr, gl.x, gl.y, gl.wx, particles);
    if (gl.kind === 'torch') drawTorch(fr, gl.x, gl.y, gl.wx, particles);
    const l = LIGHT[gl.kind];
    const ly = gl.kind === 'fire' ? gl.y - 3 : gl.kind === 'torch' ? gl.y - 2 : gl.y;
    const floor = fr.H - Math.round(heightAt(gl.wx));
    const day = gl.kind === 'fire' || gl.kind === 'torch' ? 0.25 : 0;
    fr.dl.light(gl.x, ly, l.radius, l.intensity * flicker * (fr.dark ? 1 : day), l.color, { ...l.beam, floor });
  }
}
