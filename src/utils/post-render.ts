/**
 * 文章渲染工具函数
 * 生成文章元信息的 HTML 字符串，可独立于 Astro 组件进行测试
 */

import type { Locale } from '../types';
import { formatDate } from './date';
import { t } from './i18n';

/**
 * 渲染文章日期信息
 * 当提供 lastModified 时，同时显示发布日期和最后修改日期
 *
 * @param date - 发布日期
 * @param lastModified - 最后修改日期（可选）
 * @param locale - 语言区域
 * @returns 包含日期信息的 HTML 字符串
 */
export function renderPostDates(
  date: Date,
  lastModified?: Date,
  locale: Locale = 'zh-CN',
): string {
  const postedLabel = t('post.posted', locale);
  const updatedLabel = t('post.updated', locale);
  const formattedDate = formatDate(date, locale);

  const parts: string[] = [];

  parts.push(
    `<span class="post-date">` +
    `<span class="post-date-label">${postedLabel}</span> ` +
    `<time datetime="${date.toISOString()}">${formattedDate}</time>` +
    `</span>`
  );

  if (lastModified) {
    const formattedModified = formatDate(lastModified, locale);
    parts.push(
      `<span class="post-updated">` +
      `<span class="post-updated-label">${updatedLabel}</span> ` +
      `<time datetime="${lastModified.toISOString()}">${formattedModified}</time>` +
      `</span>`
    );
  }

  return parts.join('\n');
}
