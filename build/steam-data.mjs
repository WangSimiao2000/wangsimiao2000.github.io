/**
 * Steam 接口返回 -> 页面用的数据（纯函数，单元测试覆盖）。
 * owned：GetOwnedGames 的 response.games；recent：GetRecentlyPlayedGames 的 response.games。
 * 时长单位都是分钟。
 */

/** 首页卡片和面板「最近在玩」最多几条 */
export const RECENT_MAX = 8;
/** 带封面的游戏数（最近在玩 + 时长最多的），其余只列名字 */
export const COVER_MAX = 60;

/**
 * @param {{ appid: number, name?: string, playtime_forever?: number, playtime_2weeks?: number, rtime_last_played?: number }[]} owned
 * @param {{ appid: number, name?: string, playtime_forever?: number, playtime_2weeks?: number }[]} recent
 * @param {number[]} hide 不想展示的 appid
 */
export function shapeSteam(owned, recent, hide = []) {
  const hidden = new Set(hide.map(Number));
  const two = new Map(recent.map((g) => [g.appid, g.playtime_2weeks ?? 0]));
  const games = owned
    .filter((g) => !hidden.has(g.appid))
    .map((g) => ({
      id: g.appid,
      n: (g.name ?? `App ${g.appid}`).trim(),
      all: g.playtime_forever ?? 0,
      two: two.get(g.appid) ?? 0,
      last: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString().slice(0, 10) : null,
    }))
    .sort((a, b) => b.all - a.all || a.n.localeCompare(b.n, 'zh-CN'));
  // 最近两周玩过的，按两周时长排；免费游戏可能不在 owned 里，从 recent 补上
  const ids = new Set(games.map((g) => g.id));
  for (const g of recent) {
    if (hidden.has(g.appid) || ids.has(g.appid)) continue;
    games.push({ id: g.appid, n: (g.name ?? `App ${g.appid}`).trim(), all: g.playtime_forever ?? 0, two: g.playtime_2weeks ?? 0, last: null });
  }
  const recentIds = games
    .filter((g) => g.two > 0)
    .sort((a, b) => b.two - a.two)
    .slice(0, RECENT_MAX)
    .map((g) => g.id);
  const coverIds = [...new Set([...recentIds, ...games.filter((g) => g.all > 0).slice(0, COVER_MAX).map((g) => g.id)])];
  return {
    total: games.length,
    played: games.filter((g) => g.all > 0).length,
    minutes: games.reduce((s, g) => s + g.all, 0),
    recent: recentIds,
    covers: coverIds,
    games,
  };
}

/** 卡片上要列的游戏：最近两周玩过的；一个都没有就列时长最多的，标题换成「玩得最多」 */
export function featured(steam, n = 3) {
  const byId = new Map(steam.games.map((g) => [g.id, g]));
  const recent = steam.recent.map((id) => byId.get(id)).filter(Boolean);
  if (recent.length) return { kind: 'recent', games: recent.slice(0, n) };
  return { kind: 'top', games: steam.games.filter((g) => g.all > 0).slice(0, n) };
}

/** 分钟 -> 「45 分钟」「3.5 小时」「120 小时」 */
export function playtime(min) {
  if (min < 60) return `${min} 分钟`;
  const h = min / 60;
  return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)} 小时`;
}
