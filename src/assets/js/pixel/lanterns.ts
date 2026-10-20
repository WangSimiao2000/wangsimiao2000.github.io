/**
 * 秋林里的孔明灯：留言板每条留言放一盏，从树梢后面慢慢升起、左右轻摆，升到天顶淡出，再从树后升起。
 *
 * 画在天空层：世界画布上半截是透明渐隐的，孔明灯要升到天上就只能画在天空里；
 * 天空层在世界和卡片后面，被挡住的时候不能点（只登记露在外面那段的点击区域）。
 * 数据是构建时生成的 /guestbook.json（作者、前 30 个字、日期），走到秋林附近才去取。
 */
import { SECTION, heightAt } from './biomes.js';
import { halo } from './lights.js';
import { renderRows, hash } from './sprites.js';
import type { Frame } from './frame.js';

export interface Note {
  a: string; // 作者
  t: string; // 摘要
  d: string; // 日期
}

export interface LanternHit {
  note: Note;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CENTER = -SECTION; // 秋林在起点左边一整个板块
const SPREAD = 150; // 散布在秋林中心左右这么远（世界像素）
const RISE = 3; // 上升速度（逻辑像素 / 秒）
const TREETOP = 44; // 从离地这么高（树梢附近）开始升起，下面被树挡着

// 孔明灯：圆顶纸罩上宽下窄，底口一圈竹框，下面吊着火苗。天空层不吃夜色，夜里单独一套亮着的颜色
const ROWS = [
  '..kkkkk..',
  '.kLLLLLk.',
  'kLLHHHLLk',
  'kLHHHHHLk',
  'kLHHHHHLk',
  '.kLHHHLk.',
  '.kLLHLLk.',
  '..kLLLk..',
  '..kbbbk..',
  '....F....',
  '....f....',
];
const DAY = { k: '#a8572c', L: '#f2ae62', H: '#f8cd8c', b: '#7a4a2a', F: '#ff8a3d', f: '#ffcf5a' };
const NIGHT = { k: '#c46a2f', L: '#ffbd5e', H: '#fff0b8', b: '#8a5a32', F: '#ffb04d', f: '#fff2b0' };

/**
 * 第 i 盏（共 n 盏）的水平位置（世界坐标）：左右交替，放在卡片两侧露出的空地上空；
 * 窄屏两侧没空地，就收到屏幕以内（升过卡片顶以后照样看得见）。W = 画面宽（逻辑像素）
 */
export function lanternX(i: number, n: number, W: number) {
  const outer = Math.min(SPREAD, W / 2 - 8);
  const inner = Math.min(100, outer * 0.55);
  const side = i % 2 === 0 ? 1 : -1;
  const perSide = Math.ceil(n / 2);
  const k = Math.floor(i / 2);
  const u = perSide === 1 ? 0.4 : k / (perSide - 1);
  return CENTER + side * (inner + (outer - inner) * u);
}

export class Lanterns {
  notes: Note[] = [];
  hits: LanternHit[] = [];
  private loading = false;
  private sprites: { day: HTMLCanvasElement; night: HTMLCanvasElement } | null = null;

  /** 走近秋林时取一次数据（失败就没有灯，秋林照常） */
  private load() {
    if (this.loading) return;
    this.loading = true;
    fetch('/guestbook.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { notes?: Note[] } | null) => {
        if (Array.isArray(d?.notes)) this.notes = d.notes.slice(0, 24);
      })
      .catch(() => {});
  }

  /** 一盏灯此刻的位置：按自己的相位循环上升（树梢 -> 天顶），左右轻摆；快到天顶时淡出 */
  private pose(fr: Frame, wx: number, seed: number) {
    const { H, time } = fr;
    const start = H - heightAt(wx) - TREETOP;
    const top = H * 0.05;
    const speed = RISE * (0.85 + hash(seed + 7) * 0.3);
    const period = Math.max(1, (start - top) / speed);
    const t = fr.reduced ? (0.3 + 0.4 * hash(seed)) * period : (time + hash(seed) * period) % period;
    const y = start - t * speed;
    const x = wx + (fr.reduced ? 0 : Math.sin(time * 0.35 + seed * 2.1) * 3);
    const alpha = Math.max(0, Math.min(1, (y - top) / (H * 0.12), t / 2.5)); // 树后冒头时淡入，天顶淡出
    return { x, y, alpha, start };
  }

  /** 在天空层画出来（drawSky 之后） */
  draw(fr: Frame) {
    this.hits = [];
    const { sk, W, camLeft, dark } = fr;
    if (camLeft > CENTER + SPREAD + 30 || camLeft + W < CENTER - SPREAD - 30) return;
    this.load();
    const n = this.notes.length;
    if (!n) return;
    this.sprites ??= { day: renderRows(ROWS, DAY, false), night: renderRows(ROWS, NIGHT, false) };
    const sp = dark ? this.sprites.night : this.sprites.day;
    for (let i = 0; i < n; i++) {
      const wx = lanternX(i, n, W);
      const p = this.pose(fr, wx, i);
      const x = Math.round(p.x - camLeft - sp.width / 2);
      const y = Math.round(p.y);
      if (x > W || x + sp.width < 0 || p.alpha <= 0) continue;
      if (dark) halo(sk, x + 4, y + 4, 12, '#ffc96a', 0.32 * p.alpha);
      sk.globalAlpha = p.alpha;
      sk.drawImage(sp, x, y);
      // 刚从树后冒头时还被树挡着，露出来以后才能点
      if (p.alpha > 0.5 && y < p.start - 6) this.hits.push({ note: this.notes[i], x0: x - 2, y0: y - 2, x1: x + sp.width + 2, y1: y + sp.height + 2 });
    }
    sk.globalAlpha = 1;
  }

  hitAt(lx: number, ly: number) {
    return this.hits.find((h) => lx >= h.x0 && lx <= h.x1 && ly >= h.y0 && ly <= h.y1) ?? null;
  }
}
