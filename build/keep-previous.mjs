/**
 * 部署前把「线上当前那一版」的资源目录 /_s/<哈希>/ 原样拷进新产物。
 *
 * GitHub Pages 让 HTML 固定缓存 10 分钟，部署后的这段时间里，访客可能还拿着旧 HTML，
 * 它引用的是旧哈希目录。每次部署又是整站替换，旧目录不在了，样式和脚本就会 404。
 * 留住上一版，旧 HTML 照样能拿到配套的资源；前端发现版本变了会自己换到新版（router.ts）。
 *
 * 只留一版：上一版自己留下的更早版本不再带上。任何一步失败都只打印、不中断部署。
 * 用法：node build/keep-previous.mjs [站点地址]，默认 https://blog.mickeymiao.cn
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = (process.argv[2] ?? 'https://blog.mickeymiao.cn').replace(/\/$/, '');
const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const VERSION_RE = /^\/_s\/[0-9a-f]+\/$/;

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r;
}

async function main() {
  const mine = JSON.parse(await readFile(path.join(DIST, 'version.json'), 'utf8')).assets;
  let live;
  try {
    live = (await (await get(`${SITE}/version.json?t=${Date.now()}`)).json()).assets;
  } catch {
    // 还没有 version.json 的老版本：从首页里认出它引用的资源目录
    live = (await (await get(`${SITE}/?t=${Date.now()}`)).text()).match(/\/_s\/[0-9a-f]+\//)?.[0];
  }
  if (!live || !VERSION_RE.test(live)) return console.log('keep-previous: 认不出线上版本，跳过');
  if (live === mine) return console.log(`keep-previous: 线上就是这一版 ${live}，不用保留`);

  let list;
  try {
    list = (await (await get(`${SITE}${live}files.txt`)).text()).split('\n').filter(Boolean);
  } catch (e) {
    return console.log(`keep-previous: 线上 ${live} 没有文件清单（${e.message}），跳过`);
  }
  // 清单来自线上，只接受普通的相对路径
  list = list.filter((f) => /^[\w.-]+(\/[\w.-]+)*$/.test(f) && !f.split('/').includes('..'));

  let ok = 0;
  let bytes = 0;
  const queue = [...list];
  const worker = async () => {
    for (let f; (f = queue.shift()); ) {
      try {
        const data = Buffer.from(await (await get(`${SITE}${live}${f}`)).arrayBuffer());
        const target = path.join(DIST, live, f);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, data);
        ok++;
        bytes += data.length;
      } catch (e) {
        console.log(`keep-previous: ${f} 下载失败：${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`keep-previous: 保留上一版 ${live}，${ok}/${list.length} 个文件，${(bytes / 1024).toFixed(0)} KB`);
}

main().catch((e) => console.log(`keep-previous: 跳过（${e.message}）`));
