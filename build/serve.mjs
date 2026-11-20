/**
 * 本地静态服务器（开发服务器 dev.mjs 和浏览器测试 tests/e2e/run.mjs 共用）：和 GitHub Pages 一样服务 dist/
 * （目录不带斜杠 301、找不到返回 404.html），只监听 127.0.0.1。
 * /mc-status/、/mc-map/ 是另外仓库的 Pages，本地没有：转发线上的公开数据；MCMAP_DIR 指向 mc-ops 渲染出的目录时地图读本地文件。
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MCMAP_DIR = process.env.MCMAP_DIR ? path.resolve(process.env.MCMAP_DIR) : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.wgsl': 'text/plain; charset=utf-8',
};

/** 处理一个请求（dev.mjs 在它前面接自己的 /__reload） */
export async function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // 本地调试地图：MCMAP_DIR 指向 mc-ops 渲染出的目录时，/mc-map/ 直接读本地文件
  if (MCMAP_DIR && url.pathname.startsWith('/mc-map/')) {
    const f = path.normalize(path.join(MCMAP_DIR, decodeURIComponent(url.pathname.slice('/mc-map/'.length))));
    if (!f.startsWith(MCMAP_DIR + path.sep)) { res.writeHead(403).end(); return; }
    try {
      await stat(f);
      res.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'image/webp', 'cache-control': 'no-cache' });
      createReadStream(f).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
    return;
  }
  // /mc-status/、/mc-map/ 是另外仓库的 Pages，本地没有：转发线上的公开数据，预览和线上一致
  if (url.pathname.startsWith('/mc-status/') || url.pathname.startsWith('/mc-map/')) {
    try {
      const r = await fetch(new URL(url.pathname, 'https://blog.mickeymiao.cn'));
      // 先读完再写响应头：读的途中出错（断网、浏览器取消）时还能回 502，不会写两次头把开发服务器弄崩
      const body = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
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
    // 和 GitHub Pages 一样返回站点的 404.html
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    createReadStream(path.join(DIST, '404.html')).on('error', () => res.end('404')).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  createReadStream(file).pipe(res);
}

/** 起一个只服务 dist/ 的服务器；port 0 = 随机空闲端口。返回 { server, url } */
export function startStatic(port = 0) {
  const server = http.createServer(serveStatic);
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}
