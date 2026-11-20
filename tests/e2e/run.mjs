// 浏览器测试一条命令跑完：npm run test:e2e（PLAYWRIGHT_CORE 指向装了 playwright-core 的目录，见 browser.mjs）
//   先构建（--no-build 跳过），在随机端口起 dist/ 的静态服务器（build/serve.mjs，和开发服务器同一份），
//   逐个跑测试（BASE_URL 指过去），最后关掉服务器、汇总。
//   默认跑不需要 WebGPU 画面的那些（CI 里也跑这些）；--webgpu 再加上要软件渲染 WebGPU 的（慢，只在本地）。
//   也可以只跑几个：npm run test:e2e -- flow readerbar
// world-pixels.mjs 是画面对比工具（dump / compare 两次构建），不在这里跑。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { startStatic } from '../../build/serve.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BASIC = ['flow', 'first-paint', 'readerbar', 'scenic', 'time-slider', 'card-fit', 'games', 'about-layout', 'update', 'legacy-sw'];
const WEBGPU = ['webgpu'];

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const named = args.filter((a) => !a.startsWith('--'));
const tests = named.length ? named : [...BASIC, ...(flags.has('--webgpu') ? WEBGPU : [])];

/** 跑一个子进程，等它退出（异步：服务器在同一个进程里，阻塞式的 spawnSync 会让它没法响应） */
const run = (file, env = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', file], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('exit', (code) => resolve(code ?? 1));
  });

if (!flags.has('--no-build') && (await run('build/build.mjs')) !== 0) process.exit(1);
const { server, url } = await startStatic();
console.log(`静态服务器：${url}`);
const failed = [];
for (const t of tests) {
  console.log(`\n=== ${t}`);
  if ((await run(`tests/e2e/${t}.mjs`, { BASE_URL: url })) !== 0) failed.push(t);
}
server.close();
console.log(failed.length ? `\n失败：${failed.join('、')}` : `\n${tests.length} 个浏览器测试全部通过`);
process.exit(failed.length ? 1 : 0);
