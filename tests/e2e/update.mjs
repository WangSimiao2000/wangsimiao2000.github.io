// 版本检查与地图加载回归：node tests/e2e/update.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
// - 线上 version.json 变了：首页自动刷新一次，不会反复刷新
// - 面板换页取回的页面版本不同：整页加载，不在旧外壳里拼新 HTML
// - 首页空闲时预热地图；打开地图时粗图先于清晰瓦片请求，画面很快有内容
import { launch, BASE, checker } from './browser.mjs';

const browser = await launch();
const t = checker();
const FAKE = '/_s/0000000000/';

{
  // 1. 线上已更新、没开面板：刷新一次
  const page = await browser.newPage();
  let loads = 0;
  page.on('load', () => loads++);
  await page.route('**/version.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ assets: FAKE, built: Date.now() + 86400e3 }) }));
  await page.goto(BASE + '/');
  await page.waitForTimeout(5000);
  t.ok(loads === 2, `发现新版后首页自动刷新一次（load ${loads} 次）`);
  await page.close();
}

{
  // 1b. CDN 节点缓存不一致：页面是新的、version.json 是旧的（更早的构建或没有 built 字段）——不刷新，不会被刷回旧版
  for (const old of [{ assets: FAKE, built: 1 }, { assets: FAKE }]) {
    const page = await browser.newPage();
    let loads = 0;
    page.on('load', () => loads++);
    await page.route('**/version.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(old) }));
    await page.goto(BASE + '/');
    await page.waitForTimeout(5000);
    t.ok(loads === 1, `线上 version.json 比页面旧（${JSON.stringify(old)}）时不刷新（load ${loads} 次）`);
    await page.close();
  }
}

{
  // 2. 换页时版本不同：整页加载
  const page = await browser.newPage();
  await page.route('**/archives/', async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace(/\/_s\/[0-9a-f]+\//g, FAKE);
    await r.fulfill({ response: res, body });
  });
  await page.goto(BASE + '/#posts');
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window.__mark = 1));
  const nav = page.waitForEvent('framenavigated', { timeout: 5000 }).then(() => true, () => false);
  await page.click('.stages a[href="/archives/"]');
  const navigated = await nav;
  await page.waitForTimeout(500);
  const mark = await page.evaluate(() => window.__mark);
  t.ok(navigated && mark === undefined && new URL(page.url()).pathname === '/archives/', '版本不同的页面改为整页加载');
  await page.close();
}

{
  // 3. 地图：首页空闲时只预热 manifest；停到服务器板块再取清晰瓦片；点开时很快有画面
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reqs = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/mc-map/')) reqs.push(u.pathname);
  });
  const levels = () => reqs.filter((p) => p.endsWith('.webp')).map((p) => Number(p.split('/')[3]));
  await page.goto(BASE + '/');
  await page.waitForTimeout(9000);
  const idle = levels();
  t.ok(reqs.some((p) => p.endsWith('manifest.json')) && idle.length === 0, `首页空闲时只预热 manifest，不取瓦片（${idle.length} 张）`);

  await page.goto(BASE + '/#server');
  await page.waitForTimeout(4000);
  const atServer = levels().slice(idle.length);
  t.ok(atServer.includes(1), `停到服务器板块后预取预览级和清晰瓦片（${atServer.join(',')}）`);
  reqs.length = 0;

  const t0 = Date.now();
  await page.click('.stages a[href="/server/map/"]');
  const painted = await page
    .waitForFunction(
      () => {
        const c = document.querySelector('[data-mc-map] canvas');
        if (!c || !c.width) return false;
        const d = c.getContext('2d').getImageData(c.width / 2 - 40, c.height / 2 - 40, 80, 80).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
        return false;
      },
      null,
      { timeout: 15000, polling: 50 },
    )
    .then(() => Date.now() - t0, () => -1);
  await page.waitForTimeout(2000);
  t.ok(painted >= 0 && painted < 1500, `预热后打开地图很快有画面（${painted}ms，新请求瓦片 ${levels().length} 张）`);
  await page.close();
}

{
  // 4. 直接打开地图页（没有预热）：预览级先于清晰瓦片请求
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const z = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/mc-map/tiles/')) z.push(Number(u.pathname.split('/')[3]));
  });
  await page.goto(BASE + '/server/map/');
  await page.waitForTimeout(4000);
  const first = z.indexOf(1);
  t.ok(first > 0 && z.slice(0, first).every((l) => l >= 5), `直接打开时预览级先请求（${z.join(',')}）`);
  await ctx.close();
}

await browser.close();
t.done();
