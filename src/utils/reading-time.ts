/**
 * 阅读时间计算工具
 * 支持中文（按字符计数）和英文（按单词计数）的阅读时间估算
 */

import type { Locale } from '../types';

/** CJK Unicode 范围正则 */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u2e80-\u2eff\u3000-\u303f\u31c0-\u31ef\ufe30-\ufe4f]/g;

/** 阅读速度常量 */
const CJK_CHARS_PER_MINUTE = 300;
const WORDS_PER_MINUTE = 200;

export interface ReadingTimeResult {
  minutes: number;
  words: number;
}

/**
 * 计算文章阅读时间
 * - 中文：按 CJK 字符计数，约 300 字/分钟
 * - 英文：按单词计数，约 200 词/分钟
 * - 混合内容：分别统计 CJK 字符和非 CJK 单词，按 locale 确定主要阅读速度
 *
 * @param content - 文章正文内容
 * @param locale - 语言区域
 * @returns 阅读时间（分钟）和字数统计
 */
export function calculateReadingTime(content: string, locale: Locale): ReadingTimeResult {
  // Count CJK characters
  const cjkMatches = content.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Remove CJK characters, then count remaining words
  const nonCjkText = content.replace(CJK_REGEX, ' ');
  const nonCjkWords = nonCjkText
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const wordCount = nonCjkWords.length;

  // Total "words" = CJK chars + English words
  const totalWords = cjkCount + wordCount;

  // Calculate reading time: CJK portion + English portion
  const cjkMinutes = cjkCount / CJK_CHARS_PER_MINUTE;
  const wordMinutes = wordCount / WORDS_PER_MINUTE;
  const totalMinutes = cjkMinutes + wordMinutes;

  return {
    minutes: Math.max(1, Math.ceil(totalMinutes)),
    words: totalWords,
  };
}
