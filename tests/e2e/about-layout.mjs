// 关于页瀑布流：两列宽屏时卡片按内容高度排、同列卡片间距一致、没有卡片被拆到两列；
// 通栏的旅行卡片在两列下面占满宽度；窄屏变单列。
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
    const wide = grid.parentElement.querySelector(':scope > .about-card.wide');
    const g = grid.getBoundingClientRect();
    const wb = wide.getBoundingClientRect();
    return { cards, g: { x: Math.round(g.left), w: Math.round(g.width), b: Math.round(g.bottom) }, wide: { x: Math.round(wb.left), y: Math.round(wb.top), w: Math.round(wb.width) } };
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
  check(Math.abs(r.wide.w - r.g.w) <= 1 && r.wide.x === r.g.x, `${w}x${h}: 旅行卡片占满宽度（${r.wide.w}/${r.g.w}）`);
  check(r.wide.y >= r.g.b, `${w}x${h}: 旅行卡片在两列下面`);
  const lowest = Math.max(...r.cards.map((c) => c.b));
  const below = r.wide.y - lowest;
  check(below >= 16 && below <= 24, `${w}x${h}: 旅行卡片和上面最低那张卡片间距 ${below}px`);
  check(errors.length === 0, `${w}x${h}: 没有 JS 报错 ${errors.join('; ')}`);
  console.log('     ', r.cards.map((c) => `${c.n}@(${c.x},${c.y})`).join('  '));
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/about-${w}.png`, fullPage: false });
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
