// 像素世界画面回归：逐像素比较两次构建（比如重构前后）的世界画面。
//   node tests/e2e/world-pixels.mjs dump a.json              # 在旧版本上
//   node tests/e2e/world-pixels.mjs dump b.json              # 在新版本上
//   node tests/e2e/world-pixels.mjs compare a.json b.json    # 可选 TOL=2：每个通道差值不超过 2 不算不同
//   DIFF=<目录> 时 compare 会把每个画面的差异图写成 PNG（不同的像素标红）
//   QUERY='?fx=0' 时 dump 截的是加了这个查询参数的首页（比如关掉全部效果，只比基本画面）
// 用「减少动态效果」模式（没有粒子、没有亚像素平移、相机直接就位），并由脚本接管动画时钟逐帧推进，
// 画面完全确定：两次构建画面一致时，每个画面的不同像素数都是 0。
// 截的是整页合成后的画面，截之前把所有 DOM 藏起来、只留画布，所以不管世界用几张画布、用什么画都能比。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, BASE } from './browser.mjs';
import { decodePNG, encodePNG } from '../../build/png.mjs';

const [mode, a, b] = process.argv.slice(2);
// visibility 会继承，但子元素可以单独设回 visible：这样只有画布留在画面里
const ONLY_CANVAS = '* { visibility: hidden !important; transition: none !important; } canvas { visibility: visible !important; }';

if (mode === 'dump') {
  // 世界之后用 WebGPU 画，新旧两次都在同一个浏览器里截，才能逐像素比较
  const browser = await launch({ webgpu: true });
  const out = {};
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: theme });
    await ctx.addInitScript((th) => {
      // 深浅色跟着时刻走（js/theme.ts）：亮色截上午 10 点，暗色截晚上 10 点
      localStorage.setItem('tod', th === 'dark' ? '22' : '10');
      localStorage.setItem('fs-hint', '1');
      Math.random = () => 0.42; // 眨眼、翻页之类的随机时刻也固定下来
      // 日月的位置跟着系统时钟走（sim/daytime.ts）：钟也固定在一个时刻
      const RealDate = Date;
      const FIXED = new RealDate(2026, 5, 1, 10, 0, 0).getTime();
      window.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [FIXED]));
        }
        static now() {
          return FIXED;
        }
      };
      // 接管 requestAnimationFrame：由脚本按固定 16ms 一步推进，帧数和时钟都确定，灯光闪烁也就确定了
      let queue = [];
      let now = 0;
      window.requestAnimationFrame = (cb) => (queue.push(cb), queue.length);
      performance.now = () => now;
      window.__step = async (n) => {
        for (let i = 0; i < n; i++) {
          now += 16;
          const q = queue;
          queue = [];
          // 每帧的回调可能是异步的（等 GPU 提交完成），按顺序等完再推进下一帧
          for (const cb of q) await cb(now);
        }
      };
    }, theme);
    const page = await ctx.newPage();
    await page.goto(BASE + '/' + (process.env.QUERY ?? ''), { waitUntil: 'load' });
    // 渲染器就位（WebGPU 要等适配器和图集）。默认的轮询走 requestAnimationFrame，上面已经接管了，改成定时轮询
    await page.waitForFunction(() => document.documentElement.dataset.renderer, null, { timeout: 30000, polling: 100 });
    await page.waitForTimeout(400); // 图集等图片资源解码完
    await page.evaluate(() => window.__step(30));
    await page.addStyleTag({ content: ONLY_CANVAS });
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press(String(i));
      await page.waitForTimeout(150);
      await page.evaluate(() => window.__step(60));
      out[`${theme}/${i}`] = (await page.screenshot()).toString('base64');
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(a, JSON.stringify(out));
  console.log(`已写入 ${a}（${Object.keys(out).length} 个画面）`);
} else if (mode === 'compare') {
  const A = JSON.parse(readFileSync(a, 'utf8'));
  const B = JSON.parse(readFileSync(b, 'utf8'));
  const tol = Number(process.env.TOL || 0);
  const diffDir = process.env.DIFF;
  if (diffDir) mkdirSync(diffDir, { recursive: true });
  let worst = 0;
  for (const key of Object.keys(A)) {
    const x = decodePNG(Buffer.from(A[key], 'base64'), `${a}:${key}`);
    const y = B[key] ? decodePNG(Buffer.from(B[key], 'base64'), `${b}:${key}`) : null;
    if (!y || x.width !== y.width || x.height !== y.height) {
      console.log(`${key.padEnd(8)} 尺寸不同或缺失`);
      worst = Infinity;
      continue;
    }
    let n = 0;
    let max = 0;
    const diff = diffDir ? new Uint8Array(x.data.length) : null;
    for (let k = 0; k < x.data.length; k += 4) {
      const d = Math.max(Math.abs(x.data[k] - y.data[k]), Math.abs(x.data[k + 1] - y.data[k + 1]), Math.abs(x.data[k + 2] - y.data[k + 2]));
      max = Math.max(max, d);
      const bad = d > tol;
      if (bad) n++;
      if (diff) {
        // 差异图：不同的像素标红，其余画成淡灰的原图
        const g = (x.data[k] + x.data[k + 1] + x.data[k + 2]) / 9 + 170;
        diff.set(bad ? [255, 0, 0, 255] : [g, g, g, 255], k);
      }
    }
    if (diff) writeFileSync(join(diffDir, key.replace('/', '-') + '.png'), encodePNG(x.width, x.height, diff));
    worst = Math.max(worst, n);
    console.log(`${key.padEnd(8)} 不同像素 ${n}（${((n / (x.width * x.height)) * 100).toFixed(3)}%），最大通道差 ${max}`);
  }
  process.exitCode = worst === 0 ? 0 : 1;
} else {
  console.error('用法：world-pixels.mjs dump <file> | compare <a> <b>');
  process.exitCode = 2;
}
