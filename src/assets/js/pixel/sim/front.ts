/**
 * 镜头前的前景：每一屏放几株放大两倍的植物，用这一屏群系自己的植被：
 * 左边一棵树（下半截出画）、右边一丛灌木，两边靠里一点再各放一小丛草或花（没有就用石头）。
 * 视差比主平面快，翻页时从屏幕边上扫过去；停在一屏时贴着左右两边，不挡卡片中间和底部的快捷栏。
 * 画在 front 层（单独一张压在卡片上面的画布），渲染器会把它糊得很厉害。
 * 整组按整格画，剩下的小数写进 dl.shift，渲染器合成时补上，移动是连续的。
 */
import type { Sprite } from '../atlas.js';
import { SECTION, biomeOf, type Biome } from './biomes.js';
import type { Scenery } from './scenery.js';
import type { Frame } from './frame.js';

const SPEED = 1.4; // 视差：比主平面快多少
const SCALE = 2;

/** 这个群系植被表里第一个 z 在 zs 里的那种，取最大的一个变体；都没有就返回 null */
function pick(b: Biome, sc: Scenery, zs: number[]): Sprite | null {
  for (const z of zs) {
    const f = b.flora.find((x) => x.z === z);
    if (f) {
      const set = sc[f.kind];
      return set[set.length - 1];
    }
  }
  return null;
}

export function drawFront(fr: Frame, sc: Scenery) {
  const { dl, W, H, HALF, camX } = fr;
  const here = Math.round(camX / SECTION);
  for (let s = here - 1; s <= here + 1; s++) {
    const b = biomeOf(s);
    if (!b) continue;
    // 相机离这一屏中心多远（屏幕上的距离）：整格部分画进去，小数部分交给渲染器
    const exact = -(camX - s * SECTION) * SPEED;
    const shift = Math.floor(exact);
    if (s === here) dl.shift.front = exact - shift;
    const items: [Sprite | null, number, number][] = [
      [pick(b, sc, [0, 1]), HALF * 0.06, H + 22], // 左边：大树，下半截出画
      [pick(b, sc, [3, 2]), HALF * 0.34, H + 3], // 左边靠里：一小丛草或花
      [pick(b, sc, [3, 2]), HALF * 1.66, H + 3], // 右边靠里
      [pick(b, sc, [2, 3, 1]), HALF * 1.9, H + 4], // 右边：灌木
    ];
    for (const [sp, cx, bottom] of items) {
      if (!sp) continue;
      const w = sp.width * SCALE;
      const h = sp.height * SCALE;
      const x = Math.round(cx - w / 2) + shift;
      if (x > W || x + w < 0) continue;
      dl.sprite('front', sp, x, bottom - h, { w, h });
    }
  }
}
