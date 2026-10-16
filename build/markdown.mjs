/**
 * Markdown -> HTML。markdown-it 负责 CommonMark，这里补上旧站 (kramdown + Chirpy) 用到的几个写法：
 * - `![](src){:width="700px"}` 图片宽度
 * - `$$...$$` / `$...$` 公式，构建时用 KaTeX 渲染，只在 front matter `math: true` 的文章启用（与旧站一致）
 * - 标题自动生成 id，并收集 h2/h3 供目录使用
 * - 代码块用 highlight.js 在构建时着色，页面不需要任何高亮脚本
 */
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import katex from 'katex';
import { escape } from './html.mjs';

const SITE_HOST = 'blog.mickeymiao.cn';

/** @param {string} tex @param {boolean} display */
function renderMath(tex, display) {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' });
}

/** 行内公式：$$..$$（kramdown 段落内写法）与 $..$ */
function mathInline(state, silent) {
  if (!state.env.math) return false;
  const src = state.src;
  const start = state.pos;
  if (src.charCodeAt(start) !== 0x24 /* $ */) return false;
  const double = src.charCodeAt(start + 1) === 0x24;
  const open = double ? 2 : 1;
  // 和旧站的 MathJax 一样：$ 两侧允许空格（文章里有 `$ \vec{x} $` 这种写法）
  let end = start + open;
  while ((end = src.indexOf(double ? '$$' : '$', end)) !== -1) {
    if (src[end - 1] === '\\') { end++; continue; }
    break;
  }
  if (end === -1 || !src.slice(start + open, end).trim()) return false;
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.content = src.slice(start + open, end);
  }
  state.pos = end + open;
  return true;
}

/** 独立成行的 $$ 块（可单行 `$$ x $$`，也可多行） */
function mathBlock(state, startLine, endLine, silent) {
  if (!state.env.math) return false;
  const lineText = (n) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
  const first = lineText(startLine).trim();
  if (!first.startsWith('$$')) return false;
  let content;
  let last = startLine;
  if (first.length > 4 && first.endsWith('$$')) {
    const inner = first.slice(2, -2);
    if (inner.includes('$$')) return false; // 一行里多段公式，按行内处理
    content = inner;
  } else {
    if (first !== '$$' && first.endsWith('$$')) return false;
    const lines = [first.slice(2)];
    let found = false;
    for (let n = startLine + 1; n < endLine; n++) {
      const t = lineText(n);
      if (t.trim().endsWith('$$')) {
        lines.push(t.trim().slice(0, -2));
        last = n;
        found = true;
        break;
      }
      lines.push(t);
    }
    if (!found) return false;
    content = lines.join('\n');
  }
  if (silent) return true;
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = content;
  token.map = [startLine, last + 1];
  state.line = last + 1;
  return true;
}

/** 标题 id：保留中文，空白变 -，去掉标点 */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function headingIds(md) {
  md.core.ruler.push('heading_ids', (state) => {
    const used = new Map();
    const toc = [];
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      const text = inline.children.filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('');
      let id = slugify(text);
      const n = used.get(id) ?? 0;
      used.set(id, n + 1);
      if (n) id += `-${n}`;
      t.attrSet('id', id);
      const level = Number(t.tag.slice(1));
      if (level === 2 || level === 3) toc.push({ level, id, text });
    }
    state.env.toc = toc;
  });
}

const md = new MarkdownIt({
  html: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return escape(code);
  },
});

md.inline.ruler.before('escape', 'math_inline', mathInline);
md.block.ruler.before('fence', 'math_block', mathBlock, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.math_inline = (tokens, i) => renderMath(tokens[i].content, false);
md.renderer.rules.math_block = (tokens, i) => `<div class="math-block">${renderMath(tokens[i].content, true)}</div>\n`;
headingIds(md);

// 图片：懒加载；宽度从 title 里的 __w=700 标记取（见 preprocess）
md.renderer.rules.image = (tokens, i, options, env, self) => {
  const t = tokens[i];
  const title = t.attrGet('title');
  const m = title && /^__w=(\d+)$/.exec(title);
  if (m) {
    t.attrs = (t.attrs ?? []).filter(([k]) => k !== 'title');
    if (Number(m[1]) >= 50) t.attrSet('width', m[1]);
  }
  t.attrSet('loading', 'lazy');
  t.attrSet('decoding', 'async');
  return self.renderToken(tokens, i, options);
};

// 站外链接新窗口打开
const defaultLink = md.renderer.rules.link_open ?? ((tokens, i, options, env, self) => self.renderToken(tokens, i, options));
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  const href = tokens[i].attrGet('href') ?? '';
  if (/^https?:\/\//.test(href) && !href.includes(SITE_HOST)) {
    tokens[i].attrSet('target', '_blank');
    tokens[i].attrSet('rel', 'noopener');
  }
  return defaultLink(tokens, i, options, env, self);
};

// 表格外包一层，窄屏可横向滚动
md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';

/** kramdown 图片属性 -> 我们的标记；跳过代码块，避免改坏讲 Markdown 语法的文章 */
function preprocess(src) {
  let inFence = false;
  return src
    // Jekyll 的 {% raw %} / {% endraw %} 只是让 Liquid 不解析中间内容，这里没有 Liquid，直接去掉
    .replace(/\{%-?\s*(?:end)?raw\s*-?%\}\n?/g, '')
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      return line.replace(/(!\[[^\]]*\]\(\s*[^)\s]+)\s*\)\{:\s*width="(\d+)(?:px)?"\s*\}/g, '$1 "__w=$2")');
    })
    .join('\n');
}

/**
 * @param {string} src Markdown 正文
 * @param {{ math?: boolean }} opts
 * @returns {{ html: string, toc: { level: number, id: string, text: string }[] }}
 */
export function renderMarkdown(src, { math = false } = {}) {
  const env = { math, toc: [] };
  const out = md.render(preprocess(src), env);
  return { html: out, toc: env.toc };
}

/** 纯文本摘要：去掉代码、公式、标记 */
export function excerpt(src, max = 120) {
  const text = src
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>|~#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}
