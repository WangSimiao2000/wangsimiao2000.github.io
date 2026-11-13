/**
 * 给百度「普通收录」主动推送：GitHub Pages 屏蔽了百度的爬虫，百度自己抓不到，只能部署后把地址推过去。
 * 只在部署流程里跑（.github/workflows/pages-deploy.yml）。
 *
 * 从构建好的 dist/sitemap.xml 里挑首页、最近 DAYS 天新增或更新过的地址，再轮流补推旧文章，最多 LIMIT 条
 * （新站每天的推送额度很少，常见是 10 条），POST 给百度。每天凌晨的定时重建也推，旧文章几天就能轮完一遍。密钥从环境变量 BAIDU_PUSH_TOKEN 读，
 * 来自仓库 Secret，不进代码也不打印；没有密钥就跳过。
 *
 * 用法：node build/baidu-push.mjs [--dry-run]（--dry-run 只打印要推的地址，不推送）
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://blog.mickeymiao.cn';
const DAYS = 3;
const LIMIT = 10;

/** 从 sitemap 的文本里取出 [地址, 最后修改时间（毫秒，没有就是 0）] */
export function parseSitemap(xml) {
  const out = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
    const mod = m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    if (loc) out.push([loc.trim(), mod ? Date.parse(mod) || 0 : 0]);
  }
  return out;
}

/**
 * 挑要推送的地址，最多 limit 条：
 *   首页，最近 days 天改过的（新的在前），剩下的名额按日期轮流补推旧文章（/posts/ 下的）：
 *   每天从上次停下的地方往后取，一轮推完再从头来。新站每天额度少，这样几天就能把旧文章都推一遍，之后定期再提醒百度
 */
export function pick(entries, now = Date.now(), days = DAYS, limit = LIMIT) {
  if (!entries.length) return [];
  const [home, ...rest] = entries;
  const recent = rest.filter(([, t]) => t && now - t <= days * 86400e3).sort((a, b) => b[1] - a[1]);
  const out = [home, ...recent].slice(0, limit).map(([u]) => u);
  const old = rest.filter(([u]) => u.includes('/posts/') && !out.includes(u)).map(([u]) => u);
  const room = limit - out.length;
  if (room > 0 && old.length) {
    const start = (Math.floor(now / 86400e3) * room) % old.length;
    for (let k = 0; k < Math.min(room, old.length); k++) out.push(old[(start + k) % old.length]);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = path.resolve(import.meta.dirname, '../dist');
  const urls = pick(parseSitemap(await readFile(path.join(dist, 'sitemap.xml'), 'utf8')));
  console.log(urls.join('\n'));
  const token = process.env.BAIDU_PUSH_TOKEN;
  if (process.argv.includes('--dry-run')) process.exit(0);
  if (!token) {
    console.log('没有 BAIDU_PUSH_TOKEN，跳过');
    process.exit(0);
  }
  const res = await fetch(`http://data.zz.baidu.com/urls?site=${encodeURIComponent(SITE)}&token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: urls.join('\n'),
    signal: AbortSignal.timeout(30_000),
  });
  // 百度返回 {"success": 推了几条, "remain": 今天还剩几条}，或者 {"error": ..., "message": ...}
  console.log(res.status, await res.text());
  if (!res.ok) process.exit(1);
}
