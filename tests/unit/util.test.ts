import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, easeInOut, mix, noise1, parseColor, smooth } from '../../src/assets/js/pixel/util.ts';

test('clamp / smooth / easeInOut 的边界', () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(2), 1);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(smooth(0, 1, -1), 0);
  assert.equal(smooth(0, 1, 2), 1);
  assert.equal(smooth(0, 1, 0.5), 0.5);
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
});

test('parseColor 认识 #rgb、#rrggbb、rgb()，解析不了时退回浅色底', () => {
  assert.deepEqual(parseColor('#fff'), [255, 255, 255]);
  assert.deepEqual(parseColor('#3a9a30'), [58, 154, 48]);
  assert.deepEqual(parseColor(' rgb(1, 2, 3) '), [1, 2, 3]);
  assert.deepEqual(parseColor('rgb(14 20 38 / 0.5)'), [14, 20, 38]);
  assert.deepEqual(parseColor('#zzz'), [238, 241, 245]);
  assert.deepEqual(parseColor(''), [238, 241, 245]);
});

test('mix 在两端返回原色', () => {
  assert.equal(mix('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(mix('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  assert.equal(mix('#000000', '#ffffff', 0.5), 'rgb(127,127,127)');
});

test('noise1 确定、连续、落在 [-1,1]', () => {
  for (let x = -50; x < 50; x += 0.37) {
    const v = noise1(x);
    assert.ok(v >= -1 && v <= 1, `noise1(${x}) = ${v}`);
    assert.equal(noise1(x), v);
    assert.ok(Math.abs(noise1(x + 0.001) - v) < 0.01, '相邻点不该跳变');
  }
});
