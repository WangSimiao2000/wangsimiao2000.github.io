/**
 * 后排树：树线剪影和主平面之间一排真正的树（用这一带群系自己的树），让景深有个中间层次。
 * 走得比主平面慢（视差 SPEED），站得比主平面的地面高几格，看起来在后面；疏密跟着群系的 treeline 走，
 * 森林、樱花林、秋林密，沙漠没有。画在 back 层：只有 WebGPU 渲染器合成，会糊一点、跟着入夜。
 * 同一个槽位永远长同一棵树（确定性哈希），镜头来回走不会闪。
 */
import { BIOMES, heightAt, weights } from './biomes.js';
import type { Scenery } from './scenery.js';
import { hash } from './sprites.js';
import type { Frame } from './frame.js';

const SPEED = 0.85;
const SPACING = 15; // 槽位间距（后排的坐标）
const RISE = 4; // 比主平面的地面高几格
const DENSITY = 0.6; // treeline = 1 的群系里，一个槽位长树的概率

export function drawBackRow(fr: Frame, sc: Scenery) {
  const { dl, W, H, HALF, camX } = fr;
  // 后排坐标 bx 落在屏幕上的 x = bx - camX * SPEED + HALF
  const left = camX * SPEED - HALF - 40;
  const right = left + W + 80;
  for (let s = Math.floor(left / SPACING); s <= Math.ceil(right / SPACING); s++) {
    const bx = s * SPACING + Math.floor(hash(s * 1.37 + 5.1) * 8);
    const sx = bx - camX * SPEED + HALF;
    // 这棵树出现在屏幕上时，它脚下主平面那一带是哪个群系，就长那个群系的树
    const wx = camX + (sx - HALF);
    const [i, j, t] = weights(wx);
    const b = BIOMES[hash(s * 2.11 + 0.7) < t ? j : i];
    if (hash(s * 3.71 + 1.3) > b.treeline * DENSITY) continue;
    const kinds = b.flora.filter((f) => f.z === 0);
    if (!kinds.length) continue;
    const kind = kinds[Math.floor(hash(s * 5.3 + 2.2) * kinds.length)].kind;
    const set = sc[kind];
    const sp = set[Math.floor(hash(s * 7.9 + 3.3) * set.length)];
    const x = Math.round(sx - sp.width / 2);
    if (x > W || x + sp.width < 0) continue;
    const bottom = H - Math.round(heightAt(wx)) - RISE;
    dl.sprite('back', sp, x, bottom - sp.height);
  }
}
