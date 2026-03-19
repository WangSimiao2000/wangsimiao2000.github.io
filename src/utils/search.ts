/**
 * Search utility functions
 *
 * Extracted from SearchModal.astro for testability and reuse.
 * Provides keyword highlighting for search results.
 */

/** Escape special regex characters in a string */
export function escapeRegex(str: string): string {
  return str.replace(/[-.*+?^${}()|[\]\\]/g, (match) => '\\' + match);
}

/** Highlight keywords in text using <mark> tags */
export function highlightKeywords(text: string, query: string): string {
  if (!query.trim() || !text) return text;

  const escaped = escapeRegex(query);
  const words = escaped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return text;

  const pattern = new RegExp('(' + words.join('|') + ')', 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}
