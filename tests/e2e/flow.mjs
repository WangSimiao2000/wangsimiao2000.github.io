// 交互流程回归：node tests/e2e/flow.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
// 覆盖：板块切换（键盘、快捷栏、滚轮一次一页）、阅读面板开合与前进后退、站内搜索、隐藏页直达、无 JS 报错。
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('fs-hint', '1'));

const active = () => page.$eval('.hb-slot.is-active', (el) => el.textContent?.trim());
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(BASE + '/', { waitUntil: 'load' });
await wait(800);
t.ok((await active()) === '起点', '首页停在起点');

await page.keyboard.press('3');
await wait(1200);
t.ok((await active()) === '工具', '按 3 到工具');

await page.keyboard.press('ArrowLeft');
await wait(1200);
t.ok((await active()) === '博文', '← 回到博文');

await page.click('.hb-slot:has-text("关于")');
await wait(1200);
t.ok((await active()) === '关于', '点快捷栏到关于');
t.ok(new URL(page.url()).hash === '#about', '地址栏跟着变成 #about');

// 带锚点刷新：停在那个板块，地址栏和画面一致
await page.goto(BASE + '/#posts', { waitUntil: 'load' });
await wait(800);
t.ok((await active()) === '博文', '打开 /#posts 停在博文');
await page.reload({ waitUntil: 'load' });
await wait(800);
t.ok((await active()) === '博文' && new URL(page.url()).hash === '#posts', '刷新后仍在博文，地址仍是 #posts');
await page.keyboard.press('1');
await wait(1200);
t.ok(new URL(page.url()).hash === '', '回到起点后地址不带锚点');

// 一次带惯性的滚轮手势只翻一页
await page.keyboard.press('1');
await wait(1200);
await page.mouse.move(720, 300);
for (let i = 0; i < 40; i++) {
  await page.mouse.wheel(0, 120 * Math.pow(0.9, i) + 1);
  await wait(16);
}
await wait(1200);
t.ok((await active()) === '博文', '一次惯性滚轮只翻一页');

