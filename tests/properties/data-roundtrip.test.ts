/**
 * Property 2: 数据文件解析往返
 * Validates: Requirements 2.3, 12.1, 12.2, 12.3, 12.4
 *
 * For any YAML 数据文件（friends、gallery、tools、contact），将其序列化为 YAML
 * 后再解析，应得到与原始数据结构等价的对象。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import yaml from 'js-yaml';
import type { FriendLink, GalleryItem, ToolItem, ContactItem } from '@/types';

// YAML special values to avoid in generated strings
const YAML_SPECIAL = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~', '']);

// Use a safe string arbitrary that avoids YAML special values
const safeString: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => {
    const trimmed = s.trim();
    return trimmed.length > 0 && !YAML_SPECIAL.has(trimmed.toLowerCase());
  });

// URL-like string arbitrary
const safeUrl: fc.Arbitrary<string> = safeString.map(
  (s) => `https://example.com/${s.replace(/\s+/g, '-')}`,
);

// FriendLink arbitrary
const friendLinkArb: fc.Arbitrary<FriendLink> = fc.record({
  name: safeString,
  url: safeUrl,
  icon: fc.option(safeUrl, { nil: undefined }),
  description: fc.option(safeString, { nil: undefined }),
});

// GalleryItem arbitrary
const galleryItemArb: fc.Arbitrary<GalleryItem> = fc.record({
  title: safeString,
  image: safeUrl,
  key: safeString,
});

// ToolItem arbitrary
const toolItemArb: fc.Arbitrary<ToolItem> = fc.record({
  name: safeString,
  description: safeString,
  url: safeUrl,
  icon: safeString,
});

// ContactItem arbitrary
const contactItemArb: fc.Arbitrary<ContactItem> = fc.record({
  type: safeString,
  icon: safeString,
  url: fc.option(safeUrl, { nil: undefined }),
  noblank: fc.option(fc.boolean(), { nil: undefined }),
});

/** Roundtrip helper: dump to YAML then load back */
function yamlRoundtrip<T>(data: T): T {
  const serialized = yaml.dump(data);
  return yaml.load(serialized) as T;
}

/** Strip undefined fields for comparison (YAML omits undefined values) */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

describe('Feature: jekyll-to-modern-framework-migration, Property 2: 数据文件解析往返', () => {
  test.prop([fc.array(friendLinkArb, { minLength: 1, maxLength: 10 })], { numRuns: 100 })(
    'FriendLink[] roundtrips through YAML serialization',
    (friends: FriendLink[]) => {
      const result = yamlRoundtrip(friends);
      expect(result).toEqual(stripUndefined(friends));
    },
  );

  test.prop([fc.array(galleryItemArb, { minLength: 1, maxLength: 10 })], { numRuns: 100 })(
    'GalleryItem[] roundtrips through YAML serialization',
    (gallery: GalleryItem[]) => {
      const result = yamlRoundtrip(gallery);
      expect(result).toEqual(stripUndefined(gallery));
    },
  );

  test.prop([fc.array(toolItemArb, { minLength: 1, maxLength: 10 })], { numRuns: 100 })(
    'ToolItem[] roundtrips through YAML serialization',
    (tools: ToolItem[]) => {
      const result = yamlRoundtrip(tools);
      expect(result).toEqual(stripUndefined(tools));
    },
  );

  test.prop([fc.array(contactItemArb, { minLength: 1, maxLength: 10 })], { numRuns: 100 })(
    'ContactItem[] roundtrips through YAML serialization',
    (contacts: ContactItem[]) => {
      const result = yamlRoundtrip(contacts);
      expect(result).toEqual(stripUndefined(contacts));
    },
  );
});
