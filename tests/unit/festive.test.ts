import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBirthday, todayKey } from '../../src/assets/js/pixel/festive.ts';
import { lanternX } from '../../src/assets/js/pixel/lanterns.ts';
import { SECTION } from '../../src/assets/js/pixel/biomes.ts';

test('生日按访客本地日期判断：11 月 6 日当天才算', () => {
  assert.equal(todayKey(new Date(2026, 10, 6, 0, 5), ''), '11-06');
  assert.equal(todayKey(new Date(2026, 10, 5, 23, 59), ''), '11-05');
  assert.equal(isBirthday(todayKey(new Date(2027, 10, 6, 12), '')), true);
  assert.equal(isBirthday(todayKey(new Date(2026, 9, 20), '')), false);
});

test('?date=MM-DD 可以预览别的日子，格式不对就忽略', () => {
  assert.equal(todayKey(new Date(2026, 9, 20), '?date=11-06'), '11-06');
  assert.equal(todayKey(new Date(2026, 9, 20), '?date=1106'), '10-20');
  assert.equal(todayKey(new Date(2026, 9, 20), '?date=<x>'), '10-20');
});

test('孔明灯左右交替放在卡片两侧，窄屏收进屏幕里，都不挡主角', () => {
  for (const W of [100, 320, 480]) {
    for (const n of [1, 2, 7, 24]) {
      const xs = Array.from({ length: n }, (_, i) => lanternX(i, n, W) + SECTION);
      assert.ok(xs.every((d) => Math.abs(d) <= Math.min(150, W / 2 - 8) + 1e-9), `W=${W} 都在屏幕里`);
      assert.ok(xs.every((d) => Math.abs(d) >= 15), '主角头顶留空');
      if (n > 1) assert.ok(xs.some((d) => d < 0) && xs.some((d) => d > 0), '两侧都有');
    }
  }
  assert.ok(Math.abs(lanternX(0, 1, 320) + SECTION) >= 100, '宽屏上在卡片外面');
});
