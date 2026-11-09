// 关于页瀑布流：两列宽屏时卡片按内容高度排、同列卡片间距一致、没有卡片被拆到两列；
// 所有卡片（含旅行、B 站、GitHub）都在瀑布流里，两列底部差不多齐；窄屏变单列。
// 跑法：先 npm run build，起一个指向 dist 的静态服务器（默认 127.0.0.1:4399），再 node tests/e2e/about-layout.mjs
import { launch, BASE } from './browser.mjs';

const browser = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

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
    const bottoms = xs.map((x) => Math.max(...r.cards.filter((c) => c.x === x).map((c) => c.b)));
    const diff = Math.abs(bottoms[0] - bottoms[1]);
    check(diff <= 260, `${w}x${h}: 两列底部高差 ${diff}px`);
  }
  check(errors.length === 0, `${w}x${h}: 没有 JS 报错 ${errors.join('; ')}`);
  console.log('     ', r.cards.map((c) => `${c.n}@(${c.x},${c.y})`).join('  '));
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/about-${w}.png`, fullPage: false });
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
