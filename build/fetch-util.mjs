/**
 * 构建时拉外部数据（fetch-guestbook / fetch-creator / fetch-steam）共用的部分和统一的失败规则：
 *   拉不到（没有令牌、接口出错、超时）就沿用线上上一版：网站上同名的 JSON（构建时输出的那份）；
 *   线上也没有就不写文件，页面上不显示那一块。任何情况都正常退出，不挡部署。
 */
import { site } from '../src/site.mjs';

/** GET（或带 init 的请求），20 秒超时，非 2xx 算失败；as = 'json' 解析 JSON，'buf' 返回 Buffer */
export async function get(url, { as = 'json', ...init } = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), ...init, headers: { 'user-agent': 'blog-build', ...init.headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
}

/** 线上上一版：site.url 下的文件，比如 live('guestbook.json') */
export const live = (file, as = 'json') => get(`${site.url}/${file}`, { as });
