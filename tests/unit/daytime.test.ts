import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daytime, nightAt } from '../../src/assets/js/pixel/sim/daytime.ts';
import { rgb } from '../../src/assets/js/pixel/sim/util.ts';

const dist = (a: string, b: string) => {
  const [p, q] = [rgb(a), rgb(b)];
  return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
};

test('一整天都是连续的：每过一分钟，夜色、天色、光色、环境光、日月的位置和亮度都只变一点点，没有在 6 点、18 点一下跳过去', () => {
  let prev = daytime(0);
  for (let m = 1; m <= 24 * 60; m++) {
    const cur = daytime(m / 60);
    const at = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    assert.ok(Math.abs(cur.night - prev.night) < 0.03, `${at} 夜色跳了：${prev.night} -> ${cur.night}`);
    for (const k of ['skyTop', 'skyHorizon', 'light', 'ambient'] as const) assert.ok(dist(cur[k], prev[k]) <= 6, `${at} ${k} 跳了：${prev[k]} -> ${cur[k]}`);
    assert.ok(Math.abs(cur.moon.alpha - prev.moon.alpha) < 0.03, `${at} 月亮一下亮了`);
    assert.ok(Math.abs(cur.rays - prev.rays) < 0.03 && Math.abs(cur.shadow.alpha - prev.shadow.alpha) < 0.01, `${at} 体积光或影子跳了`);
    // 太阳的弧过了半夜从 1.5 绕回 -0.5，那时它在地平线很深的下面，看不见，不算跳
    if (m % (24 * 60) !== 0) assert.ok(Math.abs(cur.sun.arc - prev.sun.arc) < 0.01, `${at} 太阳跳了`);
    prev = cur;
  }
});

test('白天没有夜色、夜里全黑，晨昏在 5-7 点和 17-19 点之间过渡，正中间（6 点、18 点）一半', () => {
  assert.equal(nightAt(12), 0);
  assert.equal(nightAt(2), 1);
  assert.equal(nightAt(22), 1);
  assert.ok(Math.abs(nightAt(18) - 0.5) < 1e-9 && Math.abs(nightAt(6) - 0.5) < 1e-9);
  assert.ok(nightAt(17.5) > 0 && nightAt(17.5) < 0.5 && nightAt(18.5) > 0.5 && nightAt(18.5) < 1);
});

test('太阳 6 点从左边升起、18 点落到右边，之后沉到地平线下；月亮 18 点升起，随夜色浮现', () => {
  assert.ok(Math.abs(daytime(6).sun.arc) < 1e-9 && Math.abs(daytime(18).sun.arc - 1) < 1e-9);
  assert.ok(daytime(19).sun.arc > 1 && daytime(5).sun.arc < 0);
  assert.ok(Math.abs(daytime(18).moon.arc) < 1e-9 && Math.abs(daytime(6).moon.arc - 1) < 1e-9);
  assert.equal(daytime(12).moon.alpha, 0);
  assert.equal(daytime(0).moon.alpha, 1);
});
