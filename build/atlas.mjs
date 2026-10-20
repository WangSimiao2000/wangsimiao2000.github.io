#!/usr/bin/env node
/**
 * 像素图集打包：src/art/ 下每个精灵一张 PNG（文件路径就是名字），构建时拼成一张图集。
 *
 *   src/art/hero/r/run/0.png       -> 精灵 hero.r.run.0
 *   src/art/scenery/cottage.png    -> 精灵 scenery.cottage
 *   src/art/scenery/cottage.glow.png -> 它的自发光遮罩 scenery.cottage#glow（尺寸必须和本体一样）
 *
 * 输出（生成文件，不进 git）：src/assets/img/atlas.png 和 src/assets/js/pixel/atlas-map.ts。
 * 内容没变就不写，避免开发服务器的文件监听来回触发。
 *
 * 检查不过就报错退出（CI 里会停在部署之前）：
 * - 代码要用的精灵（REQUIRED）缺了；
 * - 同一个角色动作的各帧尺寸不一致（跑起来会抖）；
 * - 自发光遮罩和本体尺寸不同、或者没有本体；
 * - PNG 格式不支持（见 png.mjs）。
 *
 * 单独运行：node build/atlas.mjs
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePNG, encodePNG } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.join(ROOT, 'src/art');
const OUT_PNG = path.join(ROOT, 'src/assets/img/atlas.png');
const OUT_MAP = path.join(ROOT, 'src/assets/js/pixel/atlas-map.ts');
const WIDTH = 256;

/**
 * 代码里用到的精灵。以 .* 结尾的是一组编号精灵（prefix.0、prefix.1……至少要有 0）。
 * 同一行里的帧尺寸必须一致（角色动作）：写在 SAME_SIZE 里。
 */
const REQUIRED = [
  ...['oak', 'forest', 'blossom', 'pine', 'bush', 'blossomBush', 'rock', 'sandRock', 'snowRock', 'cactus', 'tuft', 'dryTuft', 'flowers', 'autumn', 'autumnBush'].map((k) => `scenery.${k}.*`),
  ...['cottage', 'fence', 'lamp', 'sign', 'campfire', 'hay'].map((k) => `scenery.${k}`),
  ...['r', 'l'].flatMap((s) => [`hero.${s}.idle.0`, `hero.${s}.idle.1`, `hero.${s}.run.*`, `hero.${s}.sit.*`]),
  ...['r', 'l'].flatMap((s) => [`girl.${s}.idle`, `girl.${s}.walk.0`, `girl.${s}.walk.1`, `girl.${s}.wave.0`, `girl.${s}.wave.1`]),
  'cat.l.sit', 'cat.l.tail', 'cat.l.blink', 'cat.l.jump',
  'hat', 'lantern.day', 'lantern.night', 'slingshot.fork', 'slingshot.stone',
];
/** 这些前缀下的所有帧必须同样大（站立、跑步帧尺寸不同会让脚底和头顶上下跳） */
const SAME_SIZE = ['hero.r.idle', 'hero.l.idle', 'hero.r.run', 'hero.l.run', 'hero.r.sit', 'hero.l.sit', 'girl.r', 'girl.l'];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.png')) out.push(p);
  }
  return out;
}

/** 文件路径 -> 精灵名 */
export function nameOf(rel) {
  const parts = rel.replace(/\\/g, '/').replace(/\.png$/, '').split('/');
  const last = parts.pop();
  const glow = last.endsWith('.glow');
  parts.push(glow ? last.slice(0, -5) : last);
  return parts.join('.') + (glow ? '#glow' : '');
}

/** 货架法装箱：按高度从高到低（同高按名字），一行放满换行，精灵之间留 1 像素空隙 */
export function pack(sizes, width = WIDTH) {
  const order = Object.keys(sizes).sort((a, b) => sizes[b][1] - sizes[a][1] || a.localeCompare(b));
  const map = {};
  let x = 0, y = 0, shelf = 0;
  for (const n of order) {
    const [w, h] = sizes[n];
    if (w > width) throw new Error(`精灵 ${n} 宽 ${w}，超过图集宽度 ${width}`);
    if (x + w > width) {
      x = 0;
      y += shelf + 1;
      shelf = 0;
    }
    map[n] = [x, y, w, h];
    x += w + 1;
    shelf = Math.max(shelf, h);
  }
  return { map, height: y + shelf };
}

/** 检查精灵集合，返回所有问题（空数组 = 通过） */
export function check(sizes) {
  const errors = [];
  const names = new Set(Object.keys(sizes));
  for (const req of REQUIRED) {
    if (req.endsWith('.*')) {
      if (!names.has(`${req.slice(0, -2)}.0`)) errors.push(`缺少精灵组 ${req.slice(0, -2)}（至少要有 ${req.slice(0, -2)}.0）`);
    } else if (!names.has(req)) errors.push(`缺少精灵 ${req}`);
  }
  for (const n of names) {
    if (!n.includes('#')) continue;
    const base = n.split('#')[0];
    if (!sizes[base]) errors.push(`自发光遮罩 ${n} 没有对应的本体 ${base}`);
    else if (sizes[base][0] !== sizes[n][0] || sizes[base][1] !== sizes[n][1]) errors.push(`自发光遮罩 ${n} 是 ${sizes[n].join('x')}，本体 ${base} 是 ${sizes[base].join('x')}，要一样大`);
  }
  for (const prefix of SAME_SIZE) {
    const group = [...names].filter((n) => !n.includes('#') && n.startsWith(`${prefix}.`));
    const dims = new Set(group.map((n) => sizes[n].join('x')));
    if (dims.size > 1) errors.push(`${prefix} 下各帧尺寸不一致：${group.map((n) => `${n}=${sizes[n].join('x')}`).join('，')}`);
  }
  return errors;
}

async function writeIfChanged(file, data) {
  const old = await readFile(file).catch(() => null);
  if (old && Buffer.compare(old, Buffer.from(data)) === 0) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return true;
}

export async function buildAtlas() {
  const files = await walk(ART);
  const imgs = {};
  for (const f of files) {
    const rel = path.relative(ART, f);
    imgs[nameOf(rel)] = decodePNG(await readFile(f), `src/art/${rel}`);
  }
  const sizes = Object.fromEntries(Object.entries(imgs).map(([n, im]) => [n, [im.width, im.height]]));
  const errors = check(sizes);
  if (errors.length) throw new Error(`像素图集检查没通过：\n  - ${errors.join('\n  - ')}`);
  const { map, height } = pack(sizes);
  const atlas = new Uint8Array(WIDTH * height * 4);
  for (const [n, [x, y, w, h]] of Object.entries(map)) {
    const src = imgs[n].data;
    for (let r = 0; r < h; r++) atlas.set(src.subarray(r * w * 4, (r + 1) * w * 4), ((y + r) * WIDTH + x) * 4);
  }
  const names = Object.keys(map).sort();
  const ts = `// 生成文件（build/atlas.mjs 从 src/art/ 打包），不要手改，也不进 git。
export const ATLAS_SIZE = [${WIDTH}, ${height}] as const;

export const ATLAS: Record<string, readonly [number, number, number, number]> = {
${names.map((n) => `  '${n}': [${map[n].join(', ')}],`).join('\n')}
};
`;
  const changed = (await writeIfChanged(OUT_PNG, encodePNG(WIDTH, height, atlas))) | (await writeIfChanged(OUT_MAP, ts));
  return { count: names.length, width: WIDTH, height, changed: !!changed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await buildAtlas();
  console.log(`像素图集：${r.count} 个精灵，${r.width}x${r.height}${r.changed ? '（已更新）' : ''}`);
}
