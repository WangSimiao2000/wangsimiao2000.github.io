// 刚打开首页、脚本还没跑起来时，板块卡片不能叠在一起露出来；脚本加载失败时 3 秒后仍要显示出来。
// 用法：先 npm run dev，再 PLAYWRIGHT_CORE=<目录> node tests/e2e/first-paint.mjs
import { launch, BASE, checker } from './browser.mjs';

const t = checker();
const browser = await launch();

const opacityOf = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.stages')).opacity);
const visiblePanels = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.stages .panel')].filter((p) => getComputedStyle(p).visibility !== 'hidden' && +getComputedStyle(p).opacity > 0.01).length);

// 1. 首页脚本晚到 1.5 秒：这段时间里卡片是藏着的，脚本跑起来后只露出当前那张
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('**/home.js', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto(`${BASE}/`, { waitUntil: 'commit' });
  await page.waitForSelector('.stages');
  await page.waitForTimeout(600);
  t.ok((await opacityOf(page)) === '0', '脚本没跑起来时卡片藏着');
  await page.waitForFunction(() => document.documentElement.classList.contains('world-on'), null, { timeout: 8000 });
  await page.waitForTimeout(400);
  t.ok((await opacityOf(page)) === '1', '世界摆好后卡片淡入');
  t.ok((await visiblePanels(page)) === 1, '只露出当前板块那一张卡片');
  await page.close();
}

// 2. 首页脚本加载失败：3 秒后卡片照样显示，不会一直空着
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('**/home.js', (route) => route.abort());
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(3600);
  t.ok((await opacityOf(page)) === '1', '脚本加载失败时 3 秒后照样显示卡片');
  await page.close();
}

await browser.close();
t.done();
