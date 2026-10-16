/**
 * 像素风首页：纵向滚动 = 小人向前跑，每屏停在一个新的群系，上方显示对应板块。
 * 世界由 assets/js/pixel/world.ts 在 canvas 上实时生成；这里只负责内容与布局。
 * 没有 JS 时各板块按普通页面纵向排列，内容仍完整可读。
 */
import { html } from '../../build/html.mjs';
import { site } from '../site.mjs';
import { layout, topbar } from './layout.mjs';
import { formatDate } from './util.mjs';

const SECTIONS = [
  { id: 'home', label: '起点', biome: '草甸' },
  { id: 'posts', label: '博文', biome: '森林' },
  { id: 'tools', label: '工具', biome: '沙丘' },
  { id: 'server', label: '服务器', biome: '小镇' },
  { id: 'friends', label: '友链', biome: '花林' },
  { id: 'about', label: '关于', biome: '雪松林' },
];

const hero = ({ posts, friends }) => {
  const categories = new Set(posts.flatMap((p) => p.categories)).size;
  return html`
    <div class="hero">
      <img class="avatar" src="${site.avatar}" alt="" width="96" height="96">
      <div>
        <p class="hero-name">${site.title}</p>
        <p class="hero-tag">${site.tagline}</p>
        <p class="hero-meta">${posts.length} 篇文章 · ${categories} 个分类 · ${friends.length} 位朋友</p>
      </div>
      <p class="hint">向下滑动，出发 <span aria-hidden="true">▼</span><span class="hint-keys">（或按 1-${SECTIONS.length} 直达）</span></p>
    </div>`;
};

const postList = ({ posts }) => html`
  <ol class="post-list">
    ${posts.slice(0, 6).map(
      (p) => html`
      <li>
        <a href="${p.url}">
          <span class="post-title">${p.pin ? html`<span class="pin">置顶</span>` : ''}${p.title}</span>
          <span class="post-meta"><time datetime="${p.date.toISOString()}">${formatDate(p.date)}</time>${p.categories.length ? ` · ${p.categories.join(' / ')}` : ''}</span>
        </a>
      </li>`,
    )}
  </ol>
  <p class="more"><a class="btn btn-open" href="/archives/">查看全部 ${posts.length} 篇<span class="open-icon" aria-hidden="true"></span></a><a class="btn btn-open" href="/browse/">分类与标签<span class="open-icon" aria-hidden="true"></span></a></p>`;

/** 工具卡片：web 工具是同域的独立页面（仓库自己的 Pages），整页打开；repo 链到 GitHub */
export const toolLink = (t) =>
  t.kind === 'web'
    ? html`<a class="slot-link tool" href="${t.url}" data-no-router><span><span class="item-name">${t.name}<span class="tool-badge on">在线使用</span></span><span class="item-desc">${t.description}</span></span></a>`
    : html`<a class="slot-link tool" href="https://github.com/${t.repo}" target="_blank" rel="noopener"><span><span class="item-name">${t.name}${t.lang ? html`<span class="tool-badge">${t.lang}</span>` : ''}</span><span class="item-desc">${t.description}</span></span></a>`;

const toolGrid = ({ tools }) => html`
  <ul class="grid tools">
    ${tools.slice(0, 4).map((t) => html`<li>${toolLink(t)}</li>`)}
  </ul>
  <p class="more"><a class="btn btn-open" href="/tools/">查看全部 ${tools.length} 个工具<span class="open-icon" aria-hidden="true"></span></a></p>`;

const server = () => html`
  <div class="server" data-mc-status>
    <p class="server-desc">我和朋友们的 Minecraft 生存服，白名单制，跑在家里的一台小主机上。想一起玩就加 QQ 群
      <button type="button" class="qq-chip" data-copy="${site.qqGroup}" title="点击复制群号">${site.qqGroup}<span class="qq-copied" aria-live="polite"></span></button></p>
    <dl class="stats">
      <div><dt>状态</dt><dd data-k="state">读取中…</dd></div>
      <div><dt>在线</dt><dd data-k="players">-</dd></div>
      <div><dt>版本</dt><dd data-k="version">-</dd></div>
      <div><dt>已开服</dt><dd data-k="uptime">-</dd></div>
    </dl>
    <figure class="spark-box" hidden><svg data-spark preserveAspectRatio="none" aria-hidden="true"></svg><figcaption>最近 24 小时在线人数</figcaption></figure>
    <p class="server-foot" data-k="updated">每 10 分钟更新一次</p>
  </div>`;

const friendGrid = ({ friends, graveyard }) => html`
  <ul class="grid friends">
    ${friends.slice(0, 6).map(
      (f) => html`
      <li>
        <a class="slot-link" href="${f.url}" target="_blank" rel="noopener">
          ${f.icon
            ? html`<img src="${f.icon}" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">`
            : html`<span class="noicon" aria-hidden="true">${String(f.name).slice(0, 1)}</span>`}
          <span><span class="item-name">${f.name}</span>${f.description ? html`<span class="item-desc">${f.description}</span>` : ''}</span>
        </a>
      </li>`,
    )}
  </ul>
  <p class="more"><a class="btn btn-open" href="/friends/">查看全部友链（${friends.length + (graveyard?.length ?? 0)}）<span class="open-icon" aria-hidden="true"></span></a></p>`;

