/**
 * TOC (Table of Contents) 工具函数
 * 从 HTML 或 Markdown 内容中提取标题，生成目录结构
 */

export interface TocEntry {
  depth: number;
  text: string;
  id: string;
}

/**
 * 从 HTML 或 Markdown 内容中提取标题
 */
export function extractHeadings(content: string): TocEntry[] {
  // Try HTML first
  const htmlEntries = extractFromHtml(content);
  if (htmlEntries.length > 0) return htmlEntries;

  // Fallback to Markdown
  return extractFromMarkdown(content);
}

function extractFromHtml(html: string): TocEntry[] {
  const regex = /<h([2-6])(?:\s[^>]*?\bid\s*=\s*"([^"]*)"[^>]*?|[^>]*)>([\s\S]*?)<\/h\1>/gi;
  const entries: TocEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const depth = parseInt(match[1], 10);
    const id = match[2] || '';
    const text = match[3].replace(/<[^>]*>/g, '').trim();
    if (text) {
      entries.push({ depth, text, id: id || slugify(text) });
    }
  }
  return entries;
}

function extractFromMarkdown(md: string): TocEntry[] {
  const regex = /^(#{2,6})\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(md)) !== null) {
    const depth = match[1].length;
    const text = match[2].replace(/\*\*|__|`/g, '').trim();
    if (text) {
      entries.push({ depth, text, id: slugify(text) });
    }
  }
  return entries;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
