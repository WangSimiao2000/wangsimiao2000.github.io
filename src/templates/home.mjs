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
  { id: 'home', label: '起点', biome: '草原' },
  { id: 'posts', label: '博文', biome: '森林' },
  { id: 'tools', label: '工具', biome: '沙漠' },
  { id: 'server', label: '服务器', biome: '村庄' },
  { id: 'friends', label: '友链', biome: '樱花林' },
  { id: 'about', label: '关于', biome: '雪原' },
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
  <p class="more"><a class="btn" href="/archives/">全部文章</a><a class="btn" href="/browse/">分类与标签</a></p>`;

const toolGrid = ({ tools }) => html`
  <ul class="grid">
    ${tools.map(
      (t) => html`
      <li><a class="slot-link" href="${t.url}"><span><span class="item-name">${t.name}</span><span class="item-desc">${t.description}</span></span></a></li>`,
    )}
  </ul>`;

const server = () => html`
  <div class="server" data-mc-status>
    <p class="server-desc">我和朋友们的 Minecraft 生存服，白名单制，跑在家里的一台小主机上。</p>
    <dl class="stats">
      <div><dt>状态</dt><dd data-k="state">读取中…</dd></div>
      <div><dt>在线</dt><dd data-k="players">-</dd></div>
      <div><dt>版本</dt><dd data-k="version">-</dd></div>
      <div><dt>已运行</dt><dd data-k="uptime">-</dd></div>
    </dl>
    <p class="server-foot" data-k="updated">每 10 分钟更新一次</p>
  </div>`;

const friendGrid = ({ friends }) => html`
  <ul class="grid friends">
    ${friends.map(
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
  <p class="more"><a class="btn" href="/friends/">友链页面</a></p>`;

const about = () => html`
  <div class="about">
    <p class="hero-name">嗨，我是${site.author}</p>
    <p>图形渲染开发工程师 @ 小米。喜欢图形学、游戏和折腾服务器。</p>
    <p class="more">
      <a class="btn" href="/about/">完整介绍</a>
      <a class="btn" href="${site.links.github}" target="_blank" rel="noopener">GitHub</a>
      <a class="btn" href="${site.links.bilibili}" target="_blank" rel="noopener">Bilibili</a>
      <a class="btn" href="${site.links.steam}" target="_blank" rel="noopener">Steam</a>
    </p>
  </div>`;

const CONTENT = { home: hero, posts: postList, tools: toolGrid, server, friends: friendGrid, about };

/** @param {{ posts: any[], friends: any[], tools: any[], asset: (p: string) => string, extraHead?: string }} ctx */
export function homePage(ctx) {
  const body = html`
  <canvas id="world" aria-hidden="true"></canvas>
  ${topbar()}
  <main>
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
      (s, i) => html`<a class="hb-slot" href="#${s.id}" title="${s.label}（${i + 1}）"><span class="hb-num" aria-hidden="true">${i + 1}</span><span class="hb-label">${s.label}</span></a>`,
    )}
  </nav>`;
  return layout({ title: site.title, path: '/', asset: ctx.asset, css: ['css/home.css'], js: ['js/home.js'], body, extraHead: ctx.extraHead });
}
