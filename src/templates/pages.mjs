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

export function aboutPage(home) {
  const body = html`
    <article class="post about-page">
      <header class="about-hero">
        <img class="about-photo" src="/assets/img/photo.jpg" alt="${site.author}" width="132" height="132" loading="lazy">
        <div>
          <h1>嗨，我是${site.author} 👋</h1>
          <p class="page-sub">图形渲染开发工程师 @ 小米 · He / Him · 2000.11.06 · 四川成都</p>
          <p class="more">
            <a class="btn" href="${site.links.github}" target="_blank" rel="noopener">GitHub</a>
            <a class="btn" href="${site.links.bilibili}" target="_blank" rel="noopener">Bilibili · 鄙人米奇喵</a>
            <a class="btn" href="${site.links.steam}" target="_blank" rel="noopener">Steam</a>
            <a class="btn" href="/assets/resume/WangSimiao_09.pdf" target="_blank" rel="noopener">简历 PDF</a>
          </p>
        </div>
      </header>
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
          <p>PC 上最近在玩<strong>天国拯救2</strong>。近几年觉得好玩的：Stacklands、潜水员戴夫、博德之门3、绝地潜兵2、动物井</p>
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
