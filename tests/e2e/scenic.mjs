// 只看风景回归：node tests/e2e/scenic.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
// 覆盖：按钮开关、H / Esc、藏起来时卡片和快捷栏不可见也点不到、照常翻页、进阅读面板自动退出、文章页不显示按钮、窄屏顶栏放得下。
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();
const errors = [];
const wait = (ms) => page.waitForTimeout(ms);

let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('fs-hint', '1'));
await page.goto(BASE + '/', { waitUntil: 'load' });
await wait(1200);

const btn = '[data-scenic-toggle]';
const state = () =>
  page.evaluate(() => {
    const card = document.querySelector('.stage .panel[data-panel="0"] .card');
    const cs = getComputedStyle(card);
    const hb = getComputedStyle(document.querySelector('.hotbar'));
    const r = card.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      on: document.documentElement.classList.contains('scenic'),
      pressed: document.querySelector('[data-scenic-toggle]').getAttribute('aria-pressed'),
      card: cs.visibility === 'hidden' && Number(cs.opacity) === 0,
      hotbar: hb.visibility === 'hidden' && Number(hb.opacity) === 0,
      hitCard: !!hit?.closest('.card'),
      active: document.querySelector('.hb-slot.is-active')?.textContent?.trim(),
    };
  });

t.ok(await page.isVisible(btn), '首页右上角有「只看风景」按钮');
let s = await state();
t.ok(!s.on && s.pressed === 'false' && !s.card && s.hitCard, '默认卡片可见、可点');

await page.click(btn);
await wait(500);
s = await state();
t.ok(s.on && s.pressed === 'true', '点按钮进入只看风景');
t.ok(s.card && s.hotbar, '卡片和快捷栏都藏起来了');
t.ok(!s.hitCard, '原来卡片的位置点到的是世界，不是卡片');
t.ok(await page.isVisible('.fs-hint'), '第一次进入时提示怎么恢复');

await page.keyboard.press('ArrowRight');
await wait(1300);
s = await state();
t.ok(s.on && s.active === '博文', '藏起来时 → 照常翻到博文');

await page.keyboard.press('h');
await wait(400);
s = await state();
t.ok(!s.on, 'H 恢复卡片');
await page.keyboard.press('H');
await wait(400);
t.ok((await state()).on, '再按 H 又藏起来');
await page.keyboard.press('Escape');
await wait(400);
s = await state();
t.ok(!s.on && s.pressed === 'false' && !s.card, 'Esc 恢复卡片');

// 进阅读面板时自动退出：先开一篇再后退，开着只看风景时前进回去
await page.click('.panel[data-panel="1"] .post-list a');
await page.waitForSelector('[data-reader]:not([hidden])');
await wait(600);
t.ok(!(await page.isVisible(btn)), '阅读面板开着时不显示按钮');
await page.goBack();
await wait(1000);
await page.click(btn);
await wait(300);
await page.goForward();
await wait(1000);
t.ok(!(await page.evaluate(() => document.documentElement.classList.contains('scenic'))), '前进到文章时自动退出只看风景');
await page.close();

// 直接打开文章页：按钮不显示
page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE + '/archives/', { waitUntil: 'load' });
await wait(600);
t.ok(!(await page.isVisible(btn)), '文章 / 归档页不显示按钮');
await page.close();

// 窄屏：顶栏多一个按钮也放得下
for (const [w, h] of [[320, 568], [375, 667]]) {
  page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await wait(900);
  const fit = await page.evaluate(() => {
    const bar = document.querySelector('.topbar');
    const b = document.querySelector('[data-scenic-toggle]').getBoundingClientRect();
    return bar.scrollWidth <= bar.clientWidth + 1 && b.right <= window.innerWidth && b.width > 0;
  });
  t.ok(fit, `${w}x${h} 顶栏放得下`);
  await page.tap(btn);
  await wait(500);
  t.ok(await page.evaluate(() => document.documentElement.classList.contains('scenic')), `${w}x${h} 点按钮进入只看风景`);
  await page.close();
}

t.ok(errors.length === 0, `没有 JS 报错${errors.length ? '：' + errors.join(' | ') : ''}`);
await browser.close();
t.done();
