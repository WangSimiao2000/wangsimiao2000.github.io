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
import { mountComments } from './comments.js';
import { paintStatus } from './status.js';

interface RouterOptions {
  world: World;
  sections: HTMLElement[];
  reader: HTMLElement;
}

/**
 * 面板里的导航栈（存在 history.state 里，刷新、前进后退都不丢）：
 * - 从列表点进条目（归档 -> 文章、分类 -> 标签）是「深入」：新开一条历史，返回时回到来的那页；
 * - 上一篇 / 下一篇、归档和分类与标签互相切换是「平移」：替换当前这条，连读几篇后返回仍回到列表；
 * - 返回按钮、Esc、浏览器后退都只退一级；右上角关闭一次回到世界。
 */
interface NavState {
  reader?: boolean;
  /** 从首页点进来后在面板里走了几级：关闭时 history.go(-homeDepth) 回到那条首页记录，不在历史里堆首页 */
  homeDepth?: number;
  /** 上一级面板页（返回按钮回到这里）；没有就说明是从世界里或外部直接打开的 */
  back?: { href: string; label: string };
  /** 离开这一页时正文滚到哪、点的是哪个链接：返回时恢复位置和焦点 */
  scroll?: number;
  focus?: string;
}

/** 两个顶层列表页之间的切换算平移 */
const LISTS = new Set(['/archives/', '/browse/']);

