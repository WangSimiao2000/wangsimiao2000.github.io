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

test('百度推送：首页总在第一个，再加最近 3 天改过的（新的在前），旧的和没有修改时间的不推', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  assert.deepEqual(pick(parseSitemap(xml), now), [
    'https://blog.mickeymiao.cn/',
    'https://blog.mickeymiao.cn/posts/newer/',
    'https://blog.mickeymiao.cn/posts/new/',
  ]);
});

test('百度推送：最多推 limit 条（新站每天额度少）', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');
  assert.equal(pick(parseSitemap(xml), now, 3, 2).length, 2);
  assert.deepEqual(pick([], now), []);
});
