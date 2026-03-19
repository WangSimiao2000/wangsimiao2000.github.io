import type { Locale } from '../types';

/**
 * 日期格式化工具
 * 支持中文（YYYY/MM/DD）和英文（MMM DD, YYYY）格式
 */

const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * 格式化日期为本地化字符串
 * - zh-CN: YYYY/MM/DD (e.g. 2024/01/15)
 * - en: MMM DD, YYYY (e.g. Jan 15, 2024)
 */
export function formatDate(date: Date, locale: Locale = 'zh-CN'): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  if (locale === 'en') {
    return `${MONTH_NAMES_EN[month]} ${day}, ${year}`;
  }

  // zh-CN format: YYYY/MM/DD with zero-padding
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}/${mm}/${dd}`;
}

/**
 * 格式化日期为 ISO 日期字符串 (YYYY-MM-DD)
 */
export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
