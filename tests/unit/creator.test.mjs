import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compact, mixinKey, shapeCalendar, signWbi, sumPlays, wbiKey } from '../../build/creator-data.mjs';

test('wbi 签名：和 B 站文档里的示例一致', () => {
  // 示例来自社区整理的 bilibili-API-collect 文档（wbi 签名一节）
  const img = wbiKey('https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png');
  const sub = wbiKey('https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png');
  assert.equal(img, '7cd084941338484aae1ad9425b84077c');
  assert.equal(mixinKey(img, sub), 'ea1db124af3c7062474693fa704f4ff8');
  assert.equal(
    signWbi({ foo: '114', bar: '514', zab: 1919810 }, img, sub, 1702204169),
    'bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4',
  );
});

test('签名前去掉值里的 !\'()*', () => {
  assert.match(signWbi({ q: "a!b'c(d)e*f" }, 'x'.repeat(32), 'y'.repeat(32), 1), /^q=abcdef&wts=1&w_rid=/);
});

test('总播放量：把视频列表加起来，缺的按 0', () => {
  assert.equal(sumPlays([{ play: 100 }, { play: '20' }, { play: '--' }, {}]), 120);
});

test('贡献格子：总数、有提交的天数、最长连续和当前连续（今天没提交不算断）', () => {
  const day = (date, n) => ({ date, contributionCount: n, contributionLevel: n ? 'SECOND_QUARTILE' : 'NONE' });
  const weeks = [
    { contributionDays: [day('2026-11-03', 0), day('2026-11-04', 2), day('2026-11-05', 1), day('2026-11-06', 3), day('2026-11-07', 0)] },
    { contributionDays: [day('2026-11-08', 1), day('2026-11-09', 0)] },
  ];
  const c = shapeCalendar(weeks);
  assert.equal(c.total, 7);
  assert.equal(c.activeDays, 4);
  assert.equal(c.longest, 3);
  assert.equal(c.current, 1);
  assert.equal(c.firstDow, 2); // 2026-11-03 是周二
  assert.deepEqual(c.weeks[1], [[2, 1], [0, 0]]);
});

test('数字简写', () => {
  assert.equal(compact(24417), '2.4 万');
  assert.equal(compact(5763993), '576.4 万');
  assert.equal(compact(9876), '9,876');
});
