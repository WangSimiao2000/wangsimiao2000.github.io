/**
 * 主角的精灵帧（来自图集 atlas.png，见 atlas.ts）和通用的确定性哈希。
 * 源图只画了朝右的一套，朝左的由打包脚本水平翻转生成。
 */
import { sprite, sprites, type Sprite } from './atlas.js';

export type { Sprite };

export interface CharacterFrames {
  idle: [Sprite, Sprite]; // [睁眼, 眨眼]
  run: Sprite[]; // 4 帧
  sit: Sprite[]; // [看书, 眨眼, 翻页]
}

export function buildCharacter(flip: boolean): CharacterFrames {
  const p = flip ? 'hero.l' : 'hero.r';
  return { idle: [sprite(`${p}.idle.0`), sprite(`${p}.idle.1`)], run: sprites(`${p}.run`), sit: sprites(`${p}.sit`) };
}

/** 确定性哈希随机数 [0,1) */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
