import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePNG, encodePNG } from '../../build/png.mjs';
import { check, nameOf, pack } from '../../build/atlas.mjs';

test('PNG 编码后能原样解码回来（RGBA）', () => {
  const data = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) & 0xff);
  const back = decodePNG(encodePNG(3, 2, data));
  assert.equal(back.width, 3);
  assert.equal(back.height, 2);
  assert.deepEqual([...back.data], [...data]);
});

/** 手工拼一张 2x1 的 2 位索引色 PNG（带透明表），用 Sub 滤波，模拟 Aseprite 的索引色导出 */
function indexedPNG() {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };
  const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
  const ihdr = Buffer.from([0, 0, 0, 2, 0, 0, 0, 1, 2, 3, 0, 0, 0]);
  const plte = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255]);
  const trns = Buffer.from([0]); // 下标 0 透明
  const raw = Buffer.from([1, 0b01100000]); // 滤波 1(Sub)，像素 [1, 2]（单字节行里 Sub 不影响第一个字节）
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('tRNS', trns), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('能读 2 位索引色 + 透明表的 PNG', () => {
  const im = decodePNG(indexedPNG());
  assert.deepEqual([...im.data], [0, 255, 0, 255, 0, 0, 255, 255]);
});

test('不支持的 PNG 直接报出文件名', () => {
  const bad = Buffer.from(indexedPNG());
  bad[8 + 8 + 12] = 1; // IHDR 的 interlace 字节
  assert.throws(() => decodePNG(bad, 'src/art/x.png'), /src\/art\/x\.png/);
});

test('文件路径 -> 精灵名：目录变点号，.glow 变成 #glow', () => {
  assert.equal(nameOf('hero/r/run/0.png'), 'hero.r.run.0');
  assert.equal(nameOf('scenery/cottage.glow.png'), 'scenery.cottage#glow');
  assert.equal(nameOf('hat.png'), 'hat');
});

test('装箱：互不重叠、留 1 像素空隙、不超出图集宽度', () => {
  const sizes = { a: [100, 30], b: [100, 20], c: [100, 20], d: [5, 5] };
  const { map, height } = pack(sizes, 210);
  const boxes = Object.values(map);
  for (const [x, y, w, h] of boxes) assert.ok(x + w <= 210 && y + h <= height);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [ax, ay, aw, ah] = boxes[i];
      const [bx, by, bw, bh] = boxes[j];
      assert.ok(ax + aw + 1 <= bx || bx + bw + 1 <= ax || ay + ah + 1 <= by || by + bh + 1 <= ay, '两两之间至少隔 1 像素');
    }
});

test('检查：缺精灵、遮罩尺寸不对、角色帧尺寸不一致都会报出来', () => {
  const errs = check({
    'hero.r.run.0': [14, 20],
    'hero.r.run.1': [14, 21],
    'scenery.lamp': [7, 26],
    'scenery.lamp#glow': [7, 25],
    'ghost#glow': [3, 3],
  });
  assert.ok(errs.some((e) => e.includes('缺少精灵 scenery.cottage')));
  assert.ok(errs.some((e) => e.includes('hero.r.run 下各帧尺寸不一致')));
  assert.ok(errs.some((e) => e.includes('scenery.lamp#glow')));
  assert.ok(errs.some((e) => e.includes('ghost#glow') && e.includes('没有对应的本体')));
});
