import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSitemap, pick } from '../../build/baidu-push.mjs';

const xml = `<?xml version="1.0"?><urlset>
  <url><loc>https://blog.mickeymiao.cn/</loc><lastmod>2026-11-01T00:00:00.000Z</lastmod></url>
  <url><loc>https://blog.mickeymiao.cn/posts/old/</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>
  <url><loc>https://blog.mickeymiao.cn/posts/new/</loc><lastmod>2026-11-12T00:00:00.000Z</lastmod></url>
  <url><loc>https://blog.mickeymiao.cn/posts/newer/</loc><lastmod>2026-11-13T00:00:00.000Z</lastmod></url>
  <url><loc>https://blog.mickeymiao.cn/archives/</loc></url>
</urlset>`;

test('百度推送：首页总在第一个，再加最近 3 天改过的（新的在前），剩下的名额补推旧文章（不推非文章页）', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  assert.deepEqual(pick(parseSitemap(xml), now), [
    'https://blog.mickeymiao.cn/',
    'https://blog.mickeymiao.cn/posts/newer/',
    'https://blog.mickeymiao.cn/posts/new/',
    'https://blog.mickeymiao.cn/posts/old/',
  ]);
});

test('百度推送：最多推 limit 条（新站每天额度少）', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  assert.equal(pick(parseSitemap(xml), now, 3, 2).length, 2);
  assert.deepEqual(pick([], now), []);
});

test('百度推送：旧文章按天轮流补推，几天就把所有文章都推过一遍', () => {
  const posts = Array.from({ length: 51 }, (_, i) => `<url><loc>https://blog.mickeymiao.cn/posts/p${i}/</loc><lastmod>2025-01-01T00:00:00.000Z</lastmod></url>`).join('');
  const entries = parseSitemap(`<urlset><url><loc>https://blog.mickeymiao.cn/</loc></url>${posts}</urlset>`);
  const seen = new Set();
  const day0 = Date.parse('2026-11-13T12:00:00Z');
  for (let d = 0; d < 6; d++) for (const u of pick(entries, day0 + d * 86400e3)) seen.add(u);
  assert.equal([...seen].filter((u) => u.includes('/posts/')).length, 51, '6 天里每篇文章都至少推过一次');
});
