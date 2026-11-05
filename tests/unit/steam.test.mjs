import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_MAX, featured, playtime, shapeSteam } from '../../build/steam-data.mjs';

const owned = [
  { appid: 1, name: 'A', playtime_forever: 600 },
  { appid: 2, name: 'B', playtime_forever: 3000, rtime_last_played: 1790000000 },
  { appid: 3, name: 'C', playtime_forever: 0 },
  { appid: 4, name: '隐藏的', playtime_forever: 9999 },
];
const recent = [
  { appid: 1, playtime_2weeks: 120 },
  { appid: 2, playtime_2weeks: 300 },
  { appid: 9, name: '免费游戏', playtime_2weeks: 30, playtime_forever: 30 },
];

test('按总时长排序，隐藏列表里的不出现，免费游戏从最近游玩里补上', () => {
  const d = shapeSteam(owned, recent, [4]);
  assert.deepEqual(d.games.map((g) => g.id), [2, 1, 3, 9]);
  assert.equal(d.total, 4);
  assert.equal(d.played, 3);
  assert.equal(d.minutes, 3630);
  assert.equal(d.games[0].last, '2026-09-21');
});

test('最近在玩按两周时长排，封面先给最近在玩的，没玩过的不要封面', () => {
  const d = shapeSteam(owned, recent, [4]);
  assert.deepEqual(d.recent, [2, 1, 9]);
  assert.ok(!d.covers.includes(3));
  assert.deepEqual(d.covers.slice(0, 3), [2, 1, 9]);
  const many = Array.from({ length: 100 }, (_, i) => ({ appid: i + 1, name: `G${i}`, playtime_forever: 100 + i }));
  assert.equal(shapeSteam(many, []).covers.length, COVER_MAX);
});

test('卡片：最近两周没玩就列玩得最多的', () => {
  assert.equal(featured(shapeSteam(owned, recent)).kind, 'recent');
  const f = featured(shapeSteam(owned, [], [4]), 2);
  assert.equal(f.kind, 'top');
  assert.deepEqual(f.games.map((g) => g.id), [2, 1]);
});

test('时长显示', () => {
  assert.equal(playtime(45), '45 分钟');
  assert.equal(playtime(210), '3.5 小时');
  assert.equal(playtime(7200), '120 小时');
});
