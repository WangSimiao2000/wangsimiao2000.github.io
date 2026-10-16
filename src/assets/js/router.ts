/**
 * 站内路由：整站只有一个「世界」。点站内页面链接时不整页跳转，而是取回那个静态页面，
 * 把它的正文放进阅读面板在世界上方展开；地址栏照常变成 /posts/xxx/，刷新、分享、后退都正常。
 *
 * - 每个静态页面本身就带完整的世界外壳，所以直接打开链接看到的也是同一个画面。
 * - 打开时卡片原地放大成面板（View Transitions），不支持的浏览器直接切换。
 * - 面板里的滚动只滚正文；Esc / 返回按钮 / 浏览器后退关闭面板，回到原来的板块。
 * - 取页失败（404、断网）就退回普通跳转，不会卡住。
 */
import type { World } from './pixel/world.js';
import { bindToc } from './toc.js';

interface RouterOptions {
  world: World;
  sections: HTMLElement[];
  reader: HTMLElement;
}

interface NavState {
  reader?: boolean;
  /** 从首页点进来后又在面板里连着翻了几篇：关闭时 history.go(-homeDepth) 回到那条首页记录，不在历史里堆首页 */
  homeDepth?: number;
}

export function startRouter({ world, sections, reader }: RouterOptions) {
  const root = document.documentElement;
  const stages = document.querySelector<HTMLElement>('main.stages');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const siteTitle = document.querySelector('.brand')?.textContent?.trim() || document.title;
  const cache = new Map<string, Promise<string>>();
  let source: HTMLElement | null = null; // 打开面板的链接，关闭后把焦点还给它
  let token = 0;
  let unbindToc = () => {};
  let pendingSection: string | null = null; // 关闭后要去的板块（经 history.back() 时暂存）

  const isOpen = () => !reader.hidden;
  const scroller = () => reader.querySelector<HTMLElement>('[data-reader-scroll]');
  const sectionIndex = (id: string) => Math.max(0, sections.findIndex((s) => s.id === id));

  /** 相机移到某个板块：页面滚动瞬间到位，世界里的小人自己跑过去 */
  function moveTo(id: string) {
    const h = sections[0]?.offsetHeight || window.innerHeight;
    window.scrollTo({ top: sectionIndex(id) * h, behavior: 'instant' });
  }

  function load(href: string): Promise<string> {
    const key = href.split('#')[0];
    let p = cache.get(key);
    if (!p) {
      p = fetch(key, { headers: { accept: 'text/html' } }).then((r) => (r.ok ? r.text() : Promise.reject(r.status)));
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return p;
  }

  /** 把目标页面需要、当前页面还没有的样式（如 KaTeX）加进来，等它加载完再展示 */
  async function adoptStyles(doc: Document) {
    const waits: Promise<unknown>[] = [];
    for (const link of doc.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
      const href = link.getAttribute('href');
      if (!href || document.head.querySelector(`link[rel="stylesheet"][href="${CSS.escape(href)}"]`)) continue;
      const el = document.createElement('link');
      el.rel = 'stylesheet';
      el.href = href;
      waits.push(
        new Promise((done) => {
          el.onload = el.onerror = done;
          setTimeout(done, 3000);
        }),
      );
      document.head.append(el);
    }
    await Promise.all(waits);
  }

  /** 视图过渡：from 是过渡前要「变成」面板的元素，to 是过渡后接住面板的元素 */
  async function transition(update: () => void, from?: HTMLElement | null, to?: HTMLElement | null) {
    if (!('startViewTransition' in document) || reduced.matches) {
      update();
      return;
    }
    if (from) from.style.viewTransitionName = 'reader';
    const vt = document.startViewTransition(() => {
      if (from) from.style.viewTransitionName = '';
      update();
      if (to) to.style.viewTransitionName = 'reader';
    });
    try {
      await vt.finished;
    } catch {
      /* 过渡被打断不影响结果 */
    } finally {
      if (from) from.style.viewTransitionName = '';
      if (to) to.style.viewTransitionName = '';
    }
  }

  function scrollToAnchor(hash: string, smooth = true) {
    const sc = scroller();
    const el = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (!sc || !el || !sc.contains(el)) return false;
    const top = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12;
    sc.scrollTo({ top, behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
    return true;
  }

  function setReading(on: boolean) {
    unbindToc();
    reader.hidden = !on;
    root.classList.toggle('reading', on);
    if (stages) stages.inert = on;
    world.setReading(on);
    unbindToc = on ? bindToc(reader) : () => {};
  }

  async function open(href: string, push: boolean, from?: HTMLElement) {
    const my = ++token;
    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(await load(href), 'text/html');
    } catch {
      location.assign(href);
      return;
    }
    const next = doc.querySelector('[data-reader]');
    const card = next?.querySelector<HTMLElement>('.reader-card');
    if (!next || !card) {
      location.assign(href);
      return;
    }
    await adoptStyles(doc);
    if (my !== token) return; // 期间又点了别的

    const wasOpen = isOpen();
    if (push) {
      const prev = (history.state ?? {}) as NavState;
      const homeDepth = wasOpen ? (prev.homeDepth ? prev.homeDepth + 1 : undefined) : location.pathname === '/' ? 1 : undefined;
      const state: NavState = { reader: true, homeDepth };
      history.pushState(state, '', href);
    }
    document.title = doc.title;
    const fromCard = !wasOpen ? (from?.closest<HTMLElement>('.card') ?? null) : null;
    await transition(() => {
      reader.innerHTML = next.innerHTML;
      setReading(true);
      moveTo(card.dataset.section ?? 'home');
      const sc = scroller();
      const hash = new URL(href, location.href).hash;
      if (!hash || !scrollToAnchor(hash, false)) sc?.scrollTo({ top: 0, behavior: 'instant' });
    }, fromCard);
    scroller()?.focus({ preventScroll: true });
    if (!wasOpen) source = from ?? null;
  }

  function close(push: boolean, then?: string) {
    if (!isOpen()) {
      if (then) world.goTo(sectionIndex(then));
      return;
    }
    token++;
    const id = reader.querySelector<HTMLElement>('.reader-card')?.dataset.section ?? 'home';
    if (push) {
      const depth = (history.state as NavState | null)?.homeDepth;
      if (depth) {
        // 回到来时的首页记录；popstate 里再真正关闭
        pendingSection = then ?? null;
        history.go(-depth);
        return;
      }
      history.pushState({}, '', `/#${then ?? id}`);
    }
    document.title = siteTitle;
    const target = document.getElementById(id)?.querySelector<HTMLElement>('.card') ?? null;
    void transition(
      () => {
        setReading(false);
        moveTo(id);
      },
      null,
      then && then !== id ? null : target,
    );
    const back = source && document.contains(source) ? source : target;
    back?.focus({ preventScroll: true });
    source = null;
    if (then && then !== id) world.goTo(sectionIndex(then));
  }

  window.addEventListener('popstate', () => {
    if (location.pathname === '/') {
      const then = pendingSection ?? (location.hash.slice(1) || undefined);
      pendingSection = null;
      close(false, then);
    } else {
      void open(location.href, false);
    }
  });

  /** 只接管站内的「页面」链接：/xxx/ 形式；/feed.xml、PDF、独立工具页照常跳转 */
  function routable(a: HTMLAnchorElement): URL | null {
    if (a.target || a.hasAttribute('download') || a.dataset.noRouter !== undefined) return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return null;
    return url;
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!a) return;
    const url = routable(a);
    if (!url) return;
    if (a.hasAttribute('data-reader-close')) {
      e.preventDefault();
      close(true);
      return;
    }
    if (url.pathname === location.pathname && url.hash && isOpen()) {
      // 正文里的目录 / 脚注：只滚动面板
      e.preventDefault();
      if (scrollToAnchor(url.hash)) history.replaceState(history.state, '', url.hash);
      return;
    }
    if (url.pathname === '/') {
      if (isOpen()) {
        e.preventDefault();
        close(true, url.hash.slice(1) || undefined);
      }
      return;
    }
    if (!url.pathname.endsWith('/') || url.pathname.startsWith('/tools/')) return;
    e.preventDefault();
    if (url.pathname === location.pathname && isOpen()) return;
    void open(url.href, true, a);
  });

  // 悬停 / 按下时预取，点下去基本是瞬开
  const prefetch = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
    const url = a && routable(a);
    if (url && url.pathname !== '/' && url.pathname.endsWith('/') && !url.pathname.startsWith('/tools/')) {
      load(url.href).catch(() => {});
    }
  };
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close(true);
    }
  });

  // 直接打开的是带正文的页面
  if (isOpen()) {
    setReading(true);
    history.replaceState({ reader: true } satisfies NavState, '');
    const hash = location.hash;
    if (hash) requestAnimationFrame(() => scrollToAnchor(hash, false));
    scroller()?.focus({ preventScroll: true });
  }
}
