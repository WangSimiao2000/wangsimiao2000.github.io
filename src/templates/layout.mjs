import { html, raw } from '../../build/html.mjs';
import { site } from '../site.mjs';

/**
 * 这次构建的时间（毫秒）。写进每个页面的 <meta name="build"> 和 version.json，
 * 前端只在线上版本比当前页面「更新」时才自动刷新：GitHub Pages 的 CDN 各节点各缓存 10 分钟，
 * 刚部署完时可能拿到新页面、旧 version.json，只比哈希会被旧版本刷回去
 */
export const BUILT = Date.now();

/** 首帧前确定主题，避免亮 -> 暗闪一下 */
const THEME_INIT = `(()=>{const d=document.documentElement;d.classList.add('js');let t=null;try{t=localStorage.getItem('theme')}catch{}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.theme=t})();`;

export const topbar = () => html`
  <header class="topbar">
    <a class="brand" href="/" aria-label="${site.title} 首页"><span class="brand-dot" aria-hidden="true"></span>${site.title}</a>
    <nav class="toplinks" aria-label="站点">
      <button type="button" class="theme-btn" data-search-open aria-label="搜索文章（/）" title="搜索（/ 或 Ctrl+K）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      </button>
      <button type="button" class="theme-btn scenic-btn" data-scenic-toggle hidden aria-label="隐藏卡片，只看风景（H）" title="隐藏卡片，只看风景（H）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17" /><path d="M15.5 8.5h1v1h-1z" /></svg>
      </button>
      <button type="button" class="theme-btn fs-btn" data-fullscreen-toggle hidden aria-label="全屏浏览，更沉浸（F）" title="全屏浏览，更沉浸（F）">
        <svg class="i-fs-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>
        <svg class="i-fs-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" /></svg>
      </button>
      <button type="button" class="theme-btn" data-theme-toggle aria-label="切换深色模式">
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
      </button>
    </nav>
  </header>`;

/** 分享卡片用图：1200×630 JPEG（WebP 有的聊天软件预览不认） */
const SHARE_IMAGE = '/assets/img/og.jpg';

/** 给搜索引擎的结构化数据：首页是 WebSite，文章是 BlogPosting；`<` 转义，防止正文提前闭合 script */
function jsonLd(o, fullTitle, desc, canonical, image) {
  const author = { '@type': 'Person', name: site.author, url: new URL('/about/', site.url).href };
  const data =
    o.type === 'article' && o.article
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: o.title,
          description: desc,
          url: canonical,
          mainEntityOfPage: canonical,
          image,
          datePublished: o.article.published.toISOString(),
          dateModified: (o.article.modified ?? o.article.published).toISOString(),
          keywords: o.article.tags.join(', ') || undefined,
          inLanguage: 'zh-CN',
          author,
          publisher: author,
        }
      : { '@context': 'https://schema.org', '@type': 'WebSite', name: site.title, url: site.url, description: desc, inLanguage: 'zh-CN', author };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * @param {object} o
 * @param {string} o.title       页面标题（首页传站点名）
 * @param {string} [o.description]
 * @param {string} o.path        站内路径，用于 canonical
 * @param {(p: string) => string} o.asset  资源路径映射（带构建版本目录）
 * @param {string[]} [o.css]     额外样式，相对 src/assets
 * @param {string[]} [o.js]      模块脚本入口，相对 src/assets，如 'js/home.js'
 * @param {boolean} [o.math]     加载 KaTeX 样式
 * @param {'website' | 'article'} [o.type]
 * @param {unknown} o.body
 * @param {boolean} [o.reading] 页面带正文：首帧就进入阅读状态，避免先闪一下首页卡片
 * @param {string} [o.extraHead] 开发模式注入等
 * @param {{ published: Date, modified?: Date | null, tags: string[] }} [o.article] 文章页：发布/更新时间、标签
 */
export function layout(o) {
  const fullTitle = o.title === site.title ? site.title : `${o.title} | ${site.title}`;
  const desc = o.description ?? site.description;
  const canonical = new URL(o.path, site.url).href;
  const shareImage = new URL(SHARE_IMAGE, site.url).href;
  const art = o.type === 'article' ? o.article : null;
  return html`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/assets/img/favicons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/img/favicons/favicon-96x96.png" type="image/png" sizes="96x96">
  <link rel="apple-touch-icon" href="/assets/img/favicons/apple-touch-icon.png">
  <link rel="manifest" href="/assets/img/favicons/site.webmanifest">
  <meta name="apple-mobile-web-app-title" content="${site.title}">
  <meta property="og:image" content="${shareImage}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${site.title} 的像素风博客首页">
  <link rel="alternate" type="application/atom+xml" title="${site.title}" href="/feed.xml">
  <meta property="og:type" content="${o.type ?? 'website'}">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:site_name" content="${site.title}">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${fullTitle}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${shareImage}">
  ${art
    ? html`<meta property="article:published_time" content="${art.published.toISOString()}">
  ${art.modified ? html`<meta property="article:modified_time" content="${art.modified.toISOString()}">` : ''}
  <meta property="article:author" content="${site.author}">
  ${art.tags.map((t) => html`<meta property="article:tag" content="${t}">`)}`
    : ''}
  <script type="application/ld+json">${raw(jsonLd(o, fullTitle, desc, canonical, shareImage))}</script>
  <meta name="google-site-verification" content="${site.verify.google}">
  <meta name="msvalidate.01" content="${site.verify.bing}">
  <meta name="build" content="${BUILT}">
  <meta name="theme-color" content="#eef1f5" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#15181d" media="(prefers-color-scheme: dark)">
  <script>${raw(THEME_INIT)}${o.reading ? raw("document.documentElement.classList.add('reading');") : ''}</script>
  <link rel="stylesheet" href="${o.asset('css/base.css')}">
  <link rel="preload" as="image" href="${o.asset('img/atlas.png')}" fetchpriority="high">
  ${(o.css ?? []).map((c) => html`<link rel="stylesheet" href="${o.asset(c)}">`)}
  ${o.math ? html`<link rel="stylesheet" href="${o.asset('katex/katex.min.css')}">` : ''}
  <script type="module" src="${o.asset('js/theme.js')}"></script>
  <script type="module" src="${o.asset('js/fullscreen.js')}"></script>
  ${(o.js ?? []).map((j) => html`<script type="module" src="${o.asset(j)}"></script>`)}
  ${raw(o.extraHead ?? '')}
</head>
<body${o.reading ? raw(' class="has-reader"') : ''}>
${o.body}
</body>
</html>
`;
}
