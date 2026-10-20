/**
 * 除文章外的各板块完整页：都在阅读面板里打开，世界停在所属板块。
 *
 *   博文（森林）  /archives/  /browse/  /browse/categories/<slug>/  /browse/tags/<slug>/
 *   工具（沙丘）  /tools/
 *   友链（花林）  /friends/
 *   关于（雪松林）/about/
 *
 * 分类 / 标签地址沿用旧站（jekyll-archives + slugify），外链和搜索引擎收录都不失效。
 */
import { html } from '../../build/html.mjs';
import { site } from '../site.mjs';
import { ICONS } from './icons.mjs';
import { comments, shell, toolLink } from './home.mjs';
import { categoryUrl, formatDate, slugify, tagUrl } from './util.mjs';

/* ---------- 共用小件 ---------- */

const pageHead = (title, sub) => html`
      <header class="post-head">
        <h1>${title}</h1>
        ${sub ? html`<p class="page-sub">${sub}</p>` : ''}
      </header>`;

/** 文章列表行：标题 + 日期 + 分类，悬停按下 */
const postRows = (posts) => html`
      <ol class="post-list rows">
        ${posts.map(
          (p) => html`
        <li>
          <a href="${p.url}">
            <span class="post-title">${p.pin ? html`<span class="pin">置顶</span>` : ''}${p.title}</span>
            <span class="post-meta"><time datetime="${p.date.toISOString()}">${formatDate(p.date)}</time>${p.categories.length ? ` · ${p.categories.join(' / ')}` : ''}</span>
          </a>
        </li>`,
        )}
      </ol>`;

/** 右侧统计卡片 */
const statsSide = (rows, extra = '') => html`
    <aside class="reader-side side-right card" aria-label="统计">
      <dl class="meta-list">
        ${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}
      </dl>
      ${extra}
    </aside>`;

/** 左侧跳转卡片（复用文章目录的高亮逻辑） */
const jumpSide = (title, items) => html`
    <aside class="reader-side side-left card" id="reader-toc" aria-label="${title}">
      <p class="side-title">${title}</p>
      <div class="read-progress" aria-hidden="true"><span></span></div>
      <ol class="toc-list" data-toc>
        ${items.map((it) => html`<li class="lv2"><a href="#${it.id}">${it.text}</a></li>`)}
      </ol>
    </aside>`;

