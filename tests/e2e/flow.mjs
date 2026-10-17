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
