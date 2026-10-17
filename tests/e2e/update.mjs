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
  await page.route('**/version.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ assets: FAKE }) }));
  await page.goto(BASE + '/');
  await page.waitForTimeout(5000);
  t.ok(loads === 2, `发现新版后首页自动刷新一次（load ${loads} 次）`);
  await page.close();
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
  // 3. 地图：首页预热 + 打开时先粗后细
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reqs = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/mc-map/')) reqs.push({ p: u.pathname, at: Date.now() });
  });
  await page.goto(BASE + '/');
  await page.waitForTimeout(9000);
  const warm = reqs.filter((r) => r.p.endsWith('.webp'));
  t.ok(reqs.some((r) => r.p.endsWith('manifest.json')) && warm.length > 0, `首页空闲时预热了 manifest 和 ${warm.length} 张粗图`);
  reqs.length = 0;

  await page.goto(BASE + '/#server');
  await page.waitForTimeout(900);
  const t0 = Date.now();
  await page.click('.stages a[href="/server/map/"]');
  // 画布上第一次有不透明像素的时间
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
  await page.waitForTimeout(3000);
  const tiles = reqs.filter((r) => r.p.endsWith('.webp')).map((r) => Number(r.p.split('/')[3]));
  const firstFine = tiles.indexOf(1);
  const coarseBefore = tiles.slice(0, Math.max(0, firstFine)).filter((z) => z >= 3).length;
  console.log(`     打开地图后请求的瓦片级别：${tiles.join(',')}；首帧有画面 ${painted}ms`);
  t.ok(painted >= 0 && painted < 1500, `打开地图后很快有画面（${painted}ms）`);
  t.ok(firstFine === -1 || coarseBefore > 0 || warm.length > 0, '粗图先于清晰瓦片（或已预热）');
  await page.close();
}

await browser.close();
t.done();