const byDate = (posts) => [...posts].sort((a, b) => b.date - a.date);
const year = (d) => Number(d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' }).replace(/\D/g, ''));

/** 分类 / 标签索引：按 slug 归并（旧站 C 与 C++ 都是 /c/，这里同样合并） */
export function taxonomy(posts) {
  /** @type {Map<string, { name: string, slug: string, posts: any[], parents: Set<string>, children: Set<string> }>} */
  const cats = new Map();
  /** @type {Map<string, { name: string, slug: string, posts: any[] }>} */
  const tags = new Map();
  for (const p of posts) {
    p.categories.forEach((c, i) => {
      const slug = slugify(c);
      if (!cats.has(slug)) cats.set(slug, { name: c, slug, posts: [], parents: new Set(), children: new Set() });
      const e = cats.get(slug);
      e.posts.push(p);
      if (i > 0) e.parents.add(p.categories[i - 1]);
      if (p.categories[i + 1]) e.children.add(p.categories[i + 1]);
    });
    for (const t of p.tags) {
      const slug = slugify(t);
      if (!tags.has(slug)) tags.set(slug, { name: t, slug, posts: [] });
      tags.get(slug).posts.push(p);
    }
  }
  return { cats, tags };
}

/* ---------- 博文：归档 ---------- */

export function archivesPage(home) {
  const posts = byDate(home.posts);
  const years = [...new Set(posts.map((p) => year(p.date)))];
  const body = html`
    <article class="post">
      ${pageHead('归档', `共 ${posts.length} 篇，按发布时间`)}
      ${years.map(
        (y) => html`
      <section class="year-block">
        <h2 id="y${y}" class="year-title">${y}<span>${posts.filter((p) => year(p.date) === y).length} 篇</span></h2>
        ${postRows(posts.filter((p) => year(p.date) === y))}
      </section>`,
      )}
    </article>`;
  const { cats, tags } = taxonomy(posts);
  return shell(home, {
    title: '归档',
    path: '/archives/',
    reader: {
      section: 'posts',
      body,
      left: jumpSide('年份', years.map((y) => ({ id: `y${y}`, text: String(y) }))),
      right: statsSide(
        [['文章', `${posts.length} 篇`], ['分类', `${cats.size} 个`], ['标签', `${tags.size} 个`]],
        html`<p class="side-links"><a class="btn btn-open" href="/browse/">分类与标签<span class="open-icon" aria-hidden="true"></span></a></p>`,
      ),
      toc: true,
    },
  });
}

/* ---------- 博文：分类与标签 ---------- */

export function browsePage(home) {
  const { cats, tags } = taxonomy(home.posts);
  const tops = [...cats.values()].filter((c) => c.parents.size === 0).sort((a, b) => b.posts.length - a.posts.length);
  const cloud = [...tags.values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, 'zh-CN'));
  const max = Math.max(...cloud.map((t) => t.posts.length));
  const body = html`
    <article class="post">
      ${pageHead('分类与标签', `${cats.size} 个分类 · ${tags.size} 个标签`)}
      <h2 id="categories">分类</h2>
      <ul class="cat-grid">
        ${tops.map(
          (c) => html`
        <li class="cat-card">
          <a class="cat-name" href="${categoryUrl(c.name)}">${c.name}<span>${c.posts.length}</span></a>
          ${c.children.size
            ? html`<p class="cat-subs">${[...c.children].map((s) => html`<a class="tag" href="${categoryUrl(s)}">${s}<span>${cats.get(slugify(s))?.posts.length}</span></a>`)}</p>`
            : ''}
        </li>`,
        )}
      </ul>
      <h2 id="tags">标签</h2>
      <p class="tag-cloud">
        ${cloud.map(
          (t) => html`<a class="tag" href="${tagUrl(t.name)}" style="--w:${(0.35 + (0.65 * t.posts.length) / max).toFixed(2)}">#${t.name}<span>${t.posts.length}</span></a>`,
        )}
      </p>
    </article>`;
  return shell(home, {
    title: '分类与标签',
    path: '/browse/',
    reader: {
      section: 'posts',
      body,
      right: statsSide(
        [['文章', `${home.posts.length} 篇`], ['分类', `${cats.size} 个`], ['标签', `${tags.size} 个`]],
        html`<p class="side-links"><a class="btn btn-open" href="/archives/">按时间归档<span class="open-icon" aria-hidden="true"></span></a></p>`,
      ),
    },
  });
}

export function categoryPage(home, cat, all) {
  const posts = byDate(cat.posts);
  const parents = [...cat.parents];
  const children = [...cat.children];
  const body = html`
    <article class="post">
      ${parents.length ? html`<p class="crumbs">${parents.map((p) => html`<a href="${categoryUrl(p)}">${p}</a>`)}<span aria-hidden="true">/</span></p>` : ''}
      ${pageHead(`分类：${cat.name}`, `${posts.length} 篇`)}
      ${postRows(posts)}
    </article>`;
  const related = [...parents, ...children];
  return shell(home, {
    title: `分类：${cat.name}`,
    path: categoryUrl(cat.name),
    reader: {
      section: 'posts',
      body,
      right: statsSide(
        [['文章', `${posts.length} 篇`], ['最近', formatDate(posts[0].date)]],
        html`
      ${related.length ? html`<p class="side-title">${parents.length ? '上级与下级' : '子分类'}</p><p class="tags side-tags">${related.map((r) => html`<a class="tag" href="${categoryUrl(r)}">${r}<span>${all.cats.get(slugify(r))?.posts.length}</span></a>`)}</p>` : ''}
      <p class="side-links"><a class="btn btn-open" href="/browse/">全部分类<span class="open-icon" aria-hidden="true"></span></a></p>`,
      ),
    },
  });
}

export function tagPage(home, tag) {
  const posts = byDate(tag.posts);
  // 相关标签：与本标签同时出现次数最多的几个
  const co = new Map();
  for (const p of posts) for (const t of p.tags) if (slugify(t) !== tag.slug) co.set(t, (co.get(t) ?? 0) + 1);
  const related = [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const body = html`
    <article class="post">
      ${pageHead(`#${tag.name}`, `${posts.length} 篇`)}
      ${postRows(posts)}
    </article>`;
  return shell(home, {
    title: `标签：${tag.name}`,
    path: tagUrl(tag.name),
    reader: {
      section: 'posts',
      body,
      right: statsSide(
        [['文章', `${posts.length} 篇`], ['最近', formatDate(posts[0].date)]],
        html`
      ${related.length ? html`<p class="side-title">相关标签</p><p class="tags side-tags">${related.map(([t]) => html`<a class="tag" href="${tagUrl(t)}">#${t}</a>`)}</p>` : ''}
      <p class="side-links"><a class="btn btn-open" href="/browse/">全部标签<span class="open-icon" aria-hidden="true"></span></a></p>`,
      ),
    },
  });
}

/* ---------- 工具 ---------- */

export function toolsPage(home) {
  const web = home.tools.filter((t) => t.kind === 'web');
  const repos = home.tools.filter((t) => t.kind !== 'web');
  const body = html`
    <article class="post">
      ${pageHead('工具', '自己写的一些小东西，都开源在 GitHub')}
      ${web.length ? html`<h2 class="group-title">在线使用</h2><ul class="grid big">${web.map((t) => html`<li>${toolLink(t)}</li>`)}</ul>` : ''}
      ${repos.length ? html`<h2 class="group-title">开源项目</h2><ul class="grid big">${repos.map((t) => html`<li>${toolLink(t)}</li>`)}</ul>` : ''}
    </article>`;
  return shell(home, { title: '工具', path: '/tools/', reader: { section: 'tools', body } });
}

/** 旧地址跳转页：/tools/bazi-fortune/ -> /bazi-fortune/ */
export function redirectPage(to) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>已迁移</title>
<link rel="canonical" href="${new URL(to, site.url).href}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${to}"></head>
<body><p>页面已迁移到 <a href="${to}">${to}</a>。</p><script>location.replace(${JSON.stringify(to)} + location.search + location.hash)</script></body></html>
`;
}

