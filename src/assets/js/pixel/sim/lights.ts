/**
 * 灯光：自发光像素（灯泡、窗格）、营火的火焰，以及每处光源的点光源（渲染器拿来照亮夜色、洒出光束）。
 *
 * 所有会发光的东西都是同一套做法，没有别的特例：
 *   本体照常画在自己的层里；
 *   亮着的像素再画进自发光层（emissive：sprite 的 #glow 遮罩，或直接画那几格），渲染器拿它做辉光；营火火焰在 glow 层，按 emit 倍数发光；
 *   照亮周围的光是点光源（dl.light），夜里路灯、窗户、营火还从点光源洒出光束。
 * 孔明灯（lanterns.ts）、烟花（festive.ts）、萤火虫和火星（particles.ts）也都按这套来。
 */
import type { Sprite } from '../atlas.js';
import type { Beam } from '../drawlist.js';
import { heightAt, type GlowKind } from './biomes.js';
import type { Particles } from './particles.js';
import type { Frame } from './frame.js';

export interface Glow {
  x: number; // 屏幕坐标（逻辑像素）
  y: number;
  kind: GlowKind;
  wx: number; // 世界坐标：灯的闪烁相位、火星的生成位置
}

/** 物体画进前景时同步维护自发光层：先擦掉它挡住的光，再画它自己的发光像素 */
export function emit(fr: Frame, sp: Sprite, x: number, y: number) {
  if (!fr.dark) return;
  fr.dl.sprite('emissive', sp, x, y, { erase: true });
  if (sp.glow) fr.dl.sprite('emissive', sp, x, y, { glow: true });
}

function drawFlame(fr: Frame, x: number, y: number, worldX: number, particles: Particles) {
  const { dl } = fr;
  const flick = fr.reduced ? 0 : Math.floor(fr.time * 10) % 3;
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
 * 点光源（照多远、多亮、什么颜色）：加在环境光上照亮周围、染上灯的颜色。
 * 白天路灯和窗户不亮；营火白天照样烧，只是比夜里弱一些（FIRE_DAY）。
 * beam 是夜里洒出来的体积光：灯泡、窗户、营火都是露在外面的光源，往四周散开（照到地面为止）
 */
const LIGHT: Record<GlowKind, { radius: number; intensity: number; color: string; beam: Beam }> = {
  lamp: { radius: 30, intensity: 0.9, color: '#ffd38a', beam: { dir: [0, 1], cos: -1, length: 36 } },
  window: { radius: 28, intensity: 0.8, color: '#ffc874', beam: { dir: [0, 1], cos: -1, length: 34 } },
  fire: { radius: 44, intensity: 1.2, color: '#ff9a4a', beam: { dir: [0, -1], cos: -1, length: 42 } },
};
/** 营火白天照亮周围的光是夜里的几成 */
const FIRE_DAY = 0.5;

/** 营火的火焰（画在夜色之上、角色之下，角色经过会挡光）和每处光源的点光源 */
export function drawGlows(fr: Frame, glows: Glow[], particles: Particles) {
  for (const gl of glows) {
    const flicker = gl.kind === 'fire' ? 0.85 + 0.15 * Math.sin(fr.time * 9 + gl.wx) * Math.sin(fr.time * 5.3) : gl.kind === 'lamp' ? 0.92 + 0.08 * Math.sin(fr.time * 3 + gl.wx) : 1;
    if (gl.kind === 'fire') drawFlame(fr, gl.x, gl.y, gl.wx, particles);
    const l = LIGHT[gl.kind];
    const ly = gl.kind === 'fire' ? gl.y - 3 : gl.y;
    const floor = fr.H - Math.round(heightAt(gl.wx));
    fr.dl.light(gl.x, ly, l.radius, l.intensity * flicker * (fr.dark ? 1 : gl.kind === 'fire' ? FIRE_DAY : 0), l.color, { ...l.beam, floor });
  }
}
