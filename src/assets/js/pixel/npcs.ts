/**
 * 彩蛋角色：小屋里的女孩、草堆里的彩狸猫。精灵来自图集 atlas.png。
 */
import { sprite } from './atlas.js';
import type { Sprite } from './sprites.js';

export interface GirlFrames {
  idle: Sprite;
  walk: [Sprite, Sprite];
  wave: [Sprite, Sprite];
}

export function buildGirl(flip: boolean): GirlFrames {
  const p = flip ? 'girl.l' : 'girl.r';
  return {
    idle: sprite(`${p}.idle`),
    walk: [sprite(`${p}.walk.0`), sprite(`${p}.walk.1`)],
    wave: [sprite(`${p}.wave.0`), sprite(`${p}.wave.1`)],
  };
}

export interface CatFrames {
  sit: Sprite;
  tail: Sprite;
  blink: Sprite;
  jump: Sprite;
}

/** 猫只有朝左的一套（从草堆里往左跳出来） */
export function buildCat(_flip = true): CatFrames {
  return { sit: sprite('cat.l.sit'), tail: sprite('cat.l.tail'), blink: sprite('cat.l.blink'), jump: sprite('cat.l.jump') };
}
