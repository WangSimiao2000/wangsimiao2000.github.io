// 游戏板块：node tests/e2e/games.mjs（先 npm run build 并起静态服务器，或 BASE_URL 指向部署好的站点）
// 覆盖：两页切换（点击、方向键不串到板块切换）、#server 旧锚点、矮屏手机上两页都不溢出卡片、
// 「完整游戏库」打开 /games/、MC 页的世界地图按钮、无 JS 报错。没有 Steam 数据时只检查 MC 卡片照常。
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();
const errors = [];
const wait = (ms, page) => page.waitForTimeout(ms);

async function open(viewport, hash = '#games') {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('fs-hint', '1'));
  await page.goto(BASE + '/' + hash, { waitUntil: 'load' });
  await wait(1600, page);
  return page;
}
const active = (page) => page.$eval('.hb-slot.is-active', (el) => el.textContent?.trim());
const shown = (page) => page.$eval('.play-panes', (el) => [...el.children].filter((p) => !p.hasAttribute('data-off')).map((p) => p.dataset.pane).join());
/** 卡片内容是否超出卡片（每一页都量：隐藏的那页也占着格子） */
const overflow = (page) =>
  page.$eval('#games .card', (card) => {
    const c = card.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(card).paddingBottom);
    let bottom = 0;
    for (const el of card.querySelectorAll('.play-pane, .server')) bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
    return Math.round(bottom - (c.bottom - pad));
  });

const page = await open({ width: 1440, height: 900 });
t.ok((await active(page)) === '游戏', '快捷栏叫「游戏」，#games 停在这一板块');
const hasSteam = !!(await page.$('.play-tabs'));
if (!hasSteam) {
  t.ok(!!(await page.$('#games .server[data-mc-status]')), '没有 Steam 数据：只显示 MC 服务器卡片');
} else {
  t.ok((await shown(page)) === 'steam', '默认显示「最近在玩」');
  const rows = await page.$$eval('#games .game-list li', (ls) => ls.filter((l) => getComputedStyle(l).display !== 'none').length);
  t.ok(rows >= 1 && rows <= 3, `卡片列出 ${rows} 个游戏`);
  const h0 = await page.$eval('#games .card', (el) => el.getBoundingClientRect().height);
  await page.click('[data-tab="mc"]');
  await wait(400, page);
  t.ok((await shown(page)) === 'mc', '点「MC 服务器」切过去');
  const h1 = await page.$eval('#games .card', (el) => el.getBoundingClientRect().height);
  t.ok(Math.abs(h0 - h1) < 1, `切换时卡片高度不变（${h0} / ${h1}）`);
  t.ok(await page.$eval('#pane-steam', (el) => el.inert), '藏起来的那页不能点也不能 Tab 进去');
  await page.focus('[data-tab="mc"]');
  await page.keyboard.press('ArrowLeft');
  await wait(1300, page);
  t.ok((await shown(page)) === 'steam' && (await active(page)) === '游戏', '在切换按钮上按 ← 只换页，不换板块');
  await page.click('#games a[href="/games/"]');
  await wait(1500, page);
  t.ok(new URL(page.url()).pathname === '/games/', '「完整游戏库」打开 /games/');
  t.ok((await page.$$('.games-page .game-list li')).length > 0, '面板里有游戏库列表');
  await page.click('.reader-close');
  await wait(1200, page);
  await page.click('[data-tab="mc"]');
  await wait(300, page);
  await page.click('#games .map-open');
  await wait(1500, page);
  t.ok(new URL(page.url()).pathname === '/server/map/', 'MC 页的「世界地图」照常打开地图');
}
await page.close();

const old = await open({ width: 1280, height: 760 }, '#server');
t.ok(new URL(old.url()).hash === '#games' && (await active(old)) === '游戏', '旧锚点 #server 跳到 #games');
await old.close();

// 手机浏览器扣掉地址栏后的真实可视高度
for (const [w, h] of [[320, 568], [375, 553], [390, 664], [414, 715], [412, 780], [1366, 640], [1280, 720]]) {
  const p = await open({ width: w, height: h });
  const o = await overflow(p);
  t.ok(o <= 0, `${w}x${h} 卡片不溢出（${o}px）`);
  await p.close();
}

t.ok(errors.length === 0, `没有 JS 报错 ${errors.join(' | ')}`);
await browser.close();
t.done();
