// 测试环境自检：浏览器能拿到 WebGPU 设备，并且真的能画到画布上（headless shell 拿得到设备却画不出来）。
// 像素世界改用 WebGPU 以后，要看画面的测试都依赖这一条；它失败时先查浏览器和启动参数，别去查业务代码。
//   node tests/e2e/webgpu.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
import { launch, BASE, checker } from './browser.mjs';
import { decodePNG } from '../../build/png.mjs';

const t = checker();
const browser = await launch({ webgpu: true });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
// WebGPU 只在安全上下文里可用，localhost 算安全上下文，about:blank 不一定
await page.goto(BASE + '/404.html', { waitUntil: 'load' });
const res = await page.evaluate(async () => {
  if (!navigator.gpu) return { error: '没有 navigator.gpu' };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { error: '拿不到适配器' };
  const device = await adapter.requestDevice();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:16px;height:16px;z-index:99999';
  document.body.append(canvas);
  const ctx = canvas.getContext('webgpu');
  ctx.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
  const enc = device.createCommandEncoder();
  enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [1, 0, 0, 1] }] }).end();
  device.queue.submit([enc.finish()]);
  await device.queue.onSubmittedWorkDone();
  return { arch: adapter.info?.architecture ?? '' };
});
t.ok(!res.error, `拿到 WebGPU 设备（${res.error ?? res.arch}）`);
if (!res.error) {
  await page.waitForTimeout(100);
  const shot = await page.screenshot({ clip: { x: 4, y: 4, width: 1, height: 1 } });
  const px = decodePNG(shot).data;
  t.ok(px[0] > 240 && px[1] < 16 && px[2] < 16, `清屏成红色后截图能看到（${[...px.subarray(0, 3)]}）`);

  // 首页用 WebGPU 渲染器：就位、翻页、切深色都不报错，画面不是空的
  const home = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  home.on('pageerror', (e) => errors.push(String(e)));
  home.on('console', (m) => m.type() === 'error' && m.text().includes('[world]') && errors.push(m.text()));
  await home.goto(BASE + '/', { waitUntil: 'load' });
  await home.waitForFunction(() => document.documentElement.dataset.renderer, null, { timeout: 30000 });
  t.ok((await home.evaluate(() => document.documentElement.dataset.renderer)) === 'webgpu', '首页用的是 WebGPU 渲染器');
  await home.keyboard.press('5');
  await home.waitForTimeout(1500);
  await home.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await home.waitForTimeout(500);
  await home.addStyleTag({ content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  const img = decodePNG(await home.screenshot());
  const colors = new Set();
  for (let i = 0; i < img.data.length; i += 4 * 101) colors.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
  t.ok(colors.size > 50, `画面不是空的（抽样到 ${colors.size} 种颜色）`);
  t.ok(errors.length === 0, `没有报错${errors.length ? '：' + errors[0] : ''}`);
}
await browser.close();
t.done();
