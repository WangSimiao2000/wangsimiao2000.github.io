/**
 * 友链存活检测：node build/check-friends.mjs
 * 读 src/data/friends.yml，逐个访问，结果写到 src/data/friends-checked.json（生成文件，不进 git）。
 * 构建时有这个文件就按「存活 / 数字墓园」分组，没有就全部当作存活。
 *
 * 判定规则沿用旧站的 check-friends.sh：
 * - 2xx/3xx 存活；401/403/429 等是反爬或鉴权拦截，服务器其实在线，也算存活
 * - 404/410 等明确的 4xx 直接判失效；DNS 失败、超时、5xx 重试 3 次
 * - 原地址不通时再试 www / 去 www、https 降级 http
 * - 忽略证书错误（证书过期的博客也还在）
 * - friends.yml 里写 check: false 的跳过检测
 */
import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { loadData } from './content.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src/data/friends-checked.json');
const TIMEOUT = 15000;
const RETRIES = 3;
const PROTECTED = new Set([401, 402, 403, 405, 406, 409, 418, 429, 451]);
// CI 机房 IP + 机器人 UA 容易被 WAF 拦，伪装成普通浏览器
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/** 一次 GET，手动跟随最多 5 次跳转；只要状态码，不读正文 */
function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, { headers: HEADERS, timeout: TIMEOUT, rejectUnauthorized: false }, (res) => {
      res.resume();
      const code = res.statusCode ?? 0;
      if (code >= 300 && code < 400 && res.headers.location && hops < 5) {
        resolve(get(new URL(res.headers.location, u).href, hops + 1));
      } else resolve(code);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/** @returns {Promise<['alive' | 'protected' | 'dead', string]>} */
async function probe(url) {
  let last = '';
  for (let i = 0; i < RETRIES; i++) {
    try {
      const code = await get(url);
      if (code < 400) return ['alive', `HTTP ${code}`];
      if (PROTECTED.has(code)) return ['protected', `HTTP ${code}`];
      last = `HTTP ${code}`;
      if (code < 500) return ['dead', last];
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    if (i < RETRIES - 1) await new Promise((r) => setTimeout(r, 2000));
  }
  return ['dead', last];
}

function candidates(url) {
  const u = new URL(url);
  const alt = new URL(url);
  alt.hostname = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
  const list = [u.href, alt.href];
  if (u.protocol === 'https:') {
    const h = new URL(url);
    h.protocol = 'http:';
    list.push(h.href);
  }
  return list;
}

async function check(f) {
  if (!f.url) return [false, '缺少 url'];
  if (f.check === false) return [true, '跳过检测'];
  let first = '';
  for (const c of candidates(f.url)) {
    const [state, detail] = await probe(c);
    const via = c === new URL(f.url).href ? '' : ` via ${c}`;
    if (state === 'alive') return [true, detail + via];
    if (state === 'protected') return [true, `${detail} 反爬拦截，视为存活${via}`];
    first ||= detail;
  }
  return [false, first];
}

const friends = await loadData('friends');
const results = await Promise.all(friends.map(async (f) => [f, ...(await check(f))]));
const dead = [];
for (const [f, ok, detail] of results) {
  console.log(`  ${ok ? '✓' : '✗'} ${f.name} - ${detail}`);
  if (!ok) dead.push(f.url);
}
await writeFile(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), dead }, null, 2) + '\n');
console.log(`\n检测完成：${friends.length - dead.length} 存活，${dead.length} 失效`);