// 阅读面板
await page.click('#posts .post-list a');
await page.waitForFunction(() => document.documentElement.classList.contains('reading'));
await wait(600);
t.ok(/\/posts\//.test(page.url()), `打开文章，地址 ${new URL(page.url()).pathname}`);
const before = await page.evaluate(() => window.scrollY);
await page.mouse.move(720, 400);
await page.mouse.wheel(0, 600);
await wait(400);
t.ok((await page.evaluate(() => window.scrollY)) === before, '阅读时滚轮不带动世界');
t.ok((await page.$eval('.reader-scroll', (el) => el.scrollTop)) > 0, '阅读时滚轮滚的是正文');
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.documentElement.classList.contains('reading'));
await wait(500);
t.ok(new URL(page.url()).hash === '#posts', 'Esc 关闭回到 #posts');
// 关闭面板等于后退一步（历史里不堆文章页），所以「前进」回到文章
await page.goForward();
await page.waitForFunction(() => document.documentElement.classList.contains('reading'));
t.ok(/\/posts\//.test(page.url()), '浏览器前进回到文章');
await page.keyboard.press('Escape');
await wait(600);

// 导航栈：归档 -> 文章 -> 下一篇（平移）-> Esc 回到归档原位 -> 关闭回到世界
await page.click('#posts a.btn-open[href="/archives/"]');
await page.waitForFunction(() => location.pathname === '/archives/');
await wait(500);
await page.$eval('.reader-scroll', (el) => el.scrollTo({ top: 600, behavior: 'instant' }));
await wait(200);
const target = await page.evaluateHandle(() => {
  const sc = document.querySelector('.reader-scroll');
  const r = sc.getBoundingClientRect();
  return [...sc.querySelectorAll('.post-list a')].find((a) => a.getBoundingClientRect().top > r.top + 40);
});
const picked = await target.evaluate((a) => a.getAttribute('href'));
await target.click();
await page.waitForFunction(() => location.pathname.startsWith('/posts/'));
await wait(500);
t.ok((await page.$eval('[data-back-label]', (el) => el.textContent)) === '归档', '从归档进的文章，返回按钮写「归档」');
const nextLink = await page.$('.post-nav a');
if (nextLink) {
  await nextLink.click();
  await page.waitForFunction((p) => location.pathname !== p, picked);
  await wait(500);
  t.ok((await page.$eval('[data-back-label]', (el) => el.textContent)) === '归档', '上一篇/下一篇是平移，返回仍是「归档」');
}
await page.keyboard.press('Escape');
await page.waitForFunction(() => location.pathname === '/archives/');
await wait(500);
const top = await page.$eval('.reader-scroll', (el) => el.scrollTop);
t.ok(Math.abs(top - 600) < 40, `Esc 退回归档，回到原来的位置（${top}）`);
t.ok((await page.evaluate(() => document.activeElement?.getAttribute('href'))) === picked, '焦点回到刚才点的那篇');
t.ok((await page.$eval('[data-back-label]', (el) => el.textContent)) === '回到森林', '归档是从世界打开的，返回写「回到森林」');
await page.click('[data-reader-close]');
await page.waitForFunction(() => !document.documentElement.classList.contains('reading'));
t.ok(new URL(page.url()).pathname === '/', '关闭按钮回到世界');
await wait(500);

// 搜索
await page.keyboard.press('/');
await page.waitForSelector('.search.is-open');
await page.keyboard.type('光栅化');
await page.waitForFunction(() => document.querySelectorAll('.search-results li').length > 0);
const hits = await page.$$eval('.search-results li', (li) => li.length);
t.ok(hits >= 2, `搜索「光栅化」有 ${hits} 条结果`);
await page.keyboard.press('Escape');
await wait(400);
t.ok(!(await page.$('.search.is-open')), 'Esc 关闭搜索');

// 隐藏页直达
await page.goto(BASE + '/guestbook/', { waitUntil: 'load' });
await wait(800);
t.ok(await page.evaluate(() => document.documentElement.classList.contains('secret-open')), '直接打开留言板停在秋林');

// 直接打开文章
await page.goto(BASE + '/archives/', { waitUntil: 'load' });
await wait(800);
t.ok(await page.evaluate(() => document.documentElement.classList.contains('reading')), '直接打开归档是阅读面板');

// 彩蛋：双击起点路牌后往回走进秋林；往前走出来后路牌翻回去，再往回走进不去
const worldPoint = (dx, up) =>
  page.evaluate(([dx, up]) => {
    const S = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px'));
    const half = Math.ceil(document.documentElement.clientWidth / S) / 2;
    const H = Math.ceil(innerHeight / S);
    return [(half + dx) * S, (H - 32 - up) * S];
  }, [dx, up]);
await page.goto(BASE + '/', { waitUntil: 'load' });
await wait(800);
const [sx, sy] = await worldPoint(-32, 8);
await page.mouse.click(sx, sy);
await wait(120);
await page.mouse.click(sx, sy);
await wait(900);
await page.keyboard.press('ArrowLeft');
await wait(1200);
t.ok(await page.evaluate(() => document.documentElement.classList.contains('secret-open')), '双击路牌后往回走进秋林');
await page.keyboard.press('ArrowRight');
await wait(1200);
await page.keyboard.press('ArrowLeft');
await wait(1200);
t.ok(!(await page.evaluate(() => document.documentElement.classList.contains('secret-open'))), '出来后路牌翻回去，进不去了');

// 草堆点 4 下跳出猫：猫落在草堆左边，鼠标移过去是可点的
await page.keyboard.press('2');
await wait(1400);
const [hx, hy] = await worldPoint(46, 5);
for (let i = 0; i < 4; i++) {
  await page.mouse.click(hx, hy);
  await wait(450);
}
await wait(1000);
const [cx, cy] = await worldPoint(46 - 18, 3);
await page.mouse.move(cx, cy);
await wait(200);
t.ok(await page.evaluate(() => document.documentElement.classList.contains('world-hover')), '草堆点 4 下跳出猫');

t.ok(errors.length === 0, `没有 JS 报错${errors.length ? '：' + errors.join(' | ') : ''}`);
await browser.close();
t.done();
