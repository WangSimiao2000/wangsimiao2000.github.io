// 像素世界画面回归：逐像素比较两次构建（比如重构前后）的世界画面。
//   node tests/e2e/world-pixels.mjs dump a.json      # 在旧版本上
//   node tests/e2e/world-pixels.mjs dump b.json      # 在新版本上
//   node tests/e2e/world-pixels.mjs compare a.json b.json
// 用「减少动态效果」模式（没有粒子、没有亚像素平移、相机直接就位），并由脚本接管动画时钟逐帧推进，
// 画面完全确定：两次构建画面一致时，每个画面的不同像素数都是 0。
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, BASE } from './browser.mjs';

const [mode, a, b] = process.argv.slice(2);

if (mode === 'dump') {
  const browser = await launch();
  const out = {};
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: theme });
    await ctx.addInitScript((th) => {
      localStorage.setItem('theme', th);
      localStorage.setItem('fs-hint', '1');
      Math.random = () => 0.42; // 眨眼、翻页之类的随机时刻也固定下来
      // 接管 requestAnimationFrame：由脚本按固定 16ms 一步推进，帧数和时钟都确定，灯光闪烁也就确定了
      let queue = [];
      let now = 0;
      window.requestAnimationFrame = (cb) => (queue.push(cb), queue.length);
      performance.now = () => now;
      window.__step = (n) => {
        for (let i = 0; i < n; i++) {
          now += 16;
          const q = queue;
          queue = [];
          q.forEach((cb) => cb(now));
        }
      };
    }, theme);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(400); // 图集等图片资源解码完
    await page.evaluate(() => window.__step(30));
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press(String(i));
      await page.waitForTimeout(150);
      await page.evaluate(() => window.__step(60));
      out[`${theme}/${i}`] = await page.evaluate(() =>
        ['#sky', '#world', '#hero'].map((s) => {
          const c = document.querySelector(s);
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let bin = '';
          for (let k = 0; k < d.length; k += 8192) bin += String.fromCharCode(...d.subarray(k, k + 8192));
          return btoa(bin);
        }),
      );
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(a, JSON.stringify(out));
  console.log(`已写入 ${a}（${Object.keys(out).length} 个画面）`);
} else if (mode === 'compare') {
  const A = JSON.parse(readFileSync(a, 'utf8'));
  const B = JSON.parse(readFileSync(b, 'utf8'));
  let worst = 0;
  for (const key of Object.keys(A)) {
    const diffs = A[key].map((layer, li) => {
      const x = Buffer.from(layer, 'base64');
      const y = Buffer.from(B[key]?.[li] ?? '', 'base64');
      if (x.length !== y.length) return Infinity;
      let n = 0;
      for (let k = 0; k < x.length; k += 4) if (x[k] !== y[k] || x[k + 1] !== y[k + 1] || x[k + 2] !== y[k + 2] || x[k + 3] !== y[k + 3]) n++;
      return n;
    });
    const total = x => x.reduce((s, v) => s + v, 0);
    worst = Math.max(worst, total(diffs));
    console.log(`${key.padEnd(8)} 天空 ${diffs[0]}  世界 ${diffs[1]}  主角 ${diffs[2]}  （不同像素数）`);
  }
  process.exitCode = worst === 0 ? 0 : 1;
} else {
  console.error('用法：world-pixels.mjs dump <file> | compare <a> <b>');
  process.exitCode = 2;
}
