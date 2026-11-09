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
const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/';
/** 封面种类 -> 商店资源字段，和拿不到资源信息时的老地址 */
const KINDS = {
  s: ['small_capsule', 'capsule_231x87.jpg'],
  p: ['library_capsule', 'library_600x900.jpg'],
  h: ['header', 'header.jpg'],
};

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

/**
 * 商店信息：中文名和各种封面的真实地址（新游戏的封面路径带哈希，老地址会 404）。
 * 不需要 Key；国区不卖的游戏拿不到，就用游戏库里的英文名和老地址。
 */
async function storeItems(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const input = {
      ids: ids.slice(i, i + 50).map((appid) => ({ appid })),
      context: { language: 'schinese', country_code: 'CN' },
      data_request: { include_assets: true },
    };
    try {
      const r = await get(`${API}/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
      for (const it of r.response?.store_items ?? []) if (it.success === 1) out.set(it.appid, it);
    } catch (err) {
      console.log(`Steam 游戏库：商店信息读取失败（${err.message}），这一批用英文名`);
    }
  }
  return out;
}

const isJpeg = (buf) => buf[0] === 0xff && buf[1] === 0xd8;

async function download(id, kind, item) {
  const [field, legacy] = KINDS[kind];
  const a = item?.assets;
  const urls = [
    a?.[field] && CDN + a.asset_url_format.replace('${FILENAME}', a[field]),
    `${CDN}steam/apps/${id}/${legacy}`,
  ].filter(Boolean);
  for (const url of urls) {
    try {
      const buf = await get(url, 'buf');
      if (isJpeg(buf)) return buf;
    } catch {}
  }
  return null;
}

/** 按 data.art 下载封面，8 个一批；返回 "<id>.<种类>" -> 图片 */
async function downloadAll(data, fetchOne) {
  const jobs = Object.entries(data.art).flatMap(([id, kinds]) => [...kinds].map((k) => [Number(id), k]));
  const got = new Map();
  for (let i = 0; i < jobs.length; i += 8) {
    const batch = jobs.slice(i, i + 8);
    (await Promise.all(batch.map(([id, k]) => fetchOne(id, k)))).forEach((buf, j) => buf && got.set(`${batch[j][0]}.${batch[j][1]}`, buf));
  }
  return got;
}

/** 游戏库和最近游玩。本地没有 Key 时可以用 STEAM_FIXTURE=<json 文件> 给一份 { owned, recent }（两个接口的原始返回）调页面 */
async function library() {
  if (process.env.STEAM_FIXTURE) return JSON.parse(await readFile(process.env.STEAM_FIXTURE, 'utf8'));
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error('没有 STEAM_API_KEY');
  const id = await steamId(key);
  const [owned, recent] = await Promise.all([
    get(`${API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${id}&include_appinfo=1&include_played_free_games=1`),
    get(`${API}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${id}&count=20`),
  ]);
  return { owned, recent };
}

async function fromSteam() {
  const { owned, recent } = await library();
  if (!owned.response?.games) throw new Error('拿不到游戏库（Steam 隐私设置里「游戏详情」要公开）');
  const hide = await readFile(path.join(ROOT, 'src/data/games-hide.yaml'), 'utf8').then((t) => parse(t) ?? []).catch(() => []);
  const games = owned.response.games;
  const items = await storeItems(games.map((g) => g.appid));
  const names = Object.fromEntries([...items].map(([id, it]) => [id, it.name]));
  const data = shapeSteam(games, recent.response?.games ?? [], hide, names);
  const got = await downloadAll(data, (id, k) => download(id, k, items.get(id)));
  return { data, got };
}

/** 线上上一版：/games.json + /games/covers/<id>.<种类>.jpg */
async function fromLive() {
  const data = await get(`${site.url}/games.json`);
  if (!data.art) throw new Error('线上是旧格式');
  const got = await downloadAll(data, (id, k) => get(`${site.url}/games/covers/${id}.${k}.jpg`, 'buf').catch(() => null));
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
// 下载失败的封面从 art 里去掉，页面上用占位块
for (const [id, kinds] of Object.entries(data.art)) {
  const ok = [...kinds].filter((k) => got.has(`${id}.${k}`)).join('');
  if (ok) data.art[id] = ok;
  else delete data.art[id];
}
await rm(COVERS, { recursive: true, force: true });
await mkdir(COVERS, { recursive: true });
await Promise.all([...got].map(([name, buf]) => writeFile(path.join(COVERS, `${name}.jpg`), buf)));
await writeFile(OUT, JSON.stringify(data));
const kb = Math.round([...got.values()].reduce((s, b) => s + b.length, 0) / 1024);
console.log(`Steam 游戏库：${data.total} 款，最近玩过 ${data.lately.length} 款，封面 ${got.size} 张共 ${kb} KB`);