/* ---------- 友链 ---------- */

export function friendsPage(home) {
  const body = html`
    <article class="post">
      ${pageHead('友链', `${home.friends.length} 位朋友`)}
      <ul class="grid big friends-full">
        ${home.friends.map(
          (f) => html`
        <li>
          <a class="slot-link" href="${f.url}" target="_blank" rel="noopener">
            ${f.icon
              ? html`<img src="${f.icon}" alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer">`
              : html`<span class="noicon" aria-hidden="true">${String(f.name).slice(0, 1)}</span>`}
            <span><span class="item-name">${f.name}</span>${f.description ? html`<span class="item-desc">${f.description}</span>` : ''}</span>
          </a>
        </li>`,
        )}
      </ul>
      ${home.graveyard?.length
        ? html`
      <h2 class="group-title">数字墓园 <span class="muted small">那些沉睡的站点</span></h2>
      <ul class="grid big graveyard">
        ${home.graveyard.map(
          (f) => html`
        <li><a class="slot-link" href="${f.url}" target="_blank" rel="noopener nofollow"><span class="noicon" aria-hidden="true">✝</span><span><span class="item-name">${f.name}</span>${f.description ? html`<span class="item-desc">${f.description}</span>` : ''}</span></a></li>`,
        )}
      </ul>`
        : ''}
      ${home.friendsCheckedAt ? html`<p class="page-note small">可访问性检测于 ${formatDate(new Date(home.friendsCheckedAt))}，连续访问失败的站点会移到「数字墓园」。</p>` : ''}
      <p class="page-note">想交换友链的话，在下面留言就好：站名、地址、头像、一句话介绍。</p>
    </article>
    ${comments()}`;
  return shell(home, { title: '友链', path: '/friends/', reader: { section: 'friends', body } });
}

/* ---------- 关于 ---------- */

const TRAVEL = [
  '🇬🇧 利兹', '🇬🇧 曼彻斯特', '🇬🇧 伦敦', '🇬🇧 爱丁堡', '🇬🇧 赫尔河畔金斯顿', '🇫🇷 巴黎', '🇬🇷 雅典', '🇬🇷 圣托里尼岛', '🇮🇹 罗马',
  '🇻🇦 梵蒂冈', '🇪🇸 巴塞罗那', '🇪🇸 马德里', '🇵🇹 里斯本', '🇪🇬 开罗', '🇪🇬 卢克索', '🇪🇬 阿斯旺', '🇪🇬 吉萨', '🇪🇬 赫尔格达',
];

/** 二维码浮层：用原生 popover，点按钮打开，点外面或按 Esc 关闭，不需要脚本 */
function qrPopover(id, src, alt, hint) {
  return html`
      <div class="qr-pop" id="${id}" popover>
        <img src="${src}" alt="${alt}" width="220" height="220" loading="lazy">
        <p>${hint}</p>
        <p class="muted small">手机上长按图片识别</p>
      </div>`;
}

