/**
 * Property 23: 相册标题从文件名生成
 * Validates: Requirements 14.3
 *
 * For any 图片文件名（不含扩展名），将其中的 `-` 和 `_` 替换为空格后，
 * 应得到与生成的 gallery 标题一致的字符串。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateGalleryTitle } from '@/utils/gallery';

/** Supported image extensions */
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'] as const;

/** Generate a random image extension */
const extensionArb = fc.constantFrom(...imageExtensions);

/**
 * Generate a non-empty filename base (no dots, no path separators).
 * May contain alphanumeric chars, hyphens, and underscores.
 */
const filenameBaseArb = fc
  .array(
    fc.oneof(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
      ),
      fc.constantFrom('-', '_'),
    ),
    { minLength: 1, maxLength: 40 },
  )
  .map((chars) => chars.join(''));

/** Generate a full image filename like "my-photo_2024.jpg" */
const imageFilenameArb = fc
  .tuple(filenameBaseArb, extensionArb)
  .map(([base, ext]) => `${base}.${ext}`);

describe('Feature: jekyll-to-modern-framework-migration, Property 23: Gallery title from filename', () => {
  /**
   * Validates: Requirements 14.3
   * The generated title should equal the filename without extension,
   * with all `-` and `_` replaced by spaces.
   */
  test.prop(
    [imageFilenameArb],
    { numRuns: 200 },
  )(
    'gallery title matches filename with extension stripped and -/_ replaced by spaces',
    (filename) => {
      const title = generateGalleryTitle(filename);

      // Manually compute expected title
      const dotIndex = filename.lastIndexOf('.');
      const nameWithoutExt = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
      const expected = nameWithoutExt.replace(/[-_]/g, ' ');

      expect(title).toBe(expected);
    },
  );

  /**
   * Validates: Requirements 14.3
   * The generated title should never contain `-` or `_` characters.
   */
  test.prop(
    [imageFilenameArb],
    { numRuns: 200 },
  )(
    'gallery title contains no hyphens or underscores',
    (filename) => {
      const title = generateGalleryTitle(filename);

      expect(title).not.toMatch(/[-_]/);
    },
  );

  /**
   * Validates: Requirements 14.3
   * The generated title should not contain the file extension.
   */
  test.prop(
    [imageFilenameArb],
    { numRuns: 200 },
  )(
    'gallery title does not contain the file extension',
    (filename) => {
      const title = generateGalleryTitle(filename);
      const ext = filename.substring(filename.lastIndexOf('.'));

      expect(title).not.toContain(ext);
    },
  );
});
