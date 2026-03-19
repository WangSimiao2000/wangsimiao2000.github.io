/**
 * Property 8: 数据驱动卡片渲染完整性
 * Validates: Requirements 3.6, 3.7, 12.8
 *
 * For any 数据驱动的卡片页面（Friends、Tools），渲染输出应包含数据源中每条记录的
 * 所有必填字段（Friends: name、url；Tools: name、description、icon）。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  renderFriendCard,
  renderFriendCards,
  renderToolCard,
  renderToolCards,
} from '@/utils/cards';
import type { FriendLink, ToolItem } from '@/types';

/** Generate a non-empty trimmed string (no HTML special chars to avoid injection) */
const safeNonEmptyString = (maxLen = 50) =>
  fc.string({ minLength: 1, maxLength: maxLen })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.replace(/[<>"&]/g, 'x'));

/** Generate a valid URL */
const urlArb = fc.webUrl();

/** Generate a random FriendLink with required fields */
const friendLinkArb: fc.Arbitrary<FriendLink> = fc.record({
  name: safeNonEmptyString(30),
  url: urlArb,
  icon: fc.option(urlArb, { nil: undefined }),
  description: fc.option(safeNonEmptyString(100), { nil: undefined }),
});

/** Generate a random ToolItem with all required fields */
const toolItemArb: fc.Arbitrary<ToolItem> = fc.record({
  name: safeNonEmptyString(30),
  description: safeNonEmptyString(100),
  url: fc.constantFrom('/tools/example/', '/tools/bazi-fortune/', '/tools/test-tool/'),
  icon: safeNonEmptyString(30).map((s) => `fa-solid fa-${s}`),
});

describe('Feature: jekyll-to-modern-framework-migration, Property 8: Data-driven card rendering completeness', () => {
  /**
   * Validates: Requirements 3.6
   * Each FriendLink card should contain the required name and url fields.
   */
  test.prop(
    [friendLinkArb],
    { numRuns: 100 },
  )(
    'friend card HTML contains required name and url',
    (friend) => {
      const html = renderFriendCard(friend);

      // Must contain the friend's name
      expect(html).toContain(friend.name);
      // Must contain the friend's url
      expect(html).toContain(friend.url);
    },
  );

  /**
   * Validates: Requirements 3.7, 12.8
   * Each ToolItem card should contain the required name, description, and icon fields.
   */
  test.prop(
    [toolItemArb],
    { numRuns: 100 },
  )(
    'tool card HTML contains required name, description, and icon',
    (tool) => {
      const html = renderToolCard(tool);

      // Must contain the tool's name
      expect(html).toContain(tool.name);
      // Must contain the tool's description
      expect(html).toContain(tool.description);
      // Must contain the tool's icon class
      expect(html).toContain(tool.icon);
    },
  );

  /**
   * Validates: Requirements 3.6
   * Batch rendering friends should include all records' required fields.
   */
  test.prop(
    [fc.array(friendLinkArb, { minLength: 1, maxLength: 10 })],
    { numRuns: 100 },
  )(
    'friend card grid contains all records with name and url',
    (friends) => {
      const html = renderFriendCards(friends);

      for (const friend of friends) {
        expect(html).toContain(friend.name);
        expect(html).toContain(friend.url);
      }
    },
  );

  /**
   * Validates: Requirements 3.7, 12.8
   * Batch rendering tools should include all records' required fields.
   */
  test.prop(
    [fc.array(toolItemArb, { minLength: 1, maxLength: 10 })],
    { numRuns: 100 },
  )(
    'tool card grid contains all records with name, description, and icon',
    (tools) => {
      const html = renderToolCards(tools);

      for (const tool of tools) {
        expect(html).toContain(tool.name);
        expect(html).toContain(tool.description);
        expect(html).toContain(tool.icon);
      }
    },
  );
});
