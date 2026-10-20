import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBirthday, todayKey } from '../../src/assets/js/pixel/festive.ts';
import { Lanterns } from '../../src/assets/js/pixel/lanterns.ts';
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

test('灯笼均匀挂在秋林那段绳子两侧，正中间（主角头顶）留空', () => {
  const one = Lanterns.slot(0, 1);
  assert.ok(Math.abs(one.wx + SECTION) >= 10, '只有一盏也不挂在主角头顶');
  for (const n of [2, 7, 24]) {
    const xs = Array.from({ length: n }, (_, i) => Lanterns.slot(i, n));
    for (let i = 1; i < n; i++) assert.ok(xs[i].wx > xs[i - 1].wx, '从左到右排');
    assert.ok(xs.every((s) => Math.abs(s.wx + SECTION) <= 70), '都在秋林那一段');
    assert.ok(xs.every((s) => Math.abs(s.wx + SECTION) >= 10), '中间留空');
  }
});
