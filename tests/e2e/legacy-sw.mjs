// 旧站 Service Worker 清理回归：node tests/e2e/legacy-sw.mjs（先 npm run dev；要往 dist/ 临时写文件，只能对本地跑）
// 模拟访问过旧 Jekyll（Chirpy）站的浏览器：/sw.min.js 是「缓存优先」的旧 Service Worker，缓存里存着旧首页。
// - 自毁版 /sw.min.js 上线后：浏览器检查更新时装上它，删缓存、注销、页面刷新成新站
// - 页面这边：被旧 Service Worker 控制着打开新站时，主动注销、删缓存、刷新一次
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, BASE, checker } from './browser.mjs';

const SW = new URL('../../dist/sw.min.js', import.meta.url);
const killSwitch = readFileSync(SW, 'utf8');
// 旧站 sw.js 的核心逻辑：同域 GET 一律先查缓存，没有才走网络并存进缓存
const legacy = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (e.request.method === 'GET') { const c = res.clone(); caches.open('chirpy-old').then((k) => k.put(e.request, c)); }
    return res;
  })));
});`;

const browser = await launch();
const t = checker();
const OLD = '<!doctype html><title>OLD-BLOG</title><body>旧站缓存</body>';

/** 在一个不跑新站脚本的页面（robots.txt）里装上旧 Service Worker，并往缓存里塞一份旧首页 */
async function installLegacy(page, poisonHome) {
  writeFileSync(SW, legacy);
  await page.goto(BASE + '/robots.txt');
  await page.evaluate(async ([old, poison]) => {
    await navigator.serviceWorker.register('/sw.min.js');
    await navigator.serviceWorker.ready;
    if (poison) await (await caches.open('chirpy-old')).put('/', new Response(old, { headers: { 'content-type': 'text/html' } }));
  }, [OLD, poisonHome]);
}

const state = (page) =>
  page.evaluate(async () => ({
    regs: (await navigator.serviceWorker.getRegistrations()).length,
    caches: (await caches.keys()).length,
    controlled: !!navigator.serviceWorker.controller,
  }));

try {
  {
    // 1. 旧首页被缓存着（新站脚本根本跑不到）：只能靠自毁版 sw.min.js
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await installLegacy(page, true);
    await page.goto(BASE + '/');
    t.ok((await page.title()) === 'OLD-BLOG', '复现：旧 Service Worker 拿缓存里的旧首页顶替新站');
    writeFileSync(SW, killSwitch);
    await page.goto(BASE + '/robots.txt'); // 导航时浏览器例行检查更新，装上自毁版
    await page.waitForTimeout(2500);
    await page.goto(BASE + '/');
    await page.waitForTimeout(1500);
    const s = await state(page);
    t.ok((await page.title()) !== 'OLD-BLOG' && (await page.$('#world')) !== null, `自毁版上线后首页是新站（${await page.title()}）`);
    t.ok(s.regs === 0 && s.caches === 0 && !s.controlled, `旧 Service Worker 已注销、缓存已清（${JSON.stringify(s)}）`);
    await ctx.close();
  }
  {
    // 2. 旧 Service Worker 还在、但这次取到的是新站页面：页面脚本自己清掉并刷新一次
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await installLegacy(page, false);
    let loads = 0;
    page.on('load', () => loads++);
    await page.goto(BASE + '/');
    await page.waitForTimeout(3000);
    const s = await state(page);
    t.ok(s.regs === 0 && s.caches === 0 && !s.controlled, `页面脚本注销旧 Service Worker 并清缓存（${JSON.stringify(s)}）`);
    t.ok(loads === 2, `只刷新一次（load ${loads} 次）`);
    await ctx.close();
  }
  {
    // 3. 从没访问过旧站的浏览器：什么都不做，不会多刷新
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let loads = 0;
    page.on('load', () => loads++);
    await page.goto(BASE + '/');
    await page.waitForTimeout(2500);
    t.ok(loads === 1, `没有旧 Service Worker 时不刷新（load ${loads} 次）`);
    await ctx.close();
  }
} finally {
  writeFileSync(SW, killSwitch);
  await browser.close();
}
t.done();
