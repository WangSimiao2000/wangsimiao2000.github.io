import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawBackRow } from '../../src/assets/js/pixel/sim/backrow.ts';
import { SECTION } from '../../src/assets/js/pixel/sim/biomes.ts';
import { DrawList, STRIDE } from '../../src/assets/js/pixel/drawlist.ts';
import type { Scenery } from '../../src/assets/js/pixel/sim/scenery.ts';
import type { Frame } from '../../src/assets/js/pixel/sim/frame.ts';
import type { Sprite } from '../../src/assets/js/pixel/atlas.ts';

// 每种植被三个尺寸不同的假精灵，图集坐标各不相同，方便认出画的是哪一棵
let next = 0;
const fake = (): Sprite[] => [10, 14, 18].map((h) => ({ name: `s${next}`, width: 8 + h / 2, height: h, rect: [next++ * 40, 0, 8 + h / 2, h] }));
const sc = new Proxy({} as Record<string, Sprite[]>, { get: (o, k: string) => (o[k] ??= fake()) }) as unknown as Scenery;

function frame(camX: number, frac = 0): Frame {
  return { dl: new DrawList(), W: 300, H: 180, S: 5, HALF: 150, camX, camLeft: Math.floor(camX - 150), frac, p: camX / SECTION, dark: false, bg: '#eef1f5', time: 0, reduced: false, running: false, visH: 180 };
}

/** 画出来的树：图集 x -> 它在后排坐标里的位置和底边（画布 x + 后排原点） */
function trees(camX: number, frac = 0) {
  const fr = frame(camX, frac);
  drawBackRow(fr, sc);
  const c = fr.dl.layers.back;
  const origin = camX * 0.85 - 150 - frac;
  const out = new Map<string, [number, number]>();
  for (let i = 0; i < c.count; i++) {
    const d = c.data.subarray(i * STRIDE, (i + 1) * STRIDE);
    if (d[0] & 1) continue; // 地面是纯色块
    out.set(`${d[6]}`, [Math.round(d[2] + origin), d[3] + d[5]]);
  }
  return out;
}

test('后排树：镜头移动时同一棵树的高度、品种、在后排里的位置都不变（翻页时不抽搐）', () => {
  const a = trees(SECTION); // 板块 1 是森林，树最多
  const b = trees(SECTION + 37, 0.4);
  let shared = 0;
  for (const [k, [x, bottom]] of a) {
    const other = b.get(k);
    if (!other) continue;
    shared++;
    assert.ok(Math.abs(other[0] - x) <= 1, `树 ${k} 横向位置变了：${x} -> ${other[0]}`);
    assert.equal(other[1], bottom, `树 ${k} 底边变了`);
  }
  assert.ok(shared > 3, `森林里两次都看得到的树太少（${shared}）`);
});

test('后排有自己的地面：每一列都有，树站在地面上', () => {
  const fr = frame(SECTION);
  drawBackRow(fr, sc);
  const c = fr.dl.layers.back;
  const cols = new Set<number>();
  for (let i = 0; i < c.count; i++) if (c.data[i * STRIDE] & 1) cols.add(c.data[i * STRIDE + 2]);
  assert.equal(cols.size, 300);
});
