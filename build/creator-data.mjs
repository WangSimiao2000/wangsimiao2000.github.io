/**
 * 关于页「创作与开源」的数据整理（纯函数，单元测试覆盖）：B 站 wbi 签名、GitHub 贡献格子统计。
 */
import { createHash } from 'node:crypto';

/* ---------- B 站 wbi 签名 ---------- */

/** img_key + sub_key 按这张表重排，取前 32 位就是 mixin key（B 站网页端的固定表） */
const MIXIN = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

/** nav 接口 wbi_img 里的两个图片地址 -> 文件名（不含扩展名） */
export const wbiKey = (url) => url.slice(url.lastIndexOf('/') + 1).split('.')[0];

export const mixinKey = (imgKey, subKey) => {
  const raw = imgKey + subKey;
  return MIXIN.map((i) => raw[i]).join('').slice(0, 32);
};

/**
 * 给查询参数签名：加上 wts（秒），按键名排序，值里去掉 !'()*，再算 w_rid = md5(查询串 + mixin key)
 * @param {Record<string, string | number>} params
 */
export function signWbi(params, imgKey, subKey, wts = Math.round(Date.now() / 1000)) {
  const all = { ...params, wts };
  const query = Object.keys(all)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(all[k]).replace(/[!'()*]/g, ''))}`)
    .join('&');
  const w_rid = createHash('md5').update(query + mixinKey(imgKey, subKey)).digest('hex');
  return `${query}&w_rid=${w_rid}`;
}

/** 视频列表 -> 总播放量（已删除的视频不在列表里，所以比后台数字略少） */
export const sumPlays = (vlist) => vlist.reduce((s, v) => s + (Number(v.play) || 0), 0);

/* ---------- GitHub 贡献格子 ---------- */

/**
 * GraphQL contributionCalendar.weeks -> 页面用的格子数据和统计
 * @param {{ contributionDays: { date: string, contributionCount: number, contributionLevel: string }[] }[]} weeks
 */
export function shapeCalendar(weeks, total) {
  const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const days = weeks.flatMap((w) => w.contributionDays);
  // 最长连续：按日期顺序数连续有贡献的天
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // 当前连续：从最后一天往前数；今天还没提交不算断
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) current++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return {
    total: total ?? days.reduce((s, d) => s + d.contributionCount, 0),
    longest,
    current,
    activeDays: days.filter((d) => d.contributionCount > 0).length,
    // 每周一列，每列 7 格（周日到周六）；只存等级和数量，日期由第一天推出来
    start: days[0]?.date ?? null,
    weeks: weeks.map((w) => w.contributionDays.map((d) => [LEVEL[d.contributionLevel] ?? 0, d.contributionCount])),
    firstDow: days[0] ? new Date(`${days[0].date}T00:00:00Z`).getUTCDay() : 0,
  };
}

/** 2.4 万 / 9,876 这样的中文简写 */
export function compact(n) {
  if (n >= 1e8) return `${Math.round(n / 1e7) / 10} 亿`;
  if (n >= 1e4) return `${Math.round(n / 1e3) / 10} 万`;
  return n.toLocaleString('en-US');
}
