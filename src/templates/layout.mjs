import { html, raw } from '../../build/html.mjs';
import { site } from '../site.mjs';

/** 首帧前确定主题，避免亮 -> 暗闪一下 */
const THEME_INIT = `(()=>{const d=document.documentElement;d.classList.add('js');let t=null;try{t=localStorage.getItem('theme')}catch{}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';d.dataset.theme=t})();`;

export const topbar = () => html`
  <header class="topbar">
    <a class="brand" href="/" aria-label="${site.title} 首页"><span class="brand-dot" aria-hidden="true"></span>${site.title}</a>
    <nav class="toplinks" aria-label="站点">
      <a href="/archives/">归档</a>
      <a href="/browse/">分类</a>
      <a href="/feed.xml">RSS</a>
      <button type="button" class="theme-btn" data-theme-toggle aria-label="切换深色模式">
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
      </button>
    </nav>
  </header>`;

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
 * @param {string} [o.extraHead] 开发模式注入等
 */
export function layout(o) {
  const fullTitle = o.title === site.title ? site.title : `${o.title} | ${site.title}`;
  const desc = o.description ?? site.description;
  const canonical = new URL(o.path, site.url).href;
  return html`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="${site.avatar}">
  <link rel="alternate" type="application/rss+xml" title="${site.title}" href="/feed.xml">
  <meta property="og:type" content="${o.type ?? 'website'}">
  <meta property="og:site_name" content="${site.title}">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta name="google-site-verification" content="${site.verify.google}">
  <meta name="msvalidate.01" content="${site.verify.bing}">
  <meta name="theme-color" content="#eef1f5" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#15181d" media="(prefers-color-scheme: dark)">
  <script>${raw(THEME_INIT)}</script>
  <link rel="stylesheet" href="${o.asset('css/base.css')}">
  ${(o.css ?? []).map((c) => html`<link rel="stylesheet" href="${o.asset(c)}">`)}
  ${o.math ? html`<link rel="stylesheet" href="${o.asset('katex/katex.min.css')}">` : ''}
  <script type="module" src="${o.asset('js/theme.js')}"></script>
  ${(o.js ?? []).map((j) => html`<script type="module" src="${o.asset(j)}"></script>`)}
  ${raw(o.extraHead ?? '')}
</head>
<body>
${o.body}
</body>
</html>
`;
}
