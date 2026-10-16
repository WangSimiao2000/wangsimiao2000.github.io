/**
 * Giscus 评论：阅读面板每次打开 / 换页后，在面板里的 [data-giscus] 容器加载一次。
 * 按 pathname 映射到 GitHub Discussions（与旧站一致），地址不变所以历史评论都在。
 * 主题跟随站点亮 / 暗切换；正式域名用站内的轻拟物主题，本地开发用官方主题
 * （giscus 的 https iframe 读不到 http://127.0.0.1 上的样式）。
 */
const ORIGIN = 'https://giscus.app';

function themeUrl(): string {
  const dark = document.documentElement.dataset.theme === 'dark';
  if (location.protocol !== 'https:') return dark ? 'dark' : 'light';
  return `${location.origin}/assets/css/giscus-${dark ? 'dark' : 'light'}.css`;
}

let observer: MutationObserver | null = null;

function syncTheme() {
  const frame = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
  frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme: themeUrl() } } }, ORIGIN);
}

/** 在 root 里找评论容器并加载；没有容器（如归档页）就什么都不做 */
export function mountComments(root: ParentNode) {
  const box = root.querySelector<HTMLElement>('[data-giscus]');
  if (!box || box.dataset.loaded) return;
  box.dataset.loaded = '1';
  const s = document.createElement('script');
  const attrs: Record<string, string> = {
    src: `${ORIGIN}/client.js`,
    'data-repo': box.dataset.repo ?? '',
    'data-repo-id': box.dataset.repoId ?? '',
    'data-category': box.dataset.category ?? '',
    'data-category-id': box.dataset.categoryId ?? '',
    'data-mapping': 'pathname',
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'bottom',
    'data-theme': themeUrl(),
    'data-lang': 'zh-CN',
    'data-loading': 'lazy',
    crossorigin: 'anonymous',
  };
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  s.async = true;
  box.after(s); // client.js 会把 iframe 放进同级的 .giscus 容器
  // iframe 一插进来是空白的，等它加载完再淡入，不要「啪」一下冒出来
  const host = box.parentElement;
  if (host) {
    const mo = new MutationObserver(() => {
      const frame = host.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      if (!frame) return;
      mo.disconnect();
      const ready = () => frame.classList.add('is-ready');
      frame.addEventListener('load', ready, { once: true });
      setTimeout(ready, 4000);
    });
    mo.observe(host, { childList: true, subtree: true });
  }
  if (!observer) {
    observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
}
