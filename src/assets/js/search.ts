/**
 * 站内搜索：Pagefind（构建时生成 /pagefind/ 索引，浏览器按需加载分片，不需要服务器）。
 * 顶栏放大镜、/ 或 Ctrl+K 打开；↑↓ 选择、Enter 打开、Esc 关闭。
 * 结果是普通站内链接，点开后交给路由，在阅读面板里展开。
 */
interface PagefindResult {
  url: string;
  excerpt: string;
  meta: { title?: string; date?: string; category?: string };
}
interface Pagefind {
  init(): Promise<void>;
  search(q: string): Promise<{ results: { data(): Promise<PagefindResult> }[] }>;
}

const root = document.documentElement;
const box = document.querySelector<HTMLElement>('[data-search]');
const input = box?.querySelector<HTMLInputElement>('[data-search-input]');
const list = box?.querySelector<HTMLElement>('[data-search-results]');
const hint = box?.querySelector<HTMLElement>('[data-search-hint]');
let engine: Promise<Pagefind> | null = null;
let opener: HTMLElement | null = null;
let seq = 0;
let timer = 0;
let active = -1;

function load(): Promise<Pagefind> {
  // 路径是固定的 /pagefind/，不在带哈希的资源目录里（索引由 Pagefind 自己管理缓存）
  engine ??= (import(/* @vite-ignore */ '/pagefind/pagefind.js' as string) as Promise<Pagefind>).then(async (pf) => {
    await pf.init();
    return pf;
  });
  return engine;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Pagefind 的摘要是带 <mark> 的 HTML：在惰性的 template 里解析，只保留文字和 mark，其余一律转义 */
function safeExcerpt(htmlText: string): string {
  const t = document.createElement('template');
  t.innerHTML = htmlText;
  let out = '';
  t.content.childNodes.forEach((n) => {
    const text = esc(n.textContent ?? '');
    out += n.nodeName === 'MARK' ? `<mark>${text}</mark>` : text;
  });
  return out;
}

function select(i: number) {
  const items = [...(list?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
  if (!items.length) return;
  active = (i + items.length) % items.length;
  items.forEach((a, k) => a.classList.toggle('is-active', k === active));
  items[active].scrollIntoView({ block: 'nearest' });
}

async function run(q: string) {
  const my = ++seq;
  if (!list || !hint) return;
  if (!q.trim()) {
    list.innerHTML = '';
    hint.textContent = '输入关键词开始搜索';
    return;
  }
  hint.textContent = '搜索中…';
  let pf: Pagefind;
  try {
    pf = await load();
  } catch {
    hint.textContent = '搜索索引加载失败（本地开发需先构建一次）';
    return;
  }
  const res = await pf.search(q);
  const data = await Promise.all(res.results.slice(0, 12).map((r) => r.data()));
  if (my !== seq) return; // 期间又输入了
  active = -1;
  hint.textContent = res.results.length ? `找到 ${res.results.length} 篇${res.results.length > 12 ? '，显示前 12 篇' : ''}` : '没有找到相关文章';
  list.innerHTML = data
    .map((d) => {
      const meta = [d.meta.date, d.meta.category].filter(Boolean).map((m) => esc(m!)).join(' · ');
      return `<li><a href="${esc(d.url)}"><span class="sr-title">${esc(d.meta.title ?? d.url)}</span>${meta ? `<span class="sr-meta">${meta}</span>` : ''}<span class="sr-excerpt">${safeExcerpt(d.excerpt)}</span></a></li>`;
    })
    .join('');
}

function open() {
  if (!box || !input || !box.hidden) return;
  opener = document.activeElement as HTMLElement | null;
  box.hidden = false;
  root.classList.add('searching');
  input.focus();
  input.select();
  void load().catch(() => {}); // 打开时就开始加载索引入口
}

function close() {
  if (!box || box.hidden) return;
  box.hidden = true;
  root.classList.remove('searching');
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
