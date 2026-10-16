/**
 * 机器读的产物：/feed.xml（Atom，地址与旧站 jekyll-feed 一致）、/sitemap.xml、/robots.txt。
 */
import { escape } from './html.mjs';
import { site } from '../src/site.mjs';

const abs = (p) => new URL(p, site.url).href;

/** 正文里的站内相对地址（/assets/...）改成绝对地址，阅读器里图片才显示得出来 */
const absolutize = (htmlText) => htmlText.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${site.url}/`);

/**
 * @param {{ url: string, title: string, date: Date, updated: Date | null, categories: string[], tags: string[], description?: string }[]} posts 按时间倒序
 * @param {(post: any) => string} contentOf 渲染后的正文 HTML
 * @param {number} [limit]
 */
export function atomFeed(posts, contentOf, limit = 20) {
  const items = posts.slice(0, limit);
  const updated = items.reduce((m, p) => Math.max(m, +(p.updated ?? p.date)), 0);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
  <title>${escape(site.title)}</title>
  <subtitle>${escape(site.description)}</subtitle>
  <link href="${abs('/feed.xml')}" rel="self" type="application/atom+xml"/>
  <link href="${abs('/')}" rel="alternate" type="text/html"/>
  <id>${abs('/')}</id>
  <updated>${new Date(updated).toISOString()}</updated>
  <author><name>${escape(site.author)}</name></author>
${items
  .map(
    (p) => `  <entry>
    <title>${escape(p.title)}</title>
    <link href="${abs(p.url)}" rel="alternate" type="text/html"/>
    <id>${abs(p.url)}</id>
    <published>${p.date.toISOString()}</published>
    <updated>${(p.updated ?? p.date).toISOString()}</updated>
${p.categories.map((c) => `    <category term="${escape(c)}"/>`).join('\n')}
${p.description ? `    <summary>${escape(p.description)}</summary>\n` : ''}    <content type="html">${escape(absolutize(contentOf(p)))}</content>
  </entry>`,
  )
  .join('\n')}
</feed>
`;
}

/** @param {{ path: string, lastmod?: Date | null }[]} entries */
export function sitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url><loc>${escape(abs(e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`;
}

export const robots = () => `User-agent: *
Allow: /

Sitemap: ${abs('/sitemap.xml')}
`;
