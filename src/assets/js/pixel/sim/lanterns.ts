/**
 * 秋林里的孔明灯：留言板每条留言放一盏，从树梢高度慢慢淡入、升起、左右轻摆，升到天顶淡出，再从树梢升起。
 *
 * 画在 aloft 层：和人物在同一个平面上，远山、树线挡不住它；刚冒出来、还很淡的时候不能点（只登记亮起来以后的点击区域）。
 * 数据是构建时生成的 /guestbook.json（作者、前 30 个字、日期），走到秋林附近才去取。
 */
import { SECTION, heightAt } from './biomes.js';
import { hash } from './sprites.js';
import { sprite } from '../atlas.js';
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
const TREETOP = 44;
/** 孔明灯里火苗的位置（相对精灵左上角） */
const LANTERN_FLAME = [4.5, 8.5] as const; // 从离地这么高（树梢附近）开始升起，下面被树挡着

// 孔明灯（图集里的 lantern.day / lantern.night）：圆顶纸罩上宽下窄，底口一圈竹框，下面吊着火苗。
// aloft 层不吃夜色，夜里单独一套亮着的颜色

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

  /** 画到 aloft 层 */
  draw(fr: Frame) {
    this.hits = [];
    const { dl, W, camLeft, dark } = fr;
    if (camLeft > CENTER + SPREAD + 30 || camLeft + W < CENTER - SPREAD - 30) return;
    this.load();
    const n = this.notes.length;
    if (!n) return;
    const sp = sprite(dark ? 'lantern.night' : 'lantern.day');
    for (let i = 0; i < n; i++) {
      const wx = lanternX(i, n, W);
      const p = this.pose(fr, wx, i);
      const x = Math.round(p.x - camLeft - sp.width / 2);
      const y = Math.round(p.y);
      if (x > W || x + sp.width < 0 || p.alpha <= 0) continue;
      dl.sprite('aloft', sp, x, y, { alpha: p.alpha });
      // 夜里和路灯、窗户一样：亮着的像素进自发光层（辉光），火苗是一个点光源，照亮下面的树梢
      if (dark) {
        dl.sprite('emissive', sp, x, y, { glow: true, alpha: p.alpha });
        dl.light(x + LANTERN_FLAME[0], y + LANTERN_FLAME[1], 18, 0.5 * p.alpha, '#ffc96a');
      }
      // 刚从树后冒头时还被树挡着，露出来以后才能点
      if (p.alpha > 0.5 && y < p.start - 6) this.hits.push({ note: this.notes[i], x0: x - 2, y0: y - 2, x1: x + sp.width + 2, y1: y + sp.height + 2 });
    }
  }

  hitAt(lx: number, ly: number) {
    return this.hits.find((h) => lx >= h.x0 && lx <= h.x1 && ly >= h.y0 && ly <= h.y1) ?? null;
  }
}
