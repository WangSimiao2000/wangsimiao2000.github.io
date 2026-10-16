/** @param {Date} d -> 2026/10/14（按北京时间） */
export const formatDate = (d) =>
  d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });

/** 中文阅读时长：约 400 字/分钟，代码块按 1/3 计 */
export function readingMinutes(md) {
  const code = (md.match(/```[\s\S]*?```/g) ?? []).join('').length;
  const text = md.length - code;
  return Math.max(1, Math.round((text + code / 3) / 400));
}

/**
 * 分类 / 标签的 URL 片段，与旧站 Jekyll slugify（default 模式）一致，保证 /browse/tags/xxx/ 地址不变：
 * 转小写，连续的非字母数字（Unicode 意义上）换成 '-'，去掉首尾 '-'。
 */
export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

export const categoryUrl = (c) => `/browse/categories/${encodeURIComponent(slugify(c))}/`;
export const tagUrl = (t) => `/browse/tags/${encodeURIComponent(slugify(t))}/`;
