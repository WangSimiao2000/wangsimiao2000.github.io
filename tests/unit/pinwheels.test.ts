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
