/**
 * 后排：树线剪影和主平面之间的一条地面，上面长着这一带群系自己的植被（树、灌木、石头、草、花，
 * 和主平面用同一张植被表），给景深一个中间层次。
 * 整排走得比主平面慢（视差 SPEED），地面比主平面高 RISE 格，从主平面的地面后面露出一条草地，植被就长在这条草地上。
 * 画在 back 层：只有 WebGPU 渲染器合成，会糊、跟着入夜。
 *
 * 后排有自己的坐标 bx（屏幕上的位置 = bx - camX * SPEED + 视口中心）。地面高度、群系、长什么都只按 bx 算，
 * 镜头怎么动都不变，翻页时不会上下跳、换品种。bx / SPEED 对应主平面的世界坐标：
 * 镜头停在哪一屏，屏幕正中的后排就是那一屏的群系，地面也在板块中心附近压平。
 * 按整格画，剩下的小数写进 dl.shift，渲染器合成时补上，移动是连续的。
 */
import { BIOMES, SLOT, heightAt, paletteAt, weights } from './biomes.js';
import type { Scenery } from './scenery.js';
import { hash } from './sprites.js';
import type { Frame } from './frame.js';

const SPEED = 0.85;
const RISE = 5; // 地面比主平面高几格

/** 后排地面在 bx 处离画布底边的高度 */
const groundAt = (bx: number) => Math.round(heightAt(bx / SPEED)) + RISE;

export function drawBackRow(fr: Frame, sc: Scenery) {
  const { dl, W, H, HALF, camX, frac } = fr;
  // 画布 x 对应的后排坐标。世界画布整体往左挪了 frac（亚像素平移），这里补回来
  const exact = camX * SPEED - HALF - frac;
  const origin = Math.floor(exact);
  dl.shift.back = origin - exact;

  // 地面：描边、受光线、表层、表层底部，下面一直填到底（被主平面的地面盖住）
  for (let x = 0; x < W; x++) {
    const bx = x + origin;
    const top = H - groundAt(bx);
    const pal = paletteAt(bx / SPEED);
    dl.rect('back', x, top, 1, 1, pal.line);
    dl.rect('back', x, top + 1, 1, 1, pal.rim);
    dl.rect('back', x, top + 2, 1, 3, pal.top);
    dl.rect('back', x, top + 5, 1, H - top - 5, pal.shade);
  }

  // 植被：和主平面一样按槽位、按群系的植被表挑；先画大的（树），再画小的（草、花），小的在前面
  const items: { z: number; x: number; y: number; sp: Scenery['oak'][number] }[] = [];
  for (let s = Math.floor((origin - 40) / SLOT); s <= Math.ceil((origin + W + 40) / SLOT); s++) {
    const bx = s * SLOT + Math.floor(hash(s * 1.37 + 5.1) * 6);
    const [i, j, t] = weights(bx / SPEED);
    const b = BIOMES[hash(s * 2.11 + 0.7) < t ? j : i];
    const r = hash(s * 3.71 + 1.3);
    const fl = b.flora.find((f) => r < f.until);
    if (!fl) continue;
    const set = sc[fl.kind];
    const sp = set[Math.floor(hash(s * 7.9 + 3.3) * set.length)];
    const x = bx - origin - Math.floor(sp.width / 2);
    if (x > W || x + sp.width < 0) continue;
    const bottom = H - groundAt(bx) + 2; // 底边陷进地面描边下面一格，和主平面的布景一样不悬空
    items.push({ z: fl.z, x, y: bottom - sp.height, sp });
  }
  items.sort((p, q) => p.z - q.z || p.x - q.x);
  for (const it of items) dl.sprite('back', it.sp, it.x, it.y);
}
