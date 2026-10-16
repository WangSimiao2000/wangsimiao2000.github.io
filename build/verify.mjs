/**
 * 构建产物检查：node build/verify.mjs（CI 里在部署前跑，任何一项失败就不部署，线上旧版本不受影响）
 * - 关键页面和文件都生成了
 * - 每篇文章都有页面
 * - 所有站内链接 / 图片 / 脚本 / 样式指向的文件都存在（替代旧站的 htmlproofer）
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
// 同域但由别的仓库提供的路径（各自仓库的 GitHub Pages），本站产物里没有
const EXTERNAL = ['/bazi-fortune/', '/mc-status/'];

const errors = [];
const exists = (p) => stat(p).then(() => true, () => false);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

for (const f of ['index.html', '404.html', 'feed.xml', 'sitemap.xml', 'robots.txt', 'CNAME', 'archives/index.html', 'browse/index.html', 'friends/index.html', 'about/index.html', 'tools/index.html']) {
  if (!(await exists(path.join(DIST, f)))) errors.push(`缺少 ${f}`);
}

const sources = (await readdir(path.join(ROOT, 'src/content/posts'))).filter((f) => f.endsWith('.md'));
const postPages = (await readdir(path.join(DIST, 'posts'))).length;
if (postPages !== sources.length) errors.push(`文章页 ${postPages} 个，源文件 ${sources.length} 篇`);

const files = await walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const checked = new Map();
let links = 0;
for (const file of htmlFiles) {
  const text = await readFile(file, 'utf8');
  for (const m of text.matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
    const url = m[1];
    if (url.startsWith('//') || EXTERNAL.some((e) => url.startsWith(e))) continue;
    links++;
    let ok = checked.get(url);
    if (ok === undefined) {
      let rel;
      try {
        rel = decodeURIComponent(url);
      } catch {
        rel = url;
      }
      const target = path.join(DIST, rel);
      ok = rel.endsWith('/') ? await exists(path.join(target, 'index.html')) : await exists(target);
      checked.set(url, ok);
    }
    if (!ok) errors.push(`${path.relative(DIST, file)} -> ${url} 不存在`);
  }
}

if (errors.length) {
  console.error(`检查失败（${errors.length} 项）：`);
  for (const e of [...new Set(errors)].slice(0, 50)) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`检查通过：${htmlFiles.length} 个页面、${sources.length} 篇文章、${links} 个站内链接`);