/** 图标按钮：只显示图标，名字放在 aria-label 和悬停提示里 */
function icon(name) {
  return html`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;
}
function iconLink(href, name, label) {
  return html`<a class="icon-btn" href="${href}" target="_blank" rel="noopener" aria-label="${label}" title="${label}">${icon(name)}</a>`;
}
function iconBtn(name, label, { pop, copy }) {
  return copy
    ? html`<button type="button" class="icon-btn" popovertarget="${pop}" data-copy="${copy}" data-copy-tip="${pop}-tip" aria-label="${label}" title="${label}">${icon(name)}</button>`
    : html`<button type="button" class="icon-btn" popovertarget="${pop}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
}

export function aboutPage(home) {
  const body = html`
    <article class="post about-page">
      <header class="about-hero">
        <img class="about-photo" src="/assets/img/photo.jpg" alt="${site.author}" width="132" height="132" loading="lazy">
        <div>
          <h1>嗨，我是${site.author} 👋</h1>
          <p class="page-sub">图形渲染开发工程师 @ 小米 · He / Him · 2000.11.06 · 四川成都</p>
          <p class="contact-icons">
            ${iconLink(site.links.github, 'github', 'GitHub')}
            ${iconLink(site.links.bilibili, 'bilibili', 'Bilibili · 鄙人米奇喵')}
            ${iconLink(site.links.steam, 'steam', 'Steam')}
            ${iconBtn('wechat', '微信', { pop: 'qr-wechat' })}
            ${iconBtn('tencentqq', 'QQ', { pop: 'qr-qq' })}
            ${iconBtn('nintendoswitch', 'Switch 好友代码', { pop: 'sw-code', copy: site.switchCode })}
            ${iconLink('/assets/resume/WangSimiao_resume.pdf', 'resume', '简历 PDF')}
          </p>
        </div>
      </header>
      ${qrPopover('qr-wechat', '/assets/img/wechat-qr.png', '微信二维码', '微信扫码加好友')}
      ${qrPopover('qr-qq', '/assets/img/qq-qr.png', 'QQ 二维码', 'QQ 扫码加好友')}
      <div class="qr-pop code-pop" id="sw-code" popover>
        <p class="muted small">Nintendo Switch 好友代码</p>
        <p class="sw-code">${site.switchCode}</p>
        <p class="muted small" id="sw-code-tip" aria-live="polite">正在复制…</p>
      </div>
      <div class="about-grid">
        <section class="about-card">
          <h2>教育背景</h2>
          <p><span class="flag">🇬🇧</span><strong>University of Leeds</strong><br><span class="muted">高性能图形与游戏工程硕士</span></p>
          <p><span class="flag">🇨🇳</span><strong>西南石油大学</strong><br><span class="muted">软件工程学士</span></p>
        </section>
        <section class="about-card">
          <h2>工作 &amp; 爱好</h2>
          <p><span class="flag">🏢</span><strong>小米</strong><br><span class="muted">图形渲染开发工程师</span></p>
          <p>除了写代码，还喜欢<strong>画画</strong>、<strong>做视频</strong>、<strong>玩游戏</strong>。闲暇时间喜欢和朋友们一起做游戏，目前参加过两次 Game Jam。欢迎美术、音效、策划大佬一起组队！</p>
        </section>
        <section class="about-card">
          <h2>游戏</h2>
          <p>最喜欢的游戏是 <strong>Minecraft</strong>，也是一个 B 站小 up，主要更新 Minecraft 视频，不过已经很久没更新了 😅</p>
          <p>PC 上近几年觉得好玩的：Stacklands、潜水员戴夫、博德之门3、绝地潜兵2、动物井</p>
          <p>也玩 <strong>Switch</strong> 游戏，好友代码点上面的 Switch 图标就能复制。</p>
          <p class="muted small">社交手游：王者荣耀欧洲第66上官婉儿 · 和平精英多赛季战神 · 金铲铲多赛季大师</p>
        </section>
        <section class="about-card">
          <h2>猫猫</h2>
          <p>养了两只流浪猫猫，叫<strong>转转</strong>和<strong>圈圈</strong>。不过小狸花圈圈老在我床上尿尿，所以只能送回流浪基地了 😿</p>
        </section>
        <section class="about-card wide">
          <h2>旅行 · 8 个国家 18 个城市</h2>
          <p>感谢父母给的机会，让我在学生时期有机会走过这些地方：</p>
          <p class="tags">${TRAVEL.map((t) => html`<span class="tag">${t}</span>`)}</p>
        </section>
      </div>
    </article>`;
  return shell(home, { title: '关于', path: '/about/', reader: { section: 'about', body } });
}

