// 首页卡片不出滚动条（js/fit.ts）：各种屏幕尺寸下，每个板块的卡片内容都放得下；
// 能放的时候不乱藏（大屏上列表放满），再小也至少留一条；窗口变大再变回来，结果和直接打开一样。
// 跑法：先 npm run build，起一个指向 dist 的静态服务器（默认 127.0.0.1:4399），再 node tests/e2e/card-fit.mjs
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();
const SIZES = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1280, 640], [1024, 600], [430, 932], [390, 844], [375, 667], [360, 600]];

const measure = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.stages .panel > .card')].map((c) => ({
      id: c.closest('.stage')?.id,
      over: c.scrollHeight - c.clientHeight,
      lists: [...c.querySelectorAll('[data-fit]')].map((l) => [l.children.length, [...l.children].filter((li) => !li.hasAttribute('data-fit-out')).length]),
      out: c.querySelectorAll('[data-fit-out]').length,
    })),
  );

for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 640, hasTouch: w < 640 });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const cards = await measure(page);
  const bad = cards.filter((c) => c.over > 1);
  t.ok(bad.length === 0, `${w}x${h}: 卡片都放得下${bad.length ? `（${bad.map((c) => `${c.id} 超出 ${c.over}px`).join('，')}）` : ''}`);
  t.ok(cards.every((c) => c.lists.every(([, shown]) => shown >= 1)), `${w}x${h}: 每个列表至少留一条`);
  if (w === 1920) t.ok(cards.every((c) => c.out === 0), '1920x1080: 什么都不用藏');
  // 窗口先变大再变回来：重新量的结果和直接打开时一样
  await page.setViewportSize({ width: w, height: h + 300 });
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  t.ok(JSON.stringify(await measure(page)) === JSON.stringify(cards), `${w}x${h}: 改变窗口大小再变回来，结果不变`);
  await page.close();
}

await browser.close();
t.done();
