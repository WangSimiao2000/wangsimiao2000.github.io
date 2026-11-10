// e2e 共用：找 playwright-core 和浏览器。playwright-core 不放进项目依赖（访客和构建都用不到），
// 需要跑 e2e 时装在别处，用 PLAYWRIGHT_CORE=<含 node_modules 的目录> 指过来。
// 浏览器默认用 ~/.cache/ms-playwright 里的 headless shell（快，交互和时序测试用它）。
// launch({ webgpu: true }) 换成完整版 Chromium + SwiftShader（软件 Vulkan）：headless shell 能拿到 WebGPU 设备，
// 但画不到画布上。软件合成只有十几帧每秒，所以只给要看 WebGPU 画面的测试用。
// 也可以用 CHROME=<可执行文件> 指定浏览器。
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'];

function findBrowser(webgpu) {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache/ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dirs = readdirSync(cache);
  if (webgpu) {
    const full = dirs.find((d) => /^chromium-\d+$/.test(d));
    if (full && existsSync(join(cache, full, 'chrome-linux64/chrome'))) return join(cache, full, 'chrome-linux64/chrome');
    console.error('要看 WebGPU 画面需要完整版 Chromium：npx playwright-core install chromium');
    process.exit(2);
  }
  const shell = dirs.find((d) => d.startsWith('chromium_headless_shell'));
  return shell ? join(cache, shell, 'chrome-headless-shell-linux64/chrome-headless-shell') : undefined;
}

/** @param {{ webgpu?: boolean }} [opts] */
export async function launch({ webgpu = false } = {}) {
  let pw;
  try {
    pw = await import('playwright-core');
  } catch {
    const dir = process.env.PLAYWRIGHT_CORE;
    if (!dir) {
      console.error('需要 playwright-core：npm i --prefix <某个目录> playwright-core，然后 PLAYWRIGHT_CORE=<那个目录> 再跑');
      process.exit(2);
    }
    pw = createRequire(join(dir, 'noop.js'))('playwright-core');
  }
  const exe = findBrowser(webgpu);
  return pw.chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: webgpu ? [...WEBGPU_ARGS, '--headless=new'] : [],
  });
}

export const BASE = process.env.BASE_URL || 'http://127.0.0.1:4399';

/** 简单的断言计数，最后按失败数设置退出码 */
export function checker() {
  let fails = 0;
  return {
    ok(cond, msg) {
      console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
      if (!cond) fails++;
    },
    done() {
      console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
      process.exitCode = fails ? 1 : 0;
    },
  };
}
