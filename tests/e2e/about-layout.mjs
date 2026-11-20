// 关于页瀑布流：两列宽屏时卡片按内容高度排、同列卡片间距一致、没有卡片被拆到两列；
// 所有卡片（含旅行，以及有数据时的 B 站、GitHub）都在瀑布流里，两列底部尽量齐；窄屏变单列。
// 「尽量齐」不按固定像素判断（卡片多少、高矮跟着构建时拉到的数据变）：较高那列的最后一张卡片
// 挪到较矮那列只会更不齐，才算排得对。
// 跑法：先 npm run build，起一个指向 dist 的静态服务器（默认 127.0.0.1:4399），再 node tests/e2e/about-layout.mjs
import { launch, BASE, checker } from './browser.mjs';

const browser = await launch();
const t = checker();
const check = (ok, msg) => t.ok(ok, msg);

for (const [w, h, cols] of [[1440, 900, 2], [1280, 720, 2], [390, 844, 1]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/about/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const grid = document.querySelector('.reader .about-grid') || document.querySelector('.about-grid');
    const cards = [...grid.querySelectorAll(':scope > .about-card')].map((c) => {
      const rects = c.getClientRects();
      const b = c.getBoundingClientRect();
      return { n: c.querySelector('h2').textContent, x: Math.round(b.left), y: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), frags: rects.length };
    });
    const wide = document.querySelectorAll('.about-page .about-card.wide').length;
    return { cards, wide };
  });
  const xs = [...new Set(r.cards.map((c) => c.x))];
  check(xs.length === cols, `${w}x${h}: ${xs.length} 列（期望 ${cols}）`);
  check(r.cards.every((c) => c.frags === 1), `${w}x${h}: 没有卡片被拆到两列`);
  for (const x of xs) {
    const col = r.cards.filter((c) => c.x === x).sort((a, b) => a.y - b.y);
    for (let i = 1; i < col.length; i++) {
      const gap = col[i].y - col[i - 1].b;
      check(gap >= 16 && gap <= 24, `${w}x${h}: 「${col[i - 1].n}」和「${col[i].n}」间距 ${gap}px`);
    }
  }
  check(r.wide === 0, `${w}x${h}: 没有通栏卡片，全部在瀑布流里`);
  check(r.cards.some((c) => c.n.startsWith('旅行')), `${w}x${h}: 旅行卡片在瀑布流里`);
  if (cols === 2) {
    const cols2 = xs.map((x) => r.cards.filter((c) => c.x === x).sort((a, b) => a.y - b.y));
    const bottoms = cols2.map((col) => col[col.length - 1].b);
    const diff = Math.abs(bottoms[0] - bottoms[1]);
    const taller = cols2[bottoms[0] > bottoms[1] ? 0 : 1];
    const last = taller[taller.length - 1];
    const lastH = last.b - last.y;
    check(diff <= lastH + 24, `${w}x${h}: 两列底部高差 ${diff}px，不超过较高那列最后一张「${last.n}」的高度 ${lastH}px`);
  }
  check(errors.length === 0, `${w}x${h}: 没有 JS 报错 ${errors.join('; ')}`);
  console.log('     ', r.cards.map((c) => `${c.n}@(${c.x},${c.y})`).join('  '));
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/about-${w}.png`, fullPage: false });
  await page.close();
}
await browser.close();
t.done();
