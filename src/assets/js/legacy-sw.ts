/**
 * 清掉旧 Jekyll（Chirpy）站留下的 Service Worker。
 *
 * 旧站开着 PWA 缓存：注册了 /sw.min.js，它对同域所有 GET 一律「缓存优先、永不过期」。
 * 访问过旧站的浏览器里它一直活着，新站的页面、manifest、version.json 都会被它拿旧副本顶替，
 * 于是出现旧站的背景、布局错乱，只有 Ctrl+Shift+R（绕过 Service Worker）才正常。
 *
 * 两路一起清：
 * - /sw.min.js 换成自毁版本（public/sw.min.js），浏览器例行检查更新时装上它，它删缓存、注销、刷新页面；
 * - 页面这边也主动注销并删缓存。被旧缓存控制着的页面刷新一次（每个标签页只刷一次）。
 * 新站自己不用 Service Worker，所以这里注销的一定是旧站的。
 */
export async function removeLegacyServiceWorker(): Promise<void> {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  try {
    // 旧 Service Worker 注销后、页面刷新前还在途的请求会被它再存进缓存，所以每次都顺手清（新站不用 Cache API）
    const clear = async () => {
      if (!('caches' in self)) return;
      await Promise.all((await caches.keys()).filter((k) => k.startsWith('chirpy')).map((k) => caches.delete(k)));
    };
    const regs = await sw.getRegistrations();
    if (!regs.length && !sw.controller) return clear();
    await Promise.all(regs.map((r) => r.unregister()));
    await clear();
    if (sw.controller && !sessionStorage.getItem('legacy-sw-reloaded')) {
      sessionStorage.setItem('legacy-sw-reloaded', '1');
      location.reload();
    }
  } catch {
    /* 隐私模式等拿不到 Service Worker 时什么都不做 */
  }
}
