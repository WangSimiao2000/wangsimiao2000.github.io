// 顶栏回归：node tests/e2e/readerbar.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
// 覆盖：顶栏不再有 RSS、归档页有订阅入口；手机看文章时全屏按钮不显示、往下读顶栏收起往上滑回来、
// 停在底部不来回闪、关闭面板后顶栏回来；电脑上不收起。
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();
const errors = [];
const POST = process.env.POST || '/posts/Add-New-Tools-to-GBuffer-Visualization/';

const scrollBy = (page, dy, steps = 8) =>
  page.evaluate(
    async ({ dy, steps }) => {
      const el = document.querySelector('[data-reader-scroll]');
      for (let i = 0; i < steps; i++) {
        el.scrollTop += dy / steps;
        await new Promise((r) => setTimeout(r, 40));
      }
    },
    { dy, steps },
  );
const bar = (page) =>
  page.evaluate(() => {
    const top = document.querySelector('.topbar');
    const back = document.querySelector('.reader-back')?.getBoundingClientRect();
    return {
      hidden: document.documentElement.classList.contains('bar-hidden'),
      visible: getComputedStyle(top).visibility !== 'hidden',
      readerTop: Math.round(document.querySelector('[data-reader]').getBoundingClientRect().top),
      backOnScreen: !!back && back.top >= 0 && back.bottom <= window.innerHeight,
    };
  });

// 首页、归档页：RSS 挪到归档页
let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('fs-hint', '1'));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(600);
t.ok((await page.$$('.topbar a[href="/feed.xml"]')).length === 0, '顶栏不再有 RSS');
t.ok(!!(await page.$('link[rel="alternate"][href="/feed.xml"]')), '<head> 里仍声明订阅源');
await page.goto(BASE + '/archives/', { waitUntil: 'load' });
await page.waitForTimeout(600);
t.ok(await page.isVisible('.page-sub a.feed-link[href="/feed.xml"]'), '归档页标题下有「订阅 RSS」');

// 电脑：全屏按钮在，往下读顶栏不收起
await page.goto(BASE + POST, { waitUntil: 'load' });
await page.waitForTimeout(1000);
t.ok(await page.isVisible('[data-fullscreen-toggle]'), '电脑上看文章仍有全屏按钮');
await scrollBy(page, 600);
await page.waitForTimeout(400);
t.ok(!(await bar(page)).hidden, '电脑上往下读顶栏不收起');
await page.close();

// 手机
page = await browser.newPage({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('fs-hint', '1'));
await page.goto(BASE + POST, { waitUntil: 'load' });
await page.waitForTimeout(1200);
let s = await bar(page);
t.ok(!s.hidden && s.visible && s.readerTop === 60, `手机打开文章时顶栏在、面板从 60px 开始（${s.readerTop}）`);
t.ok(!(await page.isVisible('[data-fullscreen-toggle]')), '手机上看文章不显示全屏按钮');
t.ok(await page.isVisible('[data-search-open]') && (await page.isVisible('[data-theme-toggle]')), '搜索和深色模式按钮还在');

await scrollBy(page, 15, 1);
await page.waitForTimeout(400);
t.ok(!(await bar(page)).hidden, '轻微滚动不收起');
await scrollBy(page, 500);
await page.waitForTimeout(450);
s = await bar(page);
t.ok(s.hidden && !s.visible && s.readerTop === 8, `往下读顶栏收起，面板顶到 8px（${s.readerTop}）`);
t.ok(s.backOnScreen, '面板的返回按钮仍在屏幕内');

await scrollBy(page, -120);
await page.waitForTimeout(450);
s = await bar(page);
t.ok(!s.hidden && s.visible && s.readerTop === 60, '往上滑顶栏回来');

// 滚到底：面板变高会把 scrollTop 往回夹，不能来回闪
await scrollBy(page, 100000, 10);
await page.waitForTimeout(450);
const flips = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let n = 0;
      const mo = new MutationObserver(() => n++);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      setTimeout(() => {
        mo.disconnect();
        resolve(n);
      }, 1200);
    }),
);
s = await bar(page);
t.ok(s.hidden && flips === 0, `滚到底后顶栏保持收起、不闪（${flips} 次变化）`);

await page.click('[data-reader-close]');
await page.waitForTimeout(900);
s = await bar(page);
t.ok(!s.hidden && s.visible, '关闭阅读面板后顶栏回来');
t.ok(await page.isVisible('[data-scenic-toggle]'), '回到首页「只看风景」按钮出现');
await page.close();

// 窄屏首页：顶栏放得下
page = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(800);
t.ok(await page.evaluate(() => { const b = document.querySelector('.topbar'); return b.scrollWidth <= b.clientWidth + 1; }), '320 宽首页顶栏放得下');
await page.close();

t.ok(errors.length === 0, `没有 JS 报错${errors.length ? '：' + errors.join(' | ') : ''}`);
await browser.close();
t.done();
