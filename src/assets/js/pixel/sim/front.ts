/**
 * 镜头前的前景：每一屏放几株放大的植物，用这一屏群系自己的植被：
 * 左边一棵树（下半截出画）、右边一丛灌木，底下靠里各一丛草或花（没有就用石头），压住快捷栏的两头；
 * 屏幕宽的时候，左上再垂下一团树冠（只取树的上半截，大半在画外），压住卡片的左上角；
 * 右上是太阳 / 月亮和镜头光斑的位置，不放。
 * 前景画在卡片上面、糊得很厉害，压在 UI 上反而显出远近；卡片中间的正文挡不到。
 * 视差比主平面快，翻页时从屏幕边上扫过去。
 * 画在 front 层（单独一张压在卡片上面的画布），渲染器会把它糊得很厉害。
 * 整组按整格画，剩下的小数写进 dl.shift，渲染器合成时补上，移动是连续的。
 */
import type { Sprite } from '../atlas.js';
import { SECTION, biomeOf, type Biome } from './biomes.js';
import type { Scenery } from './scenery.js';
import type { Frame } from './frame.js';

const SPEED = 1.4; // 视差：比主平面快多少
const SCALE = 2;
const CANOPY = 3; // 垂下来的树冠放大几倍
const CANOPY_MIN_W = 200; // 屏幕至少这么宽（逻辑像素）才垂树冠

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
    // [精灵, 中心 x, 底边 y, 放大几倍]
    const items: [Sprite | null, number, number, number][] = [
      [pick(b, sc, [0, 1]), HALF * 0.1, H + 22, SCALE], // 左边：大树，下半截出画
      [pick(b, sc, [3, 2]), HALF * 0.72, H + 4, SCALE + 1], // 左边靠里：一丛草或花，压住快捷栏左头
      [pick(b, sc, [3, 2]), HALF * 1.28, H + 4, SCALE + 1], // 右边靠里
      [pick(b, sc, [2, 3, 1]), HALF * 1.86, H + 4, SCALE], // 右边：灌木
    ];
    for (const [sp, cx, bottom, k] of items) {
      if (!sp) continue;
      const w = sp.width * k;
      const h = sp.height * k;
      const x = Math.round(cx - w / 2) + shift;
      if (x > W || x + w < 0) continue;
      dl.sprite('front', sp, x, bottom - h, { w, h });
    }
    // 垂下来的树冠：只有长树的群系，屏幕够宽（窄屏上卡片占满宽度，会挡到正文）
    const tree = b.flora.some((f) => f.z === 0) ? pick(b, sc, [0]) : null;
    if (tree && W >= CANOPY_MIN_W) {
      const part = Math.round(tree.height * 0.6);
      const w = tree.width * CANOPY;
      const h = part * CANOPY;
      const x = Math.round(HALF * 0.45 - w / 2) + shift;
      if (x <= W && x + w >= 0) dl.sprite('front', tree, x, -Math.round(h * 0.7), { w, h, part: [0, 0, tree.width, part] });
    }
  }
}
