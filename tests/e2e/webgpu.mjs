// 测试环境自检：浏览器能拿到 WebGPU 设备，并且真的能画到画布上（headless shell 拿得到设备却画不出来）。
// 像素世界改用 WebGPU 以后，要看画面的测试都依赖这一条；它失败时先查浏览器和启动参数，别去查业务代码。
//   node tests/e2e/webgpu.mjs（先 npm run dev，或 BASE_URL 指向部署好的站点）
import { launch, BASE, checker } from './browser.mjs';

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
  const { decodePNG } = await import('../../build/png.mjs');
  const px = decodePNG(shot).data;
  t.ok(px[0] > 240 && px[1] < 16 && px[2] < 16, `清屏成红色后截图能看到（${[...px.subarray(0, 3)]}）`);
}
await browser.close();
t.done();