const about = () => html`
  <div class="about">
    <p class="hero-name">嗨，我是${site.author}</p>
    <p>图形渲染开发工程师 @ 小米。喜欢图形学、游戏和折腾服务器。</p>
    <p class="more">
      <a class="btn btn-open" href="/about/">完整介绍<span class="open-icon" aria-hidden="true"></span></a>
      <a class="btn" href="${site.links.github}" target="_blank" rel="noopener">GitHub</a>
      <a class="btn" href="${site.links.bilibili}" target="_blank" rel="noopener">Bilibili</a>
      <a class="btn" href="${site.links.steam}" target="_blank" rel="noopener">Steam</a>
    </p>
  </div>`;

/** 评论区占位：阅读面板打开后由 comments.ts 按当前地址加载 Giscus */
export const comments = () => html`
    <section class="comments" aria-label="评论">
      <p class="side-title">评论</p>
      <div class="giscus" data-giscus
        data-repo="${site.giscus.repo}" data-repo-id="${site.giscus.repoId}"
        data-category="${site.giscus.category}" data-category-id="${site.giscus.categoryId}"></div>
      <noscript><p class="comments-off">评论需要启用 JavaScript。</p></noscript>
    </section>`;

const CONTENT = { home: hero, posts: postList, tools: toolGrid, server, friends: friendGrid, about };

/** 板块 id -> 序号与名称，路由和阅读面板用 */
export const sectionOf = (id) => {
  const i = SECTIONS.findIndex((s) => s.id === id);
  return { index: Math.max(0, i), ...SECTIONS[Math.max(0, i)] };
};

/**
 * 整站共用的世界外壳：像素世界 + 各板块卡片 + 快捷栏，外加一个阅读面板。
 * 首页的阅读面板为空；文章等页面把正文放进阅读面板，打开时世界和小人仍在下方。
 * 没有 JS 时，有正文的页面只显示正文（板块卡片隐藏），首页按普通页面纵向排列。
 *
 * @param {{ posts: any[], friends: any[], tools: any[], asset: (p: string) => string, extraHead?: string }} ctx
 * @param {{ title?: string, description?: string, path?: string, type?: 'website' | 'article', math?: boolean,
 *   reader?: { section: string, body: unknown, left?: unknown, right?: unknown, toc?: boolean } }} [page]
 *   left / right：面板两侧的卡片（文章的目录、信息），toc：顶栏放「目录」按钮（窄屏时打开左侧卡片）
 */
export function shell(ctx, page = {}) {
  const reader = page.reader;
  const sec = reader ? sectionOf(reader.section) : null;
  const body = html`
  <canvas id="world" aria-hidden="true"></canvas>
  ${topbar()}
  <main class="stages">
    ${SECTIONS.map(
      (s, i) => html`
    <section id="${s.id}" class="stage" aria-labelledby="${s.id}-title">
      <div class="panel" data-panel="${i}">
        <div class="card">
          <h2 class="card-title" id="${s.id}-title"><span class="title-dot" aria-hidden="true"></span><span>${s.label}</span><span class="biome-chip">${s.biome}</span></h2>
          ${CONTENT[s.id](ctx)}
        </div>
      </div>
    </section>`,
    )}
  </main>
  <nav class="hotbar" aria-label="板块">
    ${SECTIONS.map(
      (s, i) => html`<a class="hb-slot" href="/#${s.id}" title="${s.label}（${i + 1}）"><span class="hb-label">${s.label}</span></a>`,
    )}
  </nav>
  <div class="search" data-search hidden role="dialog" aria-modal="true" aria-label="搜索文章">
    <div class="search-card card">
      <div class="search-bar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input type="search" data-search-input placeholder="搜索文章标题和正文" aria-label="搜索关键词" autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd>
      </div>
      <p class="search-hint" data-search-hint aria-live="polite">输入关键词开始搜索</p>
      <ol class="search-results" data-search-results></ol>
    </div>
  </div>
  <div class="reader" data-reader ${reader ? '' : 'hidden'}>
    ${reader
      ? html`
    ${reader.left ?? ''}
    <div class="reader-card card" data-section="${sec.id}">
      <div class="reader-bar">
        <a class="reader-back" href="/#${sec.id}" data-reader-close><span aria-hidden="true">←</span> 回到${sec.biome}</a>
        <span class="reader-bar-end">
          ${reader.toc ? html`<button type="button" class="toc-btn" data-toc-toggle aria-expanded="false" aria-controls="reader-toc">目录</button>` : ''}
          <span class="reader-hint">Esc 关闭</span>
        </span>
      </div>
      <div class="reader-scroll" data-reader-scroll tabindex="-1">
        ${reader.body}
      </div>
    </div>
    ${reader.right ?? ''}`
      : ''}
  </div>`;
  return layout({
    title: page.title ?? site.title,
    description: page.description,
    path: page.path ?? '/',
    type: page.type,
    asset: ctx.asset,
    css: ['css/home.css', 'css/post.css'],
    js: ['js/home.js'],
    math: page.math,
    reading: !!reader,
    body,
    extraHead: ctx.extraHead,
  });
}

/** @param {{ posts: any[], friends: any[], tools: any[], asset: (p: string) => string, extraHead?: string }} ctx */
export const homePage = (ctx) => shell(ctx);
