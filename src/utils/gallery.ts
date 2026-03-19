/**
 * Gallery utility functions.
 * Extracts testable logic from scripts/generate-gallery-r2.sh.
 */

/**
 * Generate a gallery title from an image filename.
 * Strips the file extension and replaces `-` and `_` with spaces.
 *
 * @param filename - The image filename (e.g. "my-photo_2024.jpg")
 * @returns The generated title (e.g. "my photo 2024")
 */
export function generateGalleryTitle(filename: string): string {
  // Remove extension
  const lastDot = filename.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? filename.substring(0, lastDot) : filename;

  // Replace - and _ with spaces (matches sed 's/[-_]/ /g' in the shell script)
  return nameWithoutExt.replace(/[-_]/g, ' ');
}
