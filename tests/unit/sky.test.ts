import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSky } from '../../src/assets/js/pixel/sim/sky.ts';
import { daytime } from '../../src/assets/js/pixel/sim/daytime.ts';
import { DrawList } from '../../src/assets/js/pixel/drawlist.ts';
import type { Frame } from '../../src/assets/js/pixel/sim/frame.ts';

function frame(camX: number, dark: boolean): Frame {
  return { dl: new DrawList(), W: 300, H: 180, S: 5, HALF: 150, camX, camLeft: Math.floor(camX - 150), frac: 0, p: 0, dark, time: 0, reduced: false, running: false, visH: 180, day: daytime(dark ? 22 : 12, dark) } as Frame;
}

/** 日月显示在哪：按整格画的位置加上天空层的亚像素偏移 */
function shown(camX: number, dark: boolean) {
  const fr = frame(camX, dark);
  drawSky(fr, []);
  return fr.dl.sun[0] + (fr.dl.shift.sky ?? 0);
}

test('日月按整格画、视差的小数交给 shift：翻页时显示位置连续地滑过去，不隔几帧跳一格', () => {
  for (const dark of [false, true]) {
    let prev = shown(1000, dark);
    for (let k = 1; k <= 200; k++) {
      const cur = shown(1000 + k * 0.5, dark);
      assert.ok(Math.abs(cur - prev + 0.5 * 0.012) < 1e-9, `${dark ? '月亮' : '太阳'}第 ${k} 步跳了：${prev} -> ${cur}`);
      prev = cur;
    }
  }
});
