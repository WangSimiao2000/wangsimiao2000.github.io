/**
 * TOC (Table of Contents) 工具函数
 * 从 HTML 内容中提取标题，生成目录结构
 */

/** TOC 条目 */
export interface TocEntry {
  /** 标题层级 (2-6) */
  depth: number;
  /** 标题文本 */
  text: string;
  /** 锚点 ID */
  id: string;
}

/**
 * 从 HTML 内容中提取标题标签 (h2-h6)
 * 返回按出现顺序排列的 TOC 条目列表
 *
 * @param html - HTML 内容字符串
 * @returns TOC 条目数组
 */
export function extractHeadings(html: string): TocEntry[] {
  const headingRegex = /<h([2-6])(?:\s[^>]*?\bid\s*=\s*"([^"]*)"[^>]*?|[^>]*)>([\s\S]*?)<\/h\1>/gi;
  const entries: TocEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    const depth = parseInt(match[1], 10);
    const id = match[2] || '';
    // Strip HTML tags from heading text
    const rawText = match[3];
    const text = stripHtmlTags(rawText).trim();

    if (text) {
      entries.push({
        depth,
        text,
        id: id || slugify(text),
      });
    }
  }

  return entries;
}

/**
 * Strip HTML tags from a string
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Generate a URL-friendly slug from text
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
