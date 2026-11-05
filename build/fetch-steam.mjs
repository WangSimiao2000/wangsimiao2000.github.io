#!/usr/bin/env node
/**
 * Steam 游戏库 -> src/data/steam.json + src/data/steam-covers/<appid>.jpg（都是生成文件，不进 git），
 * 构建时渲染进首页「游戏」板块和 /games/，封面输出到 /games/covers/。访客页面不请求 Steam。
 *
 * 需要 STEAM_API_KEY（CI 里是仓库 Secret）。Steam ID 默认从 site.links.steam 的自定义地址解析，
 * 也可以用 STEAM_ID 直接给 64 位 ID。Steam 隐私设置里「游戏详情」要公开，否则拿不到游戏库。
 * 不想展示的游戏，把 appid 写进 src/data/games-hide.yaml。
 *
 * 拉取失败（没有 Key、网络、隐私）时，改从线上取上一版的 games.json 和封面接着用；
 * 线上也没有就不写文件，首页「游戏」板块只显示 MC 服务器。任何情况都正常退出，不挡部署。
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { site } from '../src/site.mjs';
import { shapeSteam } from './steam-data.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src/data/steam.json');
const COVERS = path.join(ROOT, 'src/data/steam-covers');
const API = 'https://api.steampowered.com';
const CDN = [
  (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_231x87.jpg`,
  (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/capsule_231x87.jpg`,
  (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
];

const get = async (url, as = 'json') => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'blog-build' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return as === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
};

async function steamId(key) {
  if (process.env.STEAM_ID) return process.env.STEAM_ID;
  const vanity = site.links.steam.match(/\/id\/([^/]+)/)?.[1];
  const profiles = site.links.steam.match(/\/profiles\/(\d+)/)?.[1];
  if (profiles) return profiles;
  const r = await get(`${API}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`);
  if (r.response?.success !== 1) throw new Error('解析不了 Steam 自定义地址');
  return r.response.steamid;
}

/** 依次试几个 CDN 地址，都没有就不要封面（页面上用占位块） */
async function cover(id) {
  for (const url of CDN) {
    try {
      const buf = await get(url(id), 'buf');
      if (buf[0] === 0xff && buf[1] === 0xd8) return buf;
    } catch {}
  }
  return null;
}

async function fromSteam() {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error('没有 STEAM_API_KEY');
  const id = await steamId(key);
  const [owned, recent] = await Promise.all([
    get(`${API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${id}&include_appinfo=1&include_played_free_games=1`),
    get(`${API}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${id}&count=20`),
  ]);
  if (!owned.response?.games) throw new Error('拿不到游戏库（Steam 隐私设置里「游戏详情」要公开）');
  const hide = await readFile(path.join(ROOT, 'src/data/games-hide.yaml'), 'utf8').then((t) => parse(t) ?? []).catch(() => []);
  const data = shapeSteam(owned.response.games, recent.response?.games ?? [], hide);
  const got = new Map();
  for (let i = 0; i < data.covers.length; i += 8) {
    const batch = data.covers.slice(i, i + 8);
    (await Promise.all(batch.map(cover))).forEach((buf, j) => buf && got.set(batch[j], buf));
  }
  return { data, got };
}

/** 线上上一版：/games.json + /games/covers/<id>.jpg */
async function fromLive() {
  const data = await get(`${site.url}/games.json`);
  const got = new Map();
  await Promise.all(
    data.covers.map(async (id) => {
      try {
        got.set(id, await get(`${site.url}/games/covers/${id}.jpg`, 'buf'));
      } catch {}
    }),
  );
  return { data, got };
}

let result;
try {
  result = await fromSteam();
  result.data.updated = new Date().toISOString();
} catch (err) {
  console.log(`Steam 游戏库：读取失败（${err.message}），改用线上上一版`);
  try {
    result = await fromLive();
  } catch (e) {
    console.log(`Steam 游戏库：线上也没有（${e.message}），跳过`);
    process.exit(0);
  }
}
const { data, got } = result;
data.covers = data.covers.filter((id) => got.has(id));
await rm(COVERS, { recursive: true, force: true });
await mkdir(COVERS, { recursive: true });
await Promise.all([...got].map(([id, buf]) => writeFile(path.join(COVERS, `${id}.jpg`), buf)));
await writeFile(OUT, JSON.stringify(data));
console.log(`Steam 游戏库：${data.total} 款，最近两周 ${data.recent.length} 款，封面 ${got.size} 张`);
