// 旧 Jekyll（Chirpy）站的 Service Worker 曾注册在这个地址，对全站做「缓存优先」。
// 新站不用 Service Worker：浏览器检查更新时会装上这个自毁版本，
// 它删掉旧缓存、注销自己，再把它控制着的页面刷新一次，之后页面直接走网络。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: 'window' });
      await Promise.all(pages.map((c) => c.navigate(c.url).catch(() => {})));
    })(),
  );
});
