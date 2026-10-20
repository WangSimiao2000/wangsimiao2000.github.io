#!/usr/bin/env node
/**
 * 留言板（/guestbook/，Giscus 按 pathname 映射到标题为 guestbook/ 的 Discussion）的留言，
 * 写到 src/data/guestbook.json（生成文件，不进 git），构建时输出成 /guestbook.json，
 * 秋林里按它挂灯笼。访客页面不请求 GitHub。
 *
 * 需要 GITHUB_TOKEN（CI 里是 Actions 自带的令牌，要 discussions: read；本地可用 GITHUB_TOKEN=$(gh auth token)）。
 * 拿不到就不写文件、正常退出：秋林照常，只是没有灯笼。
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/guestbook.json');
const MAX = 24; // 最多挂这么多盏，多了只挂最新的
const SNIPPET = 30;

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.log('留言灯笼：没有 GITHUB_TOKEN，跳过');
  process.exit(0);
}
const [owner, name] = site.giscus.repo.split('/');
const query = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    discussions(first: 50, categoryId: "${site.giscus.categoryId}", orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes { title comments(last: ${MAX}) { totalCount nodes { author { login } bodyText createdAt isMinimized } } }
    }
  }
}`;

try {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'blog-build' },
    body: JSON.stringify({ query, variables: { owner, name } }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json();
  if (!res.ok || data.errors) throw new Error(JSON.stringify(data.errors ?? res.status));
  const d = data.data.repository.discussions.nodes.find((n) => n.title === 'guestbook/');
  const notes = (d?.comments.nodes ?? [])
    .filter((c) => !c.isMinimized && c.bodyText.trim())
    .map((c) => {
      const text = c.bodyText.replace(/\s+/g, ' ').trim();
      return { a: c.author?.login ?? '匿名', t: text.length > SNIPPET ? `${text.slice(0, SNIPPET)}…` : text, d: c.createdAt.slice(0, 10) };
    })
    .reverse(); // 最新的在前
  await writeFile(OUT, JSON.stringify({ total: d?.comments.totalCount ?? 0, notes: notes.slice(0, MAX) }));
  console.log(`留言灯笼：${notes.length} 条留言`);
} catch (err) {
  console.log(`留言灯笼：读取失败，跳过（${err}）`);
}
