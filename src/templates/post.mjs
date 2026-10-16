import { html, raw } from '../../build/html.mjs';
import { shell } from './home.mjs';
import { formatDate, readingMinutes } from './util.mjs';

/**
 * @param {{ post: any, content: { html: string, toc: { level: number, id: string, text: string }[] },
 *   prev: any, next: any, excerpt: string, home: any }} ctx  home：首页数据（外壳里的板块卡片要用）
 */
export function postPage({ post, content, prev, next, excerpt, home }) {
  const toc = content.toc;
  const body = html`
    <article class="post">
      <header class="post-head">
        ${post.categories.length ? html`<p class="crumbs">${post.categories.map((c, i) => html`${i ? html`<span aria-hidden="true">/</span>` : ''}<a href="/browse/#${encodeURIComponent(c)}">${c}</a>`)}</p>` : ''}
        <h1>${post.title}</h1>
        <p class="post-info">
          <time datetime="${post.date.toISOString()}">${formatDate(post.date)}</time>
          ${post.updated ? html`<span>更新于 <time datetime="${post.updated.toISOString()}">${formatDate(post.updated)}</time></span>` : ''}
          <span>约 ${readingMinutes(post.body)} 分钟</span>
        </p>
      </header>
      ${toc.length >= 3
        ? html`
      <details class="toc">
        <summary>目录</summary>
        <ol>${toc.map((h) => html`<li class="lv${h.level}"><a href="#${h.id}">${h.text}</a></li>`)}</ol>
      </details>`
        : ''}
      <div class="prose">
${raw(content.html)}
      </div>
      ${post.tags.length ? html`<p class="tags">${post.tags.map((t) => html`<a class="tag" href="/browse/#${encodeURIComponent(t)}">#${t}</a>`)}</p>` : ''}
    </article>
    <nav class="post-nav" aria-label="上一篇与下一篇">
      ${prev ? html`<a class="nav-card" href="${prev.url}" rel="prev"><span>较新</span>${prev.title}</a>` : html`<span></span>`}
      ${next ? html`<a class="nav-card next" href="${next.url}" rel="next"><span>较早</span>${next.title}</a>` : html`<span></span>`}
    </nav>`;
  return shell(home, {
    title: post.title,
    description: post.description ?? excerpt,
    path: post.url,
    type: 'article',
    math: post.math,
    reader: { section: 'posts', body },
  });
}
