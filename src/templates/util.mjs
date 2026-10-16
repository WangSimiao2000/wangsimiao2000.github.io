/** @param {Date} d -> 2026/10/14（按北京时间） */
export const formatDate = (d) =>
  d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });

/** 中文阅读时长：约 400 字/分钟，代码块按 1/3 计 */
export function readingMinutes(md) {
  const code = (md.match(/```[\s\S]*?```/g) ?? []).join('').length;
  const text = md.length - code;
  return Math.max(1, Math.round((text + code / 3) / 400));
}
