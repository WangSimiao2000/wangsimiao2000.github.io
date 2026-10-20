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

test('灯笼均匀挂在秋林中间那段绳子上，中间垂得最低', () => {
  const one = Lanterns.slot(0, 1);
  assert.equal(one.wx, -SECTION);
  const n = 7;
  const xs = Array.from({ length: n }, (_, i) => Lanterns.slot(i, n));
  for (let i = 1; i < n; i++) assert.ok(xs[i].wx > xs[i - 1].wx, '从左到右排');
  assert.ok(xs.every((s) => Math.abs(s.wx + SECTION) <= 70), '都在秋林那一段');
  assert.ok(xs[3].sag >= xs[0].sag && xs[3].sag >= xs[6].sag, '中间最低');
});
