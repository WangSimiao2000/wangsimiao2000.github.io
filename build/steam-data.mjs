/**
 * Steam 接口返回 -> 页面用的数据（纯函数，单元测试覆盖）。
 * owned：GetOwnedGames 的 response.games；recent：GetRecentlyPlayedGames 的 response.games。
 * 时长单位都是分钟。
 *
 * 封面分三种（文件名 <appid>.<种类>.jpg）：
 *   s：231x87 小横图，首页卡片的游戏行用（只给「最近玩过」的几款）
 *   p：300x450 竖图，/games/ 瀑布流里玩得最多的几款用，卡片高，排出来错落
 *   h：460x215 横图，/games/ 瀑布流里其余的游戏用
 */

/** 「最近玩过」最多几条（首页卡片取前几条，面板全列） */
export const RECENT_MAX = 8;
/** 瀑布流里带封面的游戏数（最近玩过 + 时长最多的），其余只列名字 */
export const COVER_MAX = 60;
/** 时长前几名用竖图 */
export const PORTRAIT_MAX = 8;

/**
 * @param {{ appid: number, name?: string, playtime_forever?: number, playtime_2weeks?: number, rtime_last_played?: number }[]} owned
 * @param {{ appid: number, name?: string, playtime_forever?: number, playtime_2weeks?: number }[]} recent
 * @param {number[]} hide 不想展示的 appid
 * @param {Record<number, string>} names 商店里的中文名（拿不到的沿用游戏库里的名字）
 */
export function shapeSteam(owned, recent, hide = [], names = {}) {
  const hidden = new Set(hide.map(Number));
  const two = new Map(recent.map((g) => [g.appid, g.playtime_2weeks ?? 0]));
  const name = (g) => (names[g.appid] ?? g.name ?? `App ${g.appid}`).trim();
  const games = owned
    .filter((g) => !hidden.has(g.appid))
    .map((g) => ({
      id: g.appid,
      n: name(g),
      all: g.playtime_forever ?? 0,
      two: two.get(g.appid) ?? 0,
      last: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString().slice(0, 10) : null,
    }));
  // 免费游戏可能不在 owned 里，从 recent 补上
  const ids = new Set(games.map((g) => g.id));
  for (const g of recent) {
    if (hidden.has(g.appid) || ids.has(g.appid)) continue;
    games.push({ id: g.appid, n: name(g), all: g.playtime_forever ?? 0, two: g.playtime_2weeks ?? 0, last: null });
  }
  games.sort((a, b) => b.all - a.all || a.n.localeCompare(b.n, 'zh-CN'));
  const recentIds = games.filter((g) => g.two > 0).sort((a, b) => b.two - a.two).map((g) => g.id);
  // 最近玩过：先是近两周玩过的（按两周时长），再按上次游玩日期补满
  const lately = [
    ...recentIds,
    ...games
      .filter((g) => !g.two && g.all > 0 && g.last)
      .sort((a, b) => b.last.localeCompare(a.last))
      .map((g) => g.id),
  ].slice(0, RECENT_MAX);
  const played = games.filter((g) => g.all > 0);
  const portrait = played.slice(0, PORTRAIT_MAX).map((g) => g.id);
  const wall = [...new Set([...lately, ...played.slice(0, COVER_MAX).map((g) => g.id)])];
  /** @type {Record<number, string>} 每款要下载的封面种类 */
  const art = {};
  for (const id of wall) art[id] = portrait.includes(id) ? 'p' : 'h';
  for (const id of lately) art[id] += 's';
  return {
    total: games.length,
    played: played.length,
    minutes: games.reduce((s, g) => s + g.all, 0),
    recent: recentIds.slice(0, RECENT_MAX),
    lately,
    art,
    games,
  };
}

/** 有没有某种封面（下载失败的会从 art 里去掉） */
export const hasArt = (steam, id, kind) => !!steam.art?.[id]?.includes(kind);

/** 卡片上要列的游戏：最近玩过的前 n 款 */
export function featured(steam, n = 3) {
  const byId = new Map(steam.games.map((g) => [g.id, g]));
  const list = (steam.lately ?? steam.recent).map((id) => byId.get(id)).filter(Boolean);
  if (list.length) return { kind: list.some((g) => g.two) ? 'recent' : 'lately', games: list.slice(0, n) };
  return { kind: 'top', games: steam.games.filter((g) => g.all > 0).slice(0, n) };
}

/** 分钟 -> 「45 分钟」「3.5 小时」「120 小时」 */
export function playtime(min) {
  if (min < 60) return `${min} 分钟`;
  const h = min / 60;
  return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)} 小时`;
}

/** 2025-09-27 -> 2025/09/27；今年的省掉年份 */
export function playedOn(last, now = new Date()) {
  if (!last) return '';
  const [y, m, d] = last.split('-');
  return Number(y) === now.getFullYear() ? `${m}/${d}` : `${y}/${m}/${d}`;
}
