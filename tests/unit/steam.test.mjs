import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_MAX, PORTRAIT_MAX, featured, hasArt, playedOn, playtime, shapeSteam } from '../../build/steam-data.mjs';

const t = (d) => Date.parse(d) / 1000;
const owned = [
  { appid: 1, name: 'A', playtime_forever: 600, rtime_last_played: t('2026-10-01') },
  { appid: 2, name: 'B', playtime_forever: 3000, rtime_last_played: t('2026-09-21') },
  { appid: 3, name: 'C', playtime_forever: 0 },
  { appid: 4, name: '隐藏的', playtime_forever: 9999 },
  { appid: 5, name: 'E', playtime_forever: 50, rtime_last_played: t('2026-11-01') },
];
const recent = [
  { appid: 1, playtime_2weeks: 120 },
  { appid: 9, name: 'Free', playtime_2weeks: 300, playtime_forever: 300 },
];

test('按总时长排序，隐藏的不出现，免费游戏从最近游玩里补上，有中文名用中文名', () => {
  const d = shapeSteam(owned, recent, [4], { 2: '乙' });
  assert.deepEqual(d.games.map((g) => g.id), [2, 1, 9, 5, 3]);
  assert.equal(d.games[0].n, '乙');
  assert.equal(d.total, 5);
  assert.equal(d.played, 4);
  assert.equal(d.games[0].last, '2026-09-21');
});

test('最近玩过：先近两周（按两周时长），再按上次游玩日期补满', () => {
  const d = shapeSteam(owned, recent, [4]);
  assert.deepEqual(d.lately, [9, 1, 5, 2]);
  assert.deepEqual(d.recent, [9, 1]);
});

test('封面：最近玩过要小横图，时长前几名竖图，其余横图，没玩过的没有', () => {
  const d = shapeSteam(owned, recent, [4]);
  assert.ok(hasArt(d, 9, 's') && hasArt(d, 2, 'p'));
  assert.ok(!hasArt(d, 3, 'h') && !hasArt(d, 3, 'p'));
  const many = Array.from({ length: 100 }, (_, i) => ({ appid: i + 1, name: `G${i}`, playtime_forever: 1000 - i }));
  const m = shapeSteam(many, []);
  assert.equal(Object.keys(m.art).length, COVER_MAX);
  assert.equal(Object.values(m.art).filter((k) => k.includes('p')).length, PORTRAIT_MAX);
  assert.equal(m.art[PORTRAIT_MAX + 1], 'h');
});

test('卡片：有最近玩过就列它们，什么都没有才列玩得最多的', () => {
  assert.equal(featured(shapeSteam(owned, recent)).kind, 'recent');
  const noTwo = shapeSteam(owned, [], [4]);
  assert.equal(featured(noTwo).kind, 'lately');
  assert.deepEqual(featured(noTwo, 2).games.map((g) => g.id), [5, 1]);
  assert.equal(featured(shapeSteam([{ appid: 7, name: 'X', playtime_forever: 9 }], [])).kind, 'top');
});

test('时长和日期显示', () => {
  assert.equal(playtime(45), '45 分钟');
  assert.equal(playtime(210), '3.5 小时');
  assert.equal(playtime(7200), '120 小时');
  const now = new Date('2026-11-09');
  assert.equal(playedOn('2026-11-08', now), '11/08');
  assert.equal(playedOn('2025-09-27', now), '2025/09/27');
});
