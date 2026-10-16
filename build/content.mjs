/**
 * 读取内容：文章 (src/content/posts/*.md) 与数据文件 (src/data/*.yml)。
 * 文章文件名沿用 Jekyll 的 YYYY-MM-DD-slug.md，URL 为 /posts/slug/（区分大小写，与旧站一致）。
 */
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');

/**
 * @typedef {object} Post
 * @property {string} file    文件名
 * @property {string} slug
 * @property {string} url
 * @property {string} title
 * @property {Date} date
 * @property {Date | null} updated  git 记录的最后一次内容修改，与发布时间相差不到一天时为 null
 * @property {string[]} categories
 * @property {string[]} tags
 * @property {string} [description]
 * @property {boolean} math
 * @property {boolean} pin
 * @property {string} body    Markdown 正文
 */

/** "2024-10-19 22:00:00 +0800" -> Date；也接受 YAML 已解析好的 Date */
function parseDate(v, file) {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) throw new Error(`${file}: 无法解析日期 "${s}"`);
  const time = m[2] ? (m[2].length === 5 ? `${m[2]}:00` : m[2]) : '00:00:00';
  const tz = m[3] ? (m[3] === 'Z' ? 'Z' : m[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')) : '+08:00';
  const d = new Date(`${m[1]}T${time}${tz}`);
  if (Number.isNaN(d.valueOf())) throw new Error(`${file}: 无效日期 "${s}"`);
  return d;
}

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);

/**
 * 每篇文章最后一次「内容」修改时间。纯改名（R100，如 _posts -> src/content/posts）不算修改。
 * 文件名在迁移中没变，所以按文件名匹配，可以接上旧目录的历史。
 */
function gitUpdatedTimes() {
  /** @type {Map<string, Date>} */
  const times = new Map();
  let out = '';
  try {
    out = execFileSync('git', ['log', '-M', '--format=@%cI', '--name-status', '--', 'src/content/posts', '_posts'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return times; // 没有 git（例如解压的源码包）就不显示更新时间
  }
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@')) current = new Date(line.slice(1));
    else if (current && /^[AM]\t/.test(line)) {
      const name = path.basename(line.split('\t')[1]);
      if (!times.has(name)) times.set(name, current);
    }
  }
  return times;
}

/** @returns {Promise<Post[]>} 置顶优先，其余按发布时间倒序 */
export async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
  const updated = gitUpdatedTimes();
  const posts = await Promise.all(
    files.map(async (file) => {
      const src = await readFile(path.join(POSTS_DIR, file), 'utf8');
      const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
      if (!m) throw new Error(`${file}: 缺少 front matter`);
      const fm = parseYaml(m[1]) ?? {};
      if (!fm.title) throw new Error(`${file}: 缺少 title`);
      const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
      const date = parseDate(fm.date ?? file.slice(0, 10), file);
      const git = updated.get(file);
      return {
        file,
        slug,
        url: `/posts/${slug}/`,
        title: String(fm.title),
        date,
        updated: git && git - date > 86400e3 ? git : null,
        categories: asList(fm.categories),
        tags: asList(fm.tags),
        description: fm.description ? String(fm.description) : undefined,
        math: fm.math === true,
        pin: fm.pin === true,
        body: src.slice(m[0].length),
      };
    }),
  );
  const seen = new Set();
  for (const p of posts) {
    if (seen.has(p.slug)) throw new Error(`文章 slug 重复：${p.slug}`);
    seen.add(p.slug);
  }
  return posts.sort((a, b) => Number(b.pin) - Number(a.pin) || b.date - a.date);
}

/** @param {string} name 不带扩展名，如 'friends' */
export async function loadData(name) {
  return parseYaml(await readFile(path.join(ROOT, 'src/data', `${name}.yml`), 'utf8')) ?? [];
}
