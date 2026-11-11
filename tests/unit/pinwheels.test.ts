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

test('风车头整张转：转角随转过的圈数连续变化、一圈回到 0；绘制命令带 ROTATE 和转角', async () => {
  const { pinwheelAngle } = await import('../../src/assets/js/pixel/sim/pinwheels.ts');
  const { DrawList, ROTATE, STRIDE } = await import('../../src/assets/js/pixel/drawlist.ts');
  let prev = pinwheelAngle(0);
  for (let k = 1; k < 100; k++) {
    const a = pinwheelAngle(k * 0.01);
    assert.ok(Math.abs(a - prev - Math.PI * 2 * 0.01) < 1e-9, `第 ${k} 步转角跳了：${prev} -> ${a}`);
    prev = a;
  }
  assert.ok(Math.abs(pinwheelAngle(1)) < 1e-9 && Math.abs(pinwheelAngle(-0.25) - Math.PI * 1.5) < 1e-9);
  const dl = new DrawList();
  const head = { name: 'h', width: 13, height: 13, rect: [0, 0, 13, 13] as [number, number, number, number] };
  dl.sprite('fg', head, 3, 4, { rotate: 1.25 });
  const d = dl.layers.fg.data.subarray(0, STRIDE);
  assert.ok((d[0] & ROTATE) !== 0, '没带 ROTATE');
  assert.equal(d[13], 1.25);
  assert.deepEqual([...d.subarray(2, 6)], [3, 4, 13, 13], '目标矩形不变，渲染器绕它的中心转');
});

test('风车分插在主平面和后排：每三个里一个在后排；后排的位置左右交替、不挤、不出板块', async () => {
  const { pinwheelRow, pinwheelBackDx } = await import('../../src/assets/js/pixel/sim/pinwheels.ts');
  const rows = Array.from({ length: 8 }, (_, i) => pinwheelRow(i));
  assert.equal(rows.filter((r) => r === 'back').length, 3, '8 个友链：3 个在后排');
  assert.equal(rows.filter((r) => r === 'main').length, 5);
  const xs = Array.from({ length: Math.ceil(MAX_PINWHEELS / 3) }, (_, k) => pinwheelBackDx(k));
  for (const x of xs) assert.ok(Math.abs(x) < SECTION / 2 - 8, `后排风车 ${x} 排到邻近板块去了`);
  const sorted = [...xs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= 20, `后排风车 ${sorted[i - 1]} 和 ${sorted[i]} 挤在一起`);
});
