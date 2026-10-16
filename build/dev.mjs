/**
 * 开发服务器：node build/dev.mjs [port]
 * - 只监听 127.0.0.1
 * - src/ build/ public/ 有改动就在子进程里重新构建（模板模块每次都是新加载的），完成后通知浏览器刷新
 */
import { spawn } from 'node:child_process';
import { createReadStream, watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4399);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
};

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
    // 解码后再规范化，确保落在 dist/ 内（防目录穿越）
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
    let file = path.normalize(path.join(DIST, rel));
    if (file !== DIST && !file.startsWith(DIST + path.sep)) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(file)).isDirectory()) {
        // 和 GitHub Pages 一样：目录不带斜杠时 301
        if (!rel.endsWith('/')) { res.writeHead(301, { location: rel + '/' }).end(); return; }
        file = path.join(file, 'index.html');
      }
      await stat(file);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`dev server: http://127.0.0.1:${PORT}/`);
    rebuild();
  });
