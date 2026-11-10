/**
 * 风滚草：沙漠里被风吹着往左滚的几团枯草，一跳一跳地贴着地面走，滚出这一屏就从另一边回来。
 * 不存状态：每团的位置按编号和时间算；滚过四分之一圈换一帧（图集里的 4 帧每帧转 90 度）。
 * 画在 fg 层（跟着入夜），在布景之后、地面之前，底边和布景一样陷进地面一格。
 */
import { SECTION, biomeOf, heightAt } from './biomes.js';
import type { Scenery } from './scenery.js';
import { hash } from './sprites.js';
import type { Frame } from './frame.js';

export function drawTumbleweeds(fr: Frame, sc: Scenery) {
  const { dl, H, W, camLeft } = fr;
  const frames = sc.tumbleweed;
  if (!frames.length) return;
  const t = fr.reduced ? 0 : fr.time;
  const size = frames[0].width;
  const quarter = (Math.PI * size) / 4; // 滚四分之一圈走多远
  const s0 = Math.floor((camLeft - SECTION / 2) / SECTION);
  const s1 = Math.ceil((camLeft + W + SECTION / 2) / SECTION);
  for (let s = s0; s <= s1; s++) {
    const n = biomeOf(s)?.tumbleweeds ?? 0;
    for (let i = 0; i < n; i++) {
      const seed = s * 31 + i * 7;
      const speed = 9 + hash(seed) * 7; // 逻辑像素 / 秒
      const travelled = hash(seed + 1) * SECTION + t * speed;
      // 在这一屏的范围里从右往左滚，出了左边从右边回来
      const wx = s * SECTION + SECTION / 2 - (travelled % SECTION);
      const x = Math.round(wx - size / 2 - camLeft);
      if (x > W || x + size < 0) continue;
      const hop = Math.round(Math.abs(Math.sin((travelled / quarter) * 0.9 + i)) * 3);
      const y = H - Math.round(heightAt(wx)) + 1 - size - hop;
      // 往左滚是逆时针：帧号倒着走
      const f = (4 - (Math.floor(travelled / quarter) % 4)) % 4;
      dl.sprite('fg', frames[f], x, y);
    }
  }
}
