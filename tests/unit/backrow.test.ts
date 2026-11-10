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

/** 第一个精灵命令画在哪（画布 x）加上这一层的亚像素偏移 = 实际显示的位置 */
function shown(layer: 'back' | 'front', camX: number, draw: (fr: Frame) => void) {
  const fr = frame(camX);
  draw(fr);
  const c = fr.dl.layers[layer];
  for (let i = 0; i < c.count; i++) {
    const d = c.data.subarray(i * STRIDE, (i + 1) * STRIDE);
    if (!(d[0] & 1)) return { key: d[6], x: d[2] + (fr.dl.shift[layer] ?? 0) };
  }
  throw new Error('没画精灵');
}

test('后排和前景按整格画、小数交给 shift：镜头慢慢挪时，显示位置连续地跟着走（翻页结尾不卡）', async () => {
  const { drawFront } = await import('../../src/assets/js/pixel/sim/front.ts');
  for (const [layer, speed, draw] of [
    ['back', 0.85, (fr: Frame) => drawBackRow(fr, sc)],
    ['front', 1.4, (fr: Frame) => drawFront(fr, sc)],
  ] as const) {
    let prev = shown(layer, SECTION, draw);
    for (let k = 1; k <= 12; k++) {
      const cur = shown(layer, SECTION + k * 0.07, draw);
      if (cur.key !== prev.key) break; // 换了一个精灵打头，不比
      assert.ok(Math.abs(cur.x - prev.x + 0.07 * speed) < 1e-6, `${layer} 第 ${k} 步跳了：${prev.x} -> ${cur.x}`);
      prev = cur;
    }
  }
});
