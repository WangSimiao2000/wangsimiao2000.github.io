// 右上角的时间拖动条：用真的鼠标点开、按住拖动、松开。拖动条不能被当成「点了外面」收起（顶栏整条点击穿透），
// 时刻和深浅色要跟着变；点空白处收起。首页和阅读页各试一次（阅读面板不能盖住它）。
// 用法：node tests/e2e/time-slider.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();
for (const path of ['/', '/posts/MC-Server-Backup-Strategy/']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    // 只在顶层页面写：初始化脚本对页面里后来加载的每个 iframe 也会跑一遍，会把拖好的时刻又改回 10
    if (window !== window.top) return;
    localStorage.setItem('fs-hint', '1');
    localStorage.setItem('tod', '10');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('[data-time-toggle]');
  const box = await page.locator('[data-time-range]').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * (10 / 24), y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (21 / 24), y, { steps: 8 });
  await page.mouse.up();
  // 时刻是平滑追过去的：刚松手时还在路上，过一会儿才到
  const gliding = await page.evaluate(() => parseFloat(document.documentElement.dataset.hour ?? ''));
  await page.waitForFunction(() => parseFloat(document.documentElement.dataset.hour ?? '') > 20.5, null, { polling: 50, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    open: !document.getElementById('time-pop').hidden,
    hour: parseFloat(document.documentElement.dataset.hour ?? ''),
    theme: document.documentElement.dataset.theme,
    stored: localStorage.getItem('tod'),
  }));
  t.ok(after.open, `${path}：拖动时拖动条不收起`);
  t.ok(gliding < after.hour - 0.05, `${path}：松手时时刻还在平滑地追（${gliding} -> ${after.hour}）`);
  t.ok(after.hour > 20 && after.theme === 'dark', `${path}：拖到 21 点左右变成深色（${after.hour}、${after.theme}）`);
  t.ok(after.stored !== null && parseFloat(after.stored) > 20, `${path}：拖到的时刻记下来了（${after.stored}）`);
  await page.mouse.click(700, 620);
  t.ok(await page.evaluate(() => document.getElementById('time-pop').hidden), `${path}：点空白处收起`);
  t.ok(errors.length === 0, `${path}：没有 JS 报错`);
  await ctx.close();
}
await browser.close();
t.done();
