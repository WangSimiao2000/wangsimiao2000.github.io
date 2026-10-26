/**
 * 彩蛋角色：小屋里的女孩、草堆里的彩狸猫。精灵来自图集 atlas.png。
 * 女孩源图只画了朝右的一套，朝左的由打包脚本翻转生成。
 */
import { sprite, sprites } from './atlas.js';
import type { Sprite } from './sprites.js';

export interface GirlFrames {
  idle: Sprite;
  walk: Sprite[];
  wave: Sprite;
}

export function buildGirl(flip: boolean): GirlFrames {
  const p = flip ? 'girl.l' : 'girl.r';
  return { idle: sprite(`${p}.idle`), walk: sprites(`${p}.walk`), wave: sprite(`${p}.wave.0`) };
}

export interface CatFrames {
  /** 坐着甩尾巴的循环 */
  idle: Sprite[];
  blink: Sprite;
  jump: Sprite;
}

/** 猫只有朝左的一套（从草堆里往左跳出来） */
export function buildCat(): CatFrames {
  return { idle: sprites('cat.l.idle'), blink: sprite('cat.l.blink'), jump: sprite('cat.l.jump') };
}