export function startRouter({ world, sections, reader }: RouterOptions) {
  const root = document.documentElement;
  const stages = document.querySelector<HTMLElement>('main.stages');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const siteTitle = document.querySelector('.brand')?.textContent?.trim() || document.title;
  const cache = new Map<string, Promise<string>>();
  let source: HTMLElement | null = null; // 打开面板的链接，关闭后把焦点还给它
  let token = 0;
  let unbindToc = () => {};
  let unbindMap = () => {};
  let pendingSection: string | null = null; // 关闭后要去的板块（经 history.back() 时暂存）

  const isOpen = () => !reader.hidden;
  const scroller = () => reader.querySelector<HTMLElement>('[data-reader-scroll]');
  const sectionIndex = (id: string) => Math.max(0, sections.findIndex((s) => s.id === id));

  /** 相机移到某个板块：页面滚动瞬间到位，世界里的小人自己跑过去 */
  function moveTo(id: string) {
    if (id === 'secret') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      world.enterSecret();
      return;
    }
    const h = sections[0]?.offsetHeight || window.innerHeight;
    window.scrollTo({ top: sectionIndex(id) * h, behavior: 'instant' });
  }

  /**
   * 网站版本 = 页面引用的资源目录 /_s/<内容哈希>/。部署后哈希就变。
   * 面板换页只换 HTML、不换已经加载的 CSS/JS，新旧混搭就会样式错乱，
   * 所以取回的页面版本和当前不一样时，改成整页加载。
   */
  const versionOf = (root: ParentNode) =>
    root.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href^="/_s/"]')?.getAttribute('href')?.match(/^\/_s\/[^/]+\//)?.[0] ?? null;
  const VERSION = versionOf(document);
  /** 已经知道线上有新版：之后取页面一律绕过浏览器的 HTTP 缓存（GitHub Pages 固定让 HTML 缓存 10 分钟） */
  let stale = false;

  function load(href: string): Promise<string> {
    const key = href.split('#')[0];
    let p = cache.get(key);
    if (!p) {
      p = fetch(key, { headers: { accept: 'text/html' }, cache: stale ? 'reload' : 'default' }).then((r) => (r.ok ? r.text() : Promise.reject(r.status)));
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return p;
  }

  /**
   * 问一下线上现在是哪个版本（version.json 每次绕开缓存取，只有几十字节）。
   * 发现更新了：没开面板就直接刷新；正在读就不打断，下次换页时整页加载新版。
   * 同一个版本最多自动刷新一次，CDN 还没换过来时不会反复刷新。
   */
  async function checkVersion() {
    if (!VERSION || stale) return;
    let live: string | undefined;
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      live = ((await r.json()) as { assets?: string }).assets;
    } catch {
      return;
    }
    if (!live || live === VERSION) return;
    stale = true;
    cache.clear();
    const mark = `reloaded:${live}`;
    if (!isOpen() && !sessionStorage.getItem(mark)) {
      sessionStorage.setItem(mark, '1');
      location.reload();
    }
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

  const EASE = 'cubic-bezier(0.3, 0.7, 0.2, 1)';
  const card = () => reader.querySelector<HTMLElement>('.reader-card');
  const play = (el: Element, frames: Keyframe[], opt: KeyframeAnimationOptions) =>
    el.animate(frames, { fill: 'both', ...opt }).finished.catch(() => {});
  const contentFade = (c: HTMLElement, show: boolean, opt: KeyframeAnimationOptions) =>
    Promise.all([...c.children].map((ch) => play(ch, show ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], opt)));
  /** 面板两侧的目录 / 信息卡片（只算当前宽度下真正显示出来的那些） */
  const sides = () =>
    [...reader.querySelectorAll<HTMLElement>('.reader-side')].filter((el) => getComputedStyle(el).display !== 'none' && !el.classList.contains('is-open'));
  /** 侧栏：从正文卡片那一侧滑出来 / 滑回去 */
  const sideFade = (show: boolean, opt: KeyframeAnimationOptions) =>
    Promise.all(
      sides().map((el) => {
        const dx = el.classList.contains('side-left') ? 14 : -14;
        const off = { opacity: 0, transform: `translateX(${dx}px)` };
        const on = { opacity: 1, transform: 'none' };
        return play(el, show ? [off, on] : [on, off], opt);
      }),
    );
  /** FLIP 的起点：把面板卡片变换成 r 所在的位置和大小 */
  const flipFrom = (c: HTMLElement, r: DOMRect) => {
    const t = c.getBoundingClientRect();
    return `translate(${r.left - t.left}px, ${r.top - t.top}px) scale(${r.width / t.width}, ${r.height / t.height})`;
  };

  /**
   * 面板开合动画：自己做 FLIP，只动 transform / opacity（合成器线程上跑），
   * 不用 View Transitions —— 它在过渡期间把整页冻成截图，像素世界会停住，结束时再跳一下。
   * from：打开时从这张首页卡片放大出来；to：关闭时缩回这张卡片
   */
  async function transition(update: () => void, from?: HTMLElement | null, to?: HTMLElement | null) {
    if (reduced.matches) {
      update();
      return;
    }
    const closing = to !== undefined;
    if (!closing) {
      const wasOpen = isOpen();
      const r0 = from?.getBoundingClientRect();
      if (wasOpen && card()) {
        // 面板里换页：旧内容和侧栏先淡出，再换上新的
        const old = card()!;
        await Promise.all([contentFade(old, false, { duration: 120, easing: 'ease-in' }), sideFade(false, { duration: 120, easing: 'ease-in' })]);
      }
      update();
      const c = card();
      if (!c) return;
      c.getAnimations().forEach((an) => an.cancel());
      if (wasOpen) {
        // 面板里换页：卡片不动，只换内容
        await Promise.all([contentFade(c, true, { duration: 200, easing: 'ease-out' }), sideFade(true, { duration: 220, easing: 'ease-out' })]);
      } else if (r0 && r0.width) {
        c.style.transformOrigin = '0 0';
        await Promise.all([
          play(c, [{ transform: flipFrom(c, r0) }, { transform: 'none' }], { duration: 380, easing: EASE }),
          contentFade(c, true, { duration: 220, delay: 120, easing: 'ease-out' }),
          sideFade(true, { duration: 260, delay: 140, easing: EASE }),
        ]);
      } else {
        await Promise.all([
          play(c, [{ opacity: 0, transform: 'translateY(16px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE }),
          sideFade(true, { duration: 260, delay: 120, easing: EASE }),
        ]);
      }
      reader.getAnimations({ subtree: true }).forEach((an) => an.cancel());
      return;
    }
    const c = card();
    if (!c || reader.hidden) {
      update();
      return;
    }
    // 关闭：世界、首页卡片和快捷栏立刻开始回来，面板同时缩回原卡片的位置，最后一小段淡掉
    root.classList.remove('reading');
    const r1 = to?.getBoundingClientRect();
    if (r1 && r1.width) {
      c.style.transformOrigin = '0 0';
      const target = flipFrom(c, r1);
      await Promise.all([
        contentFade(c, false, { duration: 140, easing: 'ease-in' }),
        sideFade(false, { duration: 140, easing: 'ease-in' }),
        play(c, [{ transform: 'none', opacity: 1 }, { transform: target, opacity: 1, offset: 0.75 }, { transform: target, opacity: 0 }], { duration: 380, easing: EASE }),
      ]);
    } else {
      await Promise.all([
        play(c, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(0.98)' }], { duration: 200, easing: 'ease-in' }),
        sideFade(false, { duration: 160, easing: 'ease-in' }),
      ]);
    }
    update();
    reader.getAnimations({ subtree: true }).forEach((an) => an.cancel());
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
    if (on) paintStatus(reader);
    unbindMap();
    unbindMap = () => {};
    // 服务器地图：只有地图页才加载查看器脚本
    if (on && reader.querySelector('[data-mc-map]')) {
      const my = token;
      void import('./mcmap.js').then((m) => {
        if (my === token && isOpen()) unbindMap = m.bindMap(reader);
      });
    }
    // 评论（Giscus iframe）很重：等开合动画播完、浏览器空闲时再加载，不抢动画的帧
    if (on) {
      const my = token;
      setTimeout(() => (window.requestIdleCallback ?? setTimeout)(() => my === token && isOpen() && mountComments(reader)), 450);
    }
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
    const v = versionOf(doc);
    if (VERSION && v && v !== VERSION) {
      // 网站更新过：整页加载，换上新的样式和脚本（load 已经把新页面写进了 HTTP 缓存）
      location.assign(href);
      return;
    }
    await adoptStyles(doc);
    if (my !== token) return; // 期间又点了别的

    const wasOpen = isOpen();
    const nav = (history.state ?? {}) as NavState;
    if (push) {
      const lateral = wasOpen && (!!from?.closest('.post-nav') || (LISTS.has(location.pathname) && LISTS.has(new URL(href, location.href).pathname)));
      if (lateral) {
        // 平移：替换当前这条，返回目标不变
        history.replaceState({ ...nav, scroll: undefined, focus: undefined } satisfies NavState, '', href);
      } else {
        let back: NavState['back'];
        if (wasOpen) {
          // 深入：先在当前这条记下滚动位置和点的链接，返回时恢复
          history.replaceState({ ...nav, scroll: scroller()?.scrollTop ?? 0, focus: from?.getAttribute('href') ?? undefined } satisfies NavState, '');
          back = { href: location.pathname + location.search, label: pageLabel() };
        }
        const homeDepth = wasOpen ? (nav.homeDepth ? nav.homeDepth + 1 : undefined) : location.pathname === '/' ? 1 : undefined;
        history.pushState({ reader: true, homeDepth, back } satisfies NavState, '', href);
      }
    }
    const state = (history.state ?? {}) as NavState;
    document.title = doc.title;
    const fromCard = !wasOpen ? (from?.closest<HTMLElement>('.card') ?? null) : null;
    await transition(() => {
      reader.innerHTML = next.innerHTML;
      labelBack(state);
      setReading(true);
      moveTo(card.dataset.section ?? 'home');
      const sc = scroller();
      const hash = new URL(href, location.href).hash;
      // 返回到上一级：回到离开时的位置；新打开的页从头开始
      if (!push && state.scroll) sc?.scrollTo({ top: state.scroll, behavior: 'instant' });
      else if (!hash || !scrollToAnchor(hash, false)) sc?.scrollTo({ top: 0, behavior: 'instant' });
    }, fromCard);
    const prevLink = !push && state.focus ? reader.querySelector<HTMLElement>(`a[href="${CSS.escape(state.focus)}"]`) : null;
    (prevLink ?? scroller())?.focus({ preventScroll: true });
    if (!wasOpen) source = from ?? null;
  }

  /** 当前面板页的短名字，给下一级的返回按钮用：「归档」「#Minecraft」、文章标题截短 */
  function pageLabel(): string {
    const h1 = reader.querySelector('.reader-scroll h1')?.textContent?.trim() ?? '';
    const text = h1 || document.title.split(/\s[|–-]\s/)[0];
    return text.length > 14 ? text.slice(0, 13) + '…' : text;
  }

  /** 有上一级时，返回按钮写明回到哪；没有就保持模板里的「回到森林」 */
  function labelBack(state: NavState) {
    const btn = reader.querySelector<HTMLAnchorElement>('[data-reader-back]');
    const label = btn?.querySelector('[data-back-label]');
    if (!btn || !label || !state.back) return;
    btn.href = state.back.href;
    label.textContent = state.back.label;
    btn.title = `返回${state.back.label}（Esc）`;
  }

  /** 返回一级：有上一级面板页就退回去，没有就关闭面板回到世界 */
  function goBack() {
    if (((history.state ?? {}) as NavState).back) history.back();
    else close(true);
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

  /** /tools/ 下的具体工具是独立应用（自带脚本），整页打开；/tools/ 列表本身走面板 */
  const isApp = (p: string) => /^\/tools\/.+/.test(p);

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
    if (a.hasAttribute('data-reader-back')) {
      e.preventDefault();
      goBack();
      return;
    }
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
    if (!url.pathname.endsWith('/') || isApp(url.pathname)) return;
    e.preventDefault();
    if (url.pathname === location.pathname && isOpen()) return;
    void open(url.href, true, a);
  });

  // 悬停 / 按下时预取，点下去基本是瞬开
  const prefetch = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
    const url = a && routable(a);
    if (url && url.pathname !== '/' && url.pathname.endsWith('/') && !isApp(url.pathname)) {
      load(url.href).catch(() => {});
      if (url.pathname === '/server/map/') void import('./mcmap.js').then((m) => m.warmMap(true)).catch(() => {});
    }
  };
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('touchstart', prefetch, { passive: true });

  /**
   * 首次进站也要瞬开：页面加载完、浏览器空闲时，把首页卡片能直接打开的面板页
   * （「查看全部」这些按钮和最新博文）先取回来，连同它们要的样式、面板页里的图片一起备好。
   * 一次只取一个、都放在空闲时间里，不和首屏抢带宽；省流量模式下不做。
   */
  function warmUp() {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));
    const urls = [...new Set(
      [...document.querySelectorAll<HTMLAnchorElement>('.stages a.btn-open[href], .stages .post-list a[href]')]
        .map((a) => routable(a))
        .filter((u): u is URL => !!u && u.pathname.endsWith('/') && u.pathname !== '/' && !isApp(u.pathname))
        .map((u) => u.origin + u.pathname),
    )];
    const next = () => {
      const u = urls.shift();
      if (!u) {
        // 最后预热世界地图：查看器脚本、manifest 和出生点附近的粗图
        if (document.querySelector('.stages a[href="/server/map/"]')) void import('./mcmap.js').then((m) => m.warmMap()).catch(() => {});
        return;
      }
      load(u)
        .then(async (text) => {
          const doc = new DOMParser().parseFromString(text, 'text/html');
          await adoptStyles(doc);
          if (!new URL(u).pathname.startsWith('/posts/')) {
            // 面板页的图片（头像、照片）先解码好；文章配图可能很大，不预取
            for (const img of doc.querySelectorAll<HTMLImageElement>('[data-reader] img[src]')) {
              const im = new Image();
              im.src = new URL(img.getAttribute('src')!, u).href;
              im.decode().catch(() => {});
            }
          }
        })
        .catch(() => {})
        .finally(() => idle(next));
    };
    idle(next);
  }
  // 停到服务器板块（「世界地图」按钮露出来）时，提前取开图视野里的清晰瓦片
  const mapBtn = document.querySelector('.stages a[href="/server/map/"]');
  if (mapBtn && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (!conn?.saveData) void import('./mcmap.js').then((m) => m.warmMap(true)).catch(() => {});
    }, { threshold: 0.6 });
    io.observe(mapBtn);
  }
  if (document.readyState === 'complete') setTimeout(warmUp, 800);
  else window.addEventListener('load', () => setTimeout(warmUp, 800), { once: true });

  // 版本检查：进站后一次，之后每次切回这个标签页时（至少隔 1 分钟）再查
  let checkedAt = 0;
  const maybeCheck = () => {
    if (document.visibilityState !== 'visible' || Date.now() - checkedAt < 60_000) return;
    checkedAt = Date.now();
    void checkVersion();
  };
  setTimeout(maybeCheck, 1500);
  document.addEventListener('visibilitychange', maybeCheck);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      goBack();
    }
  });

  // 直接打开的是带正文的页面（刷新时 history.state 还在，返回按钮照样写明上一级）
  if (isOpen()) {
    setReading(true);
    const kept = (history.state ?? {}) as NavState;
    history.replaceState({ ...kept, reader: true } satisfies NavState, '');
    labelBack(kept);
    const hash = location.hash;
    if (hash) requestAnimationFrame(() => scrollToAnchor(hash, false));
    scroller()?.focus({ preventScroll: true });
  }
}
