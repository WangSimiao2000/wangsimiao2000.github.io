/**
 * 构建入口：node build/build.mjs [--dev]
 * 1. 清空 dist/，复制 public/
 * 2. 构建前端资源（带内容哈希目录）
 * 3. 渲染首页与每篇文章
 */
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildAssets } from './assets.mjs';
import { loadData, loadPosts } from './content.mjs';
import { excerpt, renderMarkdown } from './markdown.mjs';
import { atomFeed, robots, sitemap } from './feeds.mjs';
import { homePage } from '../src/templates/home.mjs';
import { postPage } from '../src/templates/post.mjs';
import {
  aboutPage,
  archivesPage,
  browsePage,
  categoryPage,
  friendsPage,
  notFoundPage,
  tagPage,
  redirectPage,
  taxonomy,
  toolsPage,
} from '../src/templates/pages.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
// 先构建到临时目录，完成后整体换上去：开发服务器的自动重建和手动构建同时跑时，
// 不会互相删掉对方刚复制的文件（曾因此丢过 dist/assets/img，图片全部 404）
const OUT = `${DIST}.tmp-${process.pid}`;
const dev = process.argv.includes('--dev');

/** 开发模式：页面里注入一段 SSE 监听，构建完成后自动刷新 */
const DEV_RELOAD = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;

async function emit(urlPath, content) {
  const file = urlPath.endsWith('/') ? path.join(OUT, urlPath, 'index.html') : path.join(OUT, urlPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, String(content));
}

export async function build() {
  const t0 = performance.now();
  await rm(OUT, { recursive: true, force: true });
  await cp(path.join(ROOT, 'public'), OUT, { recursive: true });

  const [asset, posts, friends, tools] = await Promise.all([
    buildAssets(OUT),
    loadPosts(),
    loadData('friends'),
    loadData('tools'),
  ]);
  const extraHead = dev ? DEV_RELOAD : '';

  // 友链检测结果（build/check-friends.mjs 生成）：失效的进「数字墓园」，首页只展示存活的
  const checked = await readFile(path.join(ROOT, 'src/data/friends-checked.json'), 'utf8')
    .then((t) => JSON.parse(t))
    .catch(() => null);
  const dead = new Set(checked?.dead ?? []);
  const alive = friends.filter((f) => !dead.has(f.url));
  const graveyard = friends.filter((f) => dead.has(f.url));
  const home = { posts, friends: alive, graveyard, friendsCheckedAt: checked?.checkedAt ?? null, tools, asset, extraHead };
  await emit('/', homePage(home));

  // 上一篇 / 下一篇按发布时间，不受置顶影响
  const byDate = [...posts].sort((a, b) => b.date - a.date);
  const rendered = new Map();
  await Promise.all(
    byDate.map((post, i) => {
      const content = renderMarkdown(post.body, { math: post.math });
      rendered.set(post, content.html);
      return emit(
        post.url,
        postPage({ post, content, prev: byDate[i - 1], next: byDate[i + 1], excerpt: excerpt(post.body), home }),
      );
    }),
  );

  // 各板块完整页 + 分类 / 标签页（地址沿用旧站）
  const tax = taxonomy(posts);
  const pages = [
    ['/archives/', archivesPage(home)],
    ['/browse/', browsePage(home)],
    ['/tools/', toolsPage(home)],
    ['/friends/', friendsPage(home)],
    ['/about/', aboutPage(home)],
    ...[...tax.cats.values()].map((c) => [`/browse/categories/${c.slug}/`, categoryPage(home, c, tax)]),
    ...[...tax.tags.values()].map((t) => [`/browse/tags/${t.slug}/`, tagPage(home, t)]),
    // 迁走的工具：旧地址跳到仓库自己的 Pages
    ...tools.filter((t) => t.legacy).map((t) => [t.legacy, redirectPage(t.url)]),
  ];
  // 旧首页分页（每页 10 篇）：/page2/ ... 跳到归档
  const legacyPages = [];
  for (let n = 2; n <= Math.max(6, Math.ceil(posts.length / 10)); n++) legacyPages.push([`/page${n}/`, redirectPage('/archives/')]);
  await Promise.all([...pages, ...legacyPages].map(([url, page]) => emit(url, page)));
  await emit('/404.html', notFoundPage(home));

  // 订阅、站点地图：只收真正的页面（跳转页不收）
  await emit('/feed.xml', atomFeed(byDate, (p) => rendered.get(p)));
  const lastPost = byDate[0]?.updated ?? byDate[0]?.date;
  await emit(
    '/sitemap.xml',
    sitemap([
      { path: '/', lastmod: lastPost },
      ...byDate.map((p) => ({ path: p.url, lastmod: p.updated ?? p.date })),
      ...pages.filter(([url]) => !tools.some((t) => t.legacy === url)).map(([url]) => ({ path: url })),
    ]),
  );
  await emit('/robots.txt', robots());

  // 站内搜索索引（Pagefind）：只收文章正文（模板里标了 data-pagefind-body），按中文分词
  const pagefind = await import('pagefind');
  const { index, errors } = await pagefind.createIndex({ forceLanguage: 'zh-cn' });
  if (!index) throw new Error(`Pagefind: ${errors.join('; ')}`);
  const added = await index.addDirectory({ path: OUT });
  if (added.errors.length) throw new Error(`Pagefind: ${added.errors.join('; ')}`);
  await index.writeFiles({ outputPath: path.join(OUT, 'pagefind') });
  await pagefind.close();

  // 换上新产物：旧目录先挪开再删，替换本身是两次 rename，几乎是瞬时的
  const old = `${DIST}.old-${process.pid}`;
  await rename(DIST, old).catch(() => {});
  await rename(OUT, DIST);
  await rm(old, { recursive: true, force: true });

  console.log(`built ${posts.length + 2 + pages.length} pages (${added.page_count} indexed) in ${Math.round(performance.now() - t0)} ms`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch(async (err) => {
    await rm(OUT, { recursive: true, force: true });
    console.error(err);
    process.exit(1);
  });
}
