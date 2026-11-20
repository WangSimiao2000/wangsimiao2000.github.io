/**
 * 开发服务器：node build/dev.mjs [port]
 * - 只监听 127.0.0.1
 * - 静态文件见 serve.mjs
 * - src/ build/ public/ 有改动就在子进程里重新构建（模板模块每次都是新加载的），完成后通知浏览器刷新
 */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { serveStatic } from './serve.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4399);

/** @type {Set<http.ServerResponse>} */
const clients = new Set();

let building = false;
let pending = false;
function rebuild() {
  if (building) { pending = true; return; }
  building = true;
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'build/build.mjs', '--dev'], { cwd: ROOT, stdio: 'inherit' });
  child.on('exit', (code) => {
    building = false;
    if (code === 0) for (const c of clients) c.write('data: reload\n\n');
    if (pending) { pending = false; rebuild(); }
  });
}

let timer;
for (const dir of ['src', 'build', 'public']) {
  watch(path.join(ROOT, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 80);
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__reload') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    return serveStatic(req, res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`dev server: http://127.0.0.1:${PORT}/`);
    rebuild();
  });
