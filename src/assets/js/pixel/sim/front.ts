/**
 * 镜头前的前景：每一屏的两边各放一株放大两倍的植物（左边一棵树、右边一丛灌木），用这一屏群系自己的植被。
 * 视差比主平面快，翻页时从屏幕边上扫过去；停在一屏时贴着左右两边，不挡卡片中间和底部的快捷栏。
 * 画在 front 层（单独一张压在卡片上面的画布），渲染器会把它糊得很厉害。
 */
import type { Sprite } from '../atlas.js';
import { SECTION, biomeOf, type Biome } from './biomes.js';
import type { Scenery } from './scenery.js';
import type { Frame } from './frame.js';

const SPEED = 1.4; // 视差：比主平面快多少
const SCALE = 2;

/** 这个群系用哪种树、哪种灌木（植被表里第一个 z = 0 / z = 2 的，没有就退回去用别的） */
function picks(b: Biome, sc: Scenery): [Sprite, Sprite] {
  const tree = b.flora.find((f) => f.z === 0) ?? b.flora.find((f) => f.z === 1) ?? b.flora[0];
  const bush = b.flora.find((f) => f.z === 2) ?? b.flora[b.flora.length - 1];
  const t = sc[tree.kind];
  const s = sc[bush.kind];
  return [t[t.length - 1], s[s.length - 1]];
}

export function drawFront(fr: Frame, sc: Scenery) {
  const { dl, W, H, HALF, camX } = fr;
  const here = Math.round(camX / SECTION);
  for (let s = here - 1; s <= here + 1; s++) {
    const b = biomeOf(s);
    if (!b) continue;
    const d = (camX - s * SECTION) * SPEED; // 相机离这一屏中心多远（屏幕上的距离）
    const [tree, bush] = picks(b, sc);
    const items: [Sprite, number, number][] = [
      [tree, HALF - HALF * 0.94, H + 22], // 左边：大树，下半截出画
      [bush, HALF + HALF * 0.9, H + 4], // 右边：灌木
    ];
    for (const [sp, cx, bottom] of items) {
      const w = sp.width * SCALE;
      const h = sp.height * SCALE;
      const x = Math.round(cx - d - w / 2);
      if (x > W || x + w < 0) continue;
      dl.sprite('front', sp, x, bottom - h, { w, h });
    }
  }
}
