import { html, raw } from '../../build/html.mjs';
import { comments, shell } from './home.mjs';
import { categoryUrl, formatDate, readingMinutes, tagUrl } from './util.mjs';

/**
 * @param {{ post: any, content: { html: string, toc: { level: number, id: string, text: string }[] },
 *   prev: any, next: any, excerpt: string, home: any }} ctx  home：首页数据（外壳里的板块卡片要用）
 */
export function postPage({ post, content, prev, next, excerpt, home }) {
  const toc = content.toc.length >= 3 ? content.toc : [];
  const minutes = readingMinutes(post.body);
  const catLinks = post.categories.map(
    (c, i) => html`${i ? html`<span aria-hidden="true">/</span>` : ''}<a href="${categoryUrl(c)}">${c}</a>`,
  );
  const tagLinks = post.tags.map((t) => html`<a class="tag" href="${tagUrl(t)}">#${t}</a>`);
  const dates = html`<time datetime="${post.date.toISOString()}">${formatDate(post.date)}</time>`;
  const updated = post.updated ? html`<time datetime="${post.updated.toISOString()}">${formatDate(post.updated)}</time>` : null;

  // 正文卡片只留标题和正文；日期、分类、标签在宽屏放右侧卡片，窄屏才回到正文里（inline-meta）
  const body = html`
    <article class="post" data-pagefind-body data-pagefind-meta="date:${formatDate(post.date)}, category:${post.categories.join(' / ')}">
      <header class="post-head">
        ${post.categories.length ? html`<p class="crumbs inline-meta">${catLinks}</p>` : ''}
        <h1 data-pagefind-meta="title">${post.title}</h1>
        <p class="post-info inline-meta">
          ${dates}
          ${updated ? html`<span>更新于 ${updated}</span>` : ''}
          <span>约 ${minutes} 分钟</span>
        </p>
      </header>
      <div class="prose">
${raw(content.html)}
      </div>
      ${post.tags.length ? html`<p class="tags inline-meta">${tagLinks}</p>` : ''}
    </article>
    <nav class="post-nav" aria-label="上一篇与下一篇">
      ${prev ? html`<a class="nav-card" href="${prev.url}" rel="prev"><span>较新</span>${prev.title}</a>` : html`<span></span>`}
      ${next ? html`<a class="nav-card next" href="${next.url}" rel="next"><span>较早</span>${next.title}</a>` : html`<span></span>`}
    </nav>
    ${comments()}`;

  const left = toc.length
    ? html`
    <aside class="reader-side side-left card" id="reader-toc" aria-label="目录">
      <p class="side-title">目录</p>
      <div class="read-progress" aria-hidden="true"><span></span></div>
      <ol class="toc-list" data-toc>
        ${toc.map((h) => html`<li class="lv${h.level}"><a href="#${h.id}">${h.text}</a></li>`)}
      </ol>
    </aside>`
    : '';

  const right = html`
    <aside class="reader-side side-right card" aria-label="文章信息">
      <dl class="meta-list">
        <div><dt>发布</dt><dd>${dates}</dd></div>
        ${updated ? html`<div><dt>更新</dt><dd>${updated}</dd></div>` : ''}
        <div><dt>阅读</dt><dd>约 ${minutes} 分钟</dd></div>
        ${post.categories.length ? html`<div><dt>分类</dt><dd class="meta-cats">${catLinks}</dd></div>` : ''}
      </dl>
      ${post.tags.length ? html`<p class="side-title">标签</p><p class="tags side-tags">${tagLinks}</p>` : ''}
    </aside>`;

  return shell(home, {
    title: post.title,
    description: post.description ?? excerpt,
    path: post.url,
    type: 'article',
    math: post.math,
    reader: { section: 'posts', body, left, right, toc: toc.length > 0 },
  });
}
