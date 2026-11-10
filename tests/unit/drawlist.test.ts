import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPOSE, DrawList, ERASE, FLIP, LAYERS, SOLID, STRIDE } from '../../src/assets/js/pixel/drawlist.ts';
import type { Sprite } from '../../src/assets/js/pixel/atlas.ts';

const cmd = (dl: DrawList, layer: (typeof LAYERS)[number], i = 0) => [...dl.layers[layer].data.subarray(i * STRIDE, (i + 1) * STRIDE)];

test('纯色块：颜色转成 0-255，宽高为负时和 fillRect 一样往反方向画，空的不记', () => {
  const dl = new DrawList();
  dl.rect('fg', 10, 20, -3, 2, '#ff8000', 0.5);
  dl.rect('fg', 0, 0, 0, 5, '#000');
  dl.rect('fg', 0, 0, 5, 5, '#000', 0);
  assert.equal(dl.layers.fg.count, 1);
  assert.deepEqual(cmd(dl, 'fg').slice(0, 13), [SOLID, 0.5, 7, 20, 3, 2, 0, 0, 0, 0, 255, 128, 0]);
});

test('精灵：取图集块的一部分、拉伸、翻转、擦除、发光遮罩', () => {
  const sp: Sprite = { name: 's', width: 8, height: 6, rect: [100, 50, 8, 6], glow: [200, 50, 8, 6] };
  const dl = new DrawList();
  dl.sprite('actors', sp, 3, 4, { part: [2, 1, 1, 4], w: 2, h: 5, flip: true, alpha: 0.25 });
  dl.sprite('emissive', sp, 3, 4, { erase: true });
  dl.sprite('emissive', sp, 3, 4, { glow: true });
  dl.sprite('emissive', { ...sp, glow: undefined }, 0, 0, { glow: true }); // 没有发光遮罩就不画
  assert.deepEqual(cmd(dl, 'actors').slice(0, 10), [FLIP, 0.25, 3, 4, 2, 5, 102, 51, 1, 4]);
  assert.equal(dl.layers.emissive.count, 2);
  assert.deepEqual(cmd(dl, 'emissive', 0).slice(0, 10), [ERASE, 1, 3, 4, 8, 6, 100, 50, 8, 6]);
  assert.deepEqual(cmd(dl, 'emissive', 1).slice(6, 10), [200, 50, 8, 6]);
});

test('清单会自动扩容，clear 后从头写', () => {
  const dl = new DrawList();
  for (let i = 0; i < 1000; i++) dl.rect('over', i, 0, 1, 1, '#fff');
  assert.equal(dl.layers.over.count, 1000);
  assert.equal(cmd(dl, 'over', 999)[2], 999);
  dl.clear();
  assert.equal(dl.layers.over.count, 0);
});

test('每一层都恰好合成一次', () => {
  const used = Object.values(COMPOSE).flat().map((r) => r.layer);
  assert.deepEqual([...used].sort(), [...LAYERS].sort());
});