/* ---------- 留言板（隐藏页里的） ---------- */

export function guestbookPage(home) {
  const body = html`
    <article class="post">
      ${pageHead('留言板', '藏在路牌背后的小地方。用 GitHub 账号登录就能留言，打个招呼、提个建议、随便聊聊都行。')}
    </article>
    ${comments()}`;
  return shell(home, { title: '留言板', path: '/guestbook/', reader: { section: 'secret', body } });
}

/* ---------- 服务器地图 ---------- */

export function mapPage(home) {
  // 横屏宽屏：左栏放标题、说明和服务器状态，右边是接近方形的地图（地图高度由面板定，宽度按比例收）。
  // 竖屏 / 窄屏：上下排，状态收成标题下面的一行
  const status = html`
    <div class="map-status-block" data-mc-status>
      <p class="side-title">服务器状态</p>
      <dl class="mini-stats">
        <div><dt>状态</dt><dd data-k="state">读取中…</dd></div>
        <div><dt>在线</dt><dd data-k="players">-</dd></div>
        <div><dt>版本</dt><dd data-k="version">-</dd></div>
        <div><dt>已开服</dt><dd data-k="uptime">-</dd></div>
      </dl>
      <figure class="spark-box" hidden><svg data-spark preserveAspectRatio="none" aria-hidden="true"></svg><figcaption>最近 24 小时在线人数</figcaption></figure>
      <p class="side-title">加入</p>
      <p class="side-note">白名单制，加 QQ 群申请：<br><button type="button" class="qq-chip" data-copy="${site.qqGroup}" title="点击复制群号">${site.qqGroup}<span class="qq-copied" aria-live="polite"></span></button></p>
      <p class="side-note muted" data-k="updated">每 10 分钟更新一次</p>
    </div>`;
  const inline = html`
    <p class="map-inline" data-mc-status>
      <span data-k="state">读取中…</span> · 在线 <span data-k="players">-</span> · <span data-k="version">-</span> · 已开服 <span data-k="uptime">-</span>
    </p>`;
  const body = html`
    <div class="map-layout">
      <div class="map-info">
        <header class="post-head map-head">
          <h1>世界地图</h1>
          <p class="page-sub">主世界的 45° 像素俯瞰图，mc-ops 每天清晨渲染一次。玩家常去的地方有高清细节。<span class="map-stamp" data-map-stamp hidden></span></p>
          ${inline}
        </header>
        ${status}
      </div>
      <div class="mcmap" data-mc-map>
        <canvas tabindex="0" aria-label="服务器地图：拖动平移，滚轮或双指缩放，双击放大"></canvas>
        <p class="map-status" data-map-status>地图需要启用 JavaScript。</p>
        <div class="map-tools" role="group" aria-label="地图缩放">
          <button type="button" class="btn map-btn" data-map-act="in" aria-label="放大">+</button>
          <button type="button" class="btn map-btn" data-map-act="out" aria-label="缩小">−</button>
          <button type="button" class="btn map-btn" data-map-act="home" title="回到出生点" aria-label="回到出生点">⌂</button>
        </div>
      </div>
    </div>`;
  return shell(home, {
    title: '世界地图',
    description: 'Minecraft 生存服主世界的等轴测像素地图，每天更新。',
    path: '/server/map/',
    reader: { section: 'server', body, wide: true },
  });
}

/* ---------- 404 ---------- */

export function notFoundPage(home) {
  const body = html`
    <article class="post not-found">
      ${pageHead('迷路了', '这里什么也没有。可能是地址打错了，也可能页面已经搬走。')}
      <p class="more">
        <a class="btn btn-open" href="/archives/">看看全部文章<span class="open-icon" aria-hidden="true"></span></a>
        <a class="btn btn-open" href="/browse/">按分类找找<span class="open-icon" aria-hidden="true"></span></a>
        <a class="btn" href="/">回到起点</a>
      </p>
    </article>`;
  return shell(home, { title: '页面不存在', path: '/404.html', reader: { section: 'home', body } });
}
