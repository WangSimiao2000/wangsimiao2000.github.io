#!/usr/bin/env node
/**
 * 关于页「创作与开源」：B 站粉丝 / 视频 / 总播放 + GitHub 最近一年贡献格子 -> src/data/creator.json（生成文件，不进 git），
 * 构建时渲染进 /about/ 并输出 /creator.json。访客页面不请求 B 站和 GitHub。
 *
 * B 站用不登录也能访问的接口（总播放量是把视频列表的播放量加起来，列表接口要 wbi 签名）；
 * GitHub 用 GraphQL，需要 GITHUB_TOKEN（CI 里是 Actions 自带的令牌；本地可用 GITHUB_TOKEN=$(gh auth token)）。
 * 两边各自独立：哪边拉不到，就沿用线上上一版里那一边；线上也没有就不显示那一块。任何情况都正常退出，不挡部署。
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { site } from '../src/site.mjs';
import { shapeCalendar, signWbi, sumPlays, wbiKey } from './creator-data.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src/data/creator.json');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function getJSON(url, init = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), ...init });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function bili() {
  const mid = site.links.bilibili.match(/space\.bilibili\.com\/(\d+)/)?.[1];
  if (!mid) throw new Error('site.links.bilibili 里没有 UID');
  const headers = { 'user-agent': UA, referer: `https://space.bilibili.com/${mid}` };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // B 站对连续请求很敏感（短时间内多几次就回 412），所以一个一个来、中间停一下，412 就等几秒重试
  async function api(p) {
    for (let i = 0; ; i++) {
      await sleep(i ? 4000 * i : 800);
      try {
        const j = await getJSON(`https://api.bilibili.com/${p}`, { headers });
        if (j.code !== 0 && !(p.startsWith('x/web-interface/nav') && j.data?.wbi_img)) throw new Error(`${p.split('?')[0]} code ${j.code} ${j.message}`);
        return j.data;
      } catch (err) {
        if (i >= 2 || !/412|-352|-799/.test(err.message)) throw err;
      }
    }
  }
  const rel = await api(`x/relation/stat?vmid=${mid}`);
  const nav = await api(`x/space/navnum?mid=${mid}`);
  // nav 不登录时 code 是 -101，但 wbi_img 照样给
  const keys = (await api('x/web-interface/nav')).wbi_img;
  const img = wbiKey(keys.img_url);
  const sub = wbiKey(keys.sub_url);
  let plays = 0;
  let count = 0;
  for (let pn = 1; pn <= 10; pn++) {
    const q = signWbi({ mid, ps: 50, pn, order: 'pubdate' }, img, sub);
    const d = await api(`x/space/wbi/arc/search?${q}`);
    const list = d.list?.vlist ?? [];
    plays += sumPlays(list);
    count += list.length;
    if (!list.length || count >= (d.page?.count ?? 0)) break;
  }
  return { mid, followers: rel.follower, videos: nav.video, plays, counted: count };
}

async function github() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('没有 GITHUB_TOKEN');
  const login = site.links.github.replace(/\/$/, '').split('/').pop();
  const query = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar {
    totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } } } }`;
  const j = await getJSON('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'blog-build' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  const cal = j.data.user.contributionsCollection.contributionCalendar;
  return { login, ...shapeCalendar(cal.weeks, cal.totalContributions) };
}

const live = await getJSON(`${site.url}/creator.json`).catch(() => ({}));
const out = { updated: new Date().toISOString() };
for (const [name, fn] of [['bili', bili], ['gh', github]]) {
  try {
    out[name] = await fn();
  } catch (err) {
    console.log(`创作与开源：${name} 读取失败（${err.message}）${live[name] ? '，沿用线上上一版' : '，这一块不显示'}`);
    if (live[name]) out[name] = live[name];
  }
}
if (!out.bili && !out.gh) process.exit(0);
await writeFile(OUT, JSON.stringify(out));
const b = out.bili;
console.log(`创作与开源：B 站 ${b ? `${b.followers} 粉丝 ${b.videos} 视频 ${b.plays} 播放` : '无'}；GitHub ${out.gh ? `${out.gh.total} 次贡献` : '无'}`);
