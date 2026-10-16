/**
 * 站内搜索：构建时生成 /search.json（全部文章的纯文本，gzip 后约 80KB），第一次打开搜索时加载一次，
 * 之后在浏览器里做子串匹配。中文不依赖分词，「光栅化」这类复合词一篇不漏。
 * 多个关键词用空格分开，要求全部命中；标题命中排在前面。
 * 顶栏放大镜、/ 或 Ctrl+K 打开；↑↓ 选择、Enter 打开、Esc 关闭。结果交给路由，在阅读面板里展开。
 */
interface Doc {
  u: string; // 地址
  t: string; // 标题
  d: string; // 日期
  c: string; // 分类
  g: string[]; // 标签
  x: string; // 正文纯文本
}
interface Hit {
  doc: Doc;
  score: number;
  at: number; // 正文里第一个命中位置，-1 表示只命中了标题 / 标签
}

const root = document.documentElement;
const box = document.querySelector<HTMLElement>('[data-search]');
const input = box?.querySelector<HTMLInputElement>('[data-search-input]');
const list = box?.querySelector<HTMLElement>('[data-search-results]');
const hint = box?.querySelector<HTMLElement>('[data-search-hint]');
let docs: Promise<(Doc & { lt: string; lx: string; lg: string })[]> | null = null;
let opener: HTMLElement | null = null;
let seq = 0;
let timer = 0;
let active = -1;
let terms: string[] = [];
let hideTimer = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function load() {
  docs ??= fetch('/search.json')
    .then((r) => (r.ok ? (r.json() as Promise<Doc[]>) : Promise.reject(r.status)))
    .then((all) => all.map((d) => ({ ...d, lt: d.t.toLowerCase(), lx: d.x.toLowerCase(), lg: d.g.join(' ').toLowerCase() })));
  docs.catch(() => (docs = null)); // 失败了下次再试
  return docs;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 转义后把命中的关键词包上 <mark> */
function mark(text: string): string {
  if (!terms.length) return esc(text);
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of terms) {
    for (let k = lower.indexOf(t); k >= 0; k = lower.indexOf(t, k + t.length)) ranges.push([k, k + t.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let out = '';
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a < pos) continue;
    out += esc(text.slice(pos, a)) + `<mark>${esc(text.slice(a, b))}</mark>`;
    pos = b;
  }
  return out + esc(text.slice(pos));
}

function snippet(h: Hit): string {
  const x = h.doc.x;
  if (h.at < 0) return mark(x.slice(0, 80)) + (x.length > 80 ? '…' : '');
  const a = Math.max(0, h.at - 30);
  const b = Math.min(x.length, h.at + 70);
  return (a > 0 ? '…' : '') + mark(x.slice(a, b)) + (b < x.length ? '…' : '');
}

async function run(q: string) {
  const my = ++seq;
  if (!list || !hint) return;
  terms = [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))];
  if (!terms.length) {
    list.innerHTML = '';
    hint.textContent = '输入关键词开始搜索，多个词用空格分开';
    return;
  }
  let all;
  try {
    all = await load();
  } catch {
    hint.textContent = '搜索索引加载失败，请稍后再试';
    return;
  }
  if (my !== seq) return; // 期间又输入了
  const hits: Hit[] = [];
  for (const d of all) {
    let score = 0;
    let at = -1;
    let ok = true;
    for (const t of terms) {
      const inTitle = d.lt.includes(t);
      const inTags = d.lg.includes(t);
      const k = d.lx.indexOf(t);
      if (!inTitle && !inTags && k < 0) {
        ok = false;
        break;
      }
      if (k >= 0 && (at < 0 || k < at)) at = k;
      // 标题命中权重最高，其次标签，正文按出现次数（封顶）计
      let n = 0;
      for (let p = k; p >= 0 && n < 20; p = d.lx.indexOf(t, p + t.length)) n++;
      score += (inTitle ? 50 : 0) + (inTags ? 20 : 0) + n;
    }
    if (ok) hits.push({ doc: d, score, at });
  }
  hits.sort((a, b) => b.score - a.score || b.doc.d.localeCompare(a.doc.d));
  active = -1;
  const shown = hits.slice(0, 20);
  hint.textContent = hits.length ? `找到 ${hits.length} 篇${hits.length > 20 ? '，显示最相关的 20 篇' : ''}` : '没有找到相关文章';
  list.innerHTML = shown
    .map((h) => {
      const meta = [h.doc.d, h.doc.c].filter(Boolean).map(esc).join(' · ');
      return `<li><a href="${esc(h.doc.u)}"><span class="sr-title">${mark(h.doc.t)}</span>${meta ? `<span class="sr-meta">${meta}</span>` : ''}<span class="sr-excerpt">${snippet(h)}</span></a></li>`;
    })
    .join('');
}

function select(i: number) {
  const items = [...(list?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
  if (!items.length) return;
  active = (i + items.length) % items.length;
  items.forEach((a, k) => a.classList.toggle('is-active', k === active));
  items[active].scrollIntoView({ block: 'nearest' });
}


function open() {
  if (!box || !input || !box.hidden) return;
  opener = document.activeElement as HTMLElement | null;
  clearTimeout(hideTimer);
  box.hidden = false;
  void box.offsetWidth; // 先让 hidden 生效再加类，过渡才会播放
  box.classList.add('is-open');
  root.classList.add('searching');
  input.focus();
  input.select();
  void load().catch(() => {}); // 打开时就开始加载索引入口
}

function close() {
  if (!box || box.hidden || !box.classList.contains('is-open')) return;
  box.classList.remove('is-open');
  root.classList.remove('searching');
  hideTimer = window.setTimeout(() => (box.hidden = true), reducedMotion.matches ? 0 : 200);
  opener?.focus({ preventScroll: true });
}

if (box && input && list) {
  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void run(input.value), 140);
  });
  // 点结果：先收起搜索，链接本身交给路由（阅读面板）处理
  list.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) close();
  });
  box.addEventListener('click', (e) => {
    if (e.target === box) close(); // 点遮罩空白处
  });
  window.addEventListener(
    'keydown',
    (e) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!box.hidden) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation(); // 不顺带关掉下面的阅读面板
          close();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopImmediatePropagation();
          select(active + (e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter' && active >= 0) {
          e.preventDefault();
          list.querySelectorAll<HTMLAnchorElement>('a')[active]?.click();
        } else if (!typing && e.key.length === 1) {
          e.stopImmediatePropagation(); // 别让数字键切换板块
        }
        return;
      }
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        open();
      }
    },
    true,
  );
}
