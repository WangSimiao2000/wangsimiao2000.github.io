/**
 * Share utility functions
 * Generates share URLs for various social platforms
 */

import type { SharePlatform } from './data';

/** Generated share link */
export interface ShareLink {
  type: string;
  icon: string;
  url: string;
}

/**
 * Generate share links for all configured platforms
 *
 * Replaces URL and TITLE placeholders in the platform link template
 * with the actual post URL and title (URL-encoded).
 *
 * @param platforms - Share platform configurations
 * @param postUrl - Full URL of the post to share
 * @param postTitle - Title of the post to share
 * @returns Array of share links with resolved URLs
 */
export function generateShareLinks(
  platforms: SharePlatform[],
  postUrl: string,
  postTitle: string,
): ShareLink[] {
  const encodedUrl = encodeURIComponent(postUrl);
  const encodedTitle = encodeURIComponent(postTitle);

  return platforms.map((platform) => ({
    type: platform.type,
    icon: platform.icon,
    url: platform.link
      .replace(/URL/g, encodedUrl)
      .replace(/TITLE/g, encodedTitle),
  }));
}
