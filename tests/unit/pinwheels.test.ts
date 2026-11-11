import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PINWHEELS, pinwheelDx } from '../../src/assets/js/pixel/sim/pinwheels.ts';
import { SECTION } from '../../src/assets/js/pixel/sim/biomes.ts';

test('风车插在友链板块里：不占小人脚下和路牌，彼此不挤在一起，最多的时候也不排到邻近板块', () => {
  const xs = Array.from({ length: MAX_PINWHEELS }, (_, i) => pinwheelDx(i));
  for (const x of xs) {
    assert.ok(Math.abs(x) >= 24, `风车 ${x} 挡在小人脚下`);
    assert.ok(x > -24 || x < -40, `风车 ${x} 挡住路牌`);
    assert.ok(Math.abs(x) < SECTION / 2 - 8, `风车 ${x} 排到邻近板块去了`);
  }
  const sorted = [...xs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= 13, `风车 ${sorted[i - 1]} 和 ${sorted[i]} 挤在一起`);
});

test('风车左右交替排开，前几个离中心最近（友链少的时候也在画面里）', () => {
  assert.ok(pinwheelDx(0) > 0 && pinwheelDx(1) < 0);
  assert.ok(Math.abs(pinwheelDx(0)) < Math.abs(pinwheelDx(2)));
  assert.ok(Math.abs(pinwheelDx(1)) < Math.abs(pinwheelDx(3)));
});

test('风车头按角度现画：四种颜色都在、不出杆子图的范围、中间有钉子；转一档形状就变，转一圈回到原样', async () => {
  const { pinwheelHead } = await import('../../src/assets/js/pixel/sim/pinwheels.ts');
  const STEPS = 32;
  const shape = (s: number) => pinwheelHead(s).map(([x, y, c]) => `${x},${y},${c}`).sort().join(' ');
  for (let s = 0; s < STEPS; s++) {
    const px = pinwheelHead(s);
    assert.ok(px.length > 40, `第 ${s} 档只有 ${px.length} 个像素`);
    for (const [x, y] of px) assert.ok(x >= 0 && x < 13 && y >= 0 && y < 13, `第 ${s} 档有像素画到 (${x},${y})，出了 13×13`);
    for (const tones of [['#f68476', '#de5248', '#b03434'], ['#ffe080', '#f2be48', '#cc922e'], ['#80baf0', '#4c8ed6', '#3466aa'], ['#8cd688', '#58b060', '#3c8848']])
      assert.ok(px.some(([, , col]) => tones.includes(col)), `第 ${s} 档缺了一片叶片（${tones[1]}）`);
    assert.ok(px.some(([x, y]) => x === 6 && y === 6), `第 ${s} 档中心没有钉子`);
    assert.notEqual(shape(s), shape(s + 1), `第 ${s} 档和下一档一模一样，看不出在转`);
  }
  assert.equal(shape(0), shape(STEPS), '转一圈应该回到原样');
});
