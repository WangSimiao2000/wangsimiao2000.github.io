/**
 * 前端资源：src/assets 下的 .ts 用 Node 自带的类型擦除转成 .js（不打包，浏览器直接按 ES 模块加载），
 * .css/.js 原样复制；KaTeX 的样式和字体从 node_modules 拷过来。
 * 全部资源按内容算一个总哈希，输出到 /_s/<hash>/，内容变了目录就变，浏览器缓存自然失效。
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src/assets');
const KATEX = path.join(ROOT, 'node_modules/katex/dist');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

/**
 * @param {string} dist 输出根目录
 * @returns {Promise<(p: string) => string>} 把 'css/base.css' 映射成 '/_s/<hash>/css/base.css'
 */
export async function buildAssets(dist) {
  /** @type {{ rel: string, data: string | Buffer }[]} */
  const files = [];
  for (const file of await walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (file.endsWith('.ts')) {
      const js = stripTypeScriptTypes(await readFile(file, 'utf8'), { mode: 'strip' });
      files.push({ rel: rel.replace(/\.ts$/, '.js'), data: js });
    } else {
      files.push({ rel, data: await readFile(file) });
    }
  }
  const katexCss = await readFile(path.join(KATEX, 'katex.min.css'));

  const h = createHash('sha256');
  for (const f of files.sort((a, b) => a.rel.localeCompare(b.rel))) h.update(f.rel).update(f.data);
  h.update(katexCss);
  const base = `/_s/${h.digest('hex').slice(0, 10)}/`;
  const outDir = path.join(dist, base);

  for (const f of files) {
    const target = path.join(outDir, f.rel);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, f.data);
  }
  await mkdir(path.join(outDir, 'katex'), { recursive: true });
  await writeFile(path.join(outDir, 'katex/katex.min.css'), katexCss);
  // 只拷 woff2，现代浏览器都支持；katex.min.css 里的 woff/ttf 回退请求不会发生
  await mkdir(path.join(outDir, 'katex/fonts'), { recursive: true });
  for (const font of await readdir(path.join(KATEX, 'fonts'))) {
    if (font.endsWith('.woff2')) await cp(path.join(KATEX, 'fonts', font), path.join(outDir, 'katex/fonts', font));
  }
  // 这一版资源的文件清单：下次部署时据此把这一版整套留在线上（见 build/keep-previous.mjs）
  const list = (await walk(outDir)).map((f) => path.relative(outDir, f).split(path.sep).join('/')).sort();
  await writeFile(path.join(outDir, 'files.txt'), list.join('\n') + '\n');

  return (p) => base + p.replace(/^\//, '');
}
