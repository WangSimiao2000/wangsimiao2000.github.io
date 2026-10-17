import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, GROUND, OFF, SECTION, biomeOf, heightAt, onPath, paletteAt, setPieces, slotItem, weights } from '../../src/assets/js/pixel/biomes.ts';
import type { Scenery } from '../../src/assets/js/pixel/scenery.ts';

/** 假的 Scenery：每个键返回带名字的占位对象，不需要 canvas */
const sc = new Proxy({} as Record<string, unknown>, {
  get: (_, k: string) => (['cottage', 'fence', 'lamp', 'sign', 'campfire', 'hay'].includes(k) ? { name: k, width: 10, height: 10 } : [0, 1, 2].map((i) => ({ name: `${k}${i}` }))),
}) as unknown as Scenery;
const name = (it: { sprite: unknown } | null) => (it ? (it.sprite as unknown as { name: string }).name : null);

test('起点（板块 0）是草甸，左边藏着秋林', () => {
  assert.equal(biomeOf(0)?.name, 'plains');
  assert.equal(biomeOf(-1)?.name, 'autumn');
  assert.equal(BIOMES[OFF].name, 'plains');
  assert.equal(biomeOf(BIOMES.length), undefined);
});

test('每个群系的植被阈值递增且不超过 1', () => {
  for (const b of BIOMES) {
    let prev = 0;
    for (const f of b.flora) {
      assert.ok(f.until > prev && f.until <= 1, `${b.name}: ${f.kind}`);
      prev = f.until;
    }
  }
});

test('weights：板块中心只取一个群系，交界正中各占一半', () => {
  for (let s = 0; s < BIOMES.length - OFF; s++) {
    const [i, , t] = weights(s * SECTION);
    assert.equal(i, s + OFF);
    assert.equal(t, 0);
  }
  const [i, j, t] = weights(SECTION * 1.5);
  assert.deepEqual([i, j], [OFF + 1, OFF + 2]);
  assert.ok(Math.abs(t - 0.5) < 1e-9);
});

test('heightAt：板块中心压平到 GROUND，其他地方起伏有界', () => {
  for (let s = -1; s < BIOMES.length - OFF; s++) assert.equal(heightAt(s * SECTION), GROUND);
  const maxAmp = Math.max(...BIOMES.map((b) => b.amp));
  for (let wx = -SECTION; wx < SECTION * 6; wx += 7) {
    const h = heightAt(wx);
    assert.ok(Math.abs(h - GROUND) <= maxAmp + 1e-9, `heightAt(${wx}) = ${h}`);
  }
});

test('paletteAt 有缓存且返回完整配色', () => {
  const p = paletteAt(SECTION * 2);
  assert.equal(paletteAt(SECTION * 2), p);
  assert.equal(p.soil.length, 3);
  assert.match(p.top, /^rgb\(/);
});

test('slotItem：同一槽位结果固定；小人脚下和留空区不长东西', () => {
  for (let s = -40; s < 240; s++) {
    const a = slotItem(s, sc);
    assert.equal(name(a), name(slotItem(s, sc)));
    if (!a) continue;
    const rel = a.wx - Math.round(a.wx / SECTION) * SECTION;
    assert.ok(Math.abs(rel) >= 24, `槽位 ${s} 在小人脚下`);
    // 不在过渡带里时只可能是这个群系：它的留空区里不该有东西
    const [i, , t] = weights(a.wx);
    if (t > 0) continue;
    for (const [lo, hi] of BIOMES[i].clear ?? []) assert.ok(!(rel > lo && rel < hi), `${BIOMES[i].name} 留空区长了 ${name(a)}`);
  }
});

test('setPieces：只有起点的路牌能翻；小镇有带门的小屋，雪松林有营火', () => {
  assert.equal(setPieces(0, sc)[0].egg, 'sign');
  assert.equal(setPieces(1, sc)[0].egg, undefined);
  const village = BIOMES.findIndex((b) => b.name === 'village') - OFF;
  const cottage = setPieces(village, sc).find((it) => name(it) === 'cottage');
  assert.equal(cottage?.egg, 'door');
  assert.equal(cottage?.glow, 'window');
  const snow = BIOMES.findIndex((b) => b.name === 'snow') - OFF;
  assert.equal(setPieces(snow, sc).find((it) => it.glow === 'fire') ? 'ok' : 'missing', 'ok');
});

test('onPath：只有小镇中心两侧铺土路', () => {
  const village = BIOMES.findIndex((b) => b.name === 'village') - OFF;
  assert.equal(onPath(village * SECTION), true);
  assert.equal(onPath(village * SECTION + 100), false);
  assert.equal(onPath(0), false);
});
