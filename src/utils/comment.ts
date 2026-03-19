/**
 * Comment utility functions
 *
 * Provides a testable function for rendering Giscus config as HTML,
 * since Astro components cannot be directly tested in vitest.
 */
import type { GiscusConfig } from '../types';

/**
 * Renders a Giscus configuration object as an HTML script element string
 * with all config parameters as data-* attributes.
 *
 * @param config - The Giscus configuration object
 * @returns HTML string containing a script element with data attributes
 */
export function renderGiscusConfig(config: GiscusConfig): string {
  const attrs = [
    `data-repo="${escapeAttr(config.repo)}"`,
    `data-repo-id="${escapeAttr(config.repoId)}"`,
    `data-category="${escapeAttr(config.category)}"`,
    `data-category-id="${escapeAttr(config.categoryId)}"`,
    `data-mapping="${escapeAttr(config.mapping)}"`,
    `data-lang="${escapeAttr(config.lang)}"`,
  ];

  return `<script src="https://giscus.app/client.js" ${attrs.join(' ')} crossorigin="anonymous" async></script>`;
}

/**
 * Renders a comment section based on the enabled flag and Giscus config.
 *
 * When enabled is false, returns an empty string (no comment container).
 * When enabled is true, returns the full comment section HTML with Giscus config.
 *
 * @param enabled - Whether comments are enabled for this post
 * @param config - The Giscus configuration object
 * @returns HTML string for the comment section, or empty string if disabled
 */
export function renderCommentSection(enabled: boolean, config: GiscusConfig): string {
  if (!enabled) {
    return '';
  }

  const scriptTag = renderGiscusConfig(config);
  return `<section id="comments" class="giscus-container"><div class="giscus"></div>${scriptTag}</section>`;
}

/**
 * Escapes special characters for safe use in HTML attributes.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
