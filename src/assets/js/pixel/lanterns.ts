/**
 * 秋林里的留言灯笼：留言板每条留言挂一盏，串在一根垂下来的绳子上。
 * 数据是构建时生成的 /guestbook.json（作者、前 30 个字、日期），走到秋林附近才去取。
 * 灯笼画进前景（夜色会盖上去），灯芯算自发光，夜里另有光晕；悬停 / 点一下显示留言摘要。
 */
import { SECTION, heightAt } from './biomes.js';
import { emit } from './lights.js';
import { renderRows } from './sprites.js';
import type { Frame } from './frame.js';

export interface Note {
  a: string; // 作者
  t: string; // 摘要
  d: string; // 日期
}

const CENTER = -SECTION; // 秋林在起点左边一整个板块
const SPAN = 70; // 绳子从中心往两边各伸出这么远（世界像素）
const SAG = 2; // 中间下垂多少
const ROPE_UP = 32; // 绳子离地高度：卡片底边（离地约 34）和主角头顶（离地 20）之间

const LANTERN_ROWS = [
  '..kk..',
  '.kRRk.',
  'kRYYRk',
  'kRYYRk',
  'kRRRRk',
  '.kRRk.',
  '..Y...',
];
const PAL = { k: '#3b1f1a', R: '#d9452b', Y: '#ffd36a' };
const GLOW_ROWS = ['......', '......', '..YY..', '..YY..', '......', '......', '......'];

export interface LanternHit {
  note: Note;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Lanterns {
  notes: Note[] = [];
  hits: LanternHit[] = [];
  private loading = false;
  private sprite: (HTMLCanvasElement & { emissive?: HTMLCanvasElement }) | null = null;

  /** 走近秋林时取一次数据（失败就不挂，秋林照常） */
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

  /**
   * 绳子上第 i 盏（共 n 盏）的位置：均匀分布在绳子两侧，正中间留空（主角就站在秋林正中，
   * 灯笼挂在他头顶会挡住他），中间垂得最低
   */
  static slot(i: number, n: number) {
    const GAP = 0.2; // 中间留空的比例
    const v = 0.06 + ((1 - 0.12 - GAP) * (i + 0.5)) / n;
    const u = v < 0.5 - GAP / 2 ? v : v + GAP;
    const wx = CENTER - SPAN + u * SPAN * 2;
    const sag = Math.sin(u * Math.PI) * SAG;
    return { wx, u, sag };
  }

  /** 画进前景层（在布景之后、地面之前调用也行，灯笼挂在空中，和地面不重叠） */
  draw(fr: Frame) {
    this.hits = [];
    const { f, H, camLeft, W } = fr;
    if (camLeft > CENTER + SPAN + 20 || camLeft + W < CENTER - SPAN - 20) return;
    this.load();
    const n = this.notes.length;
    if (!n) return;
    if (!this.sprite) {
      const sp = renderRows(LANTERN_ROWS, PAL, false) as HTMLCanvasElement & { emissive?: HTMLCanvasElement };
      sp.emissive = renderRows(GLOW_ROWS, { Y: '#ffe08a' }, false);
      this.sprite = sp;
    }
    const sp = this.sprite;
    // 绳子：两端挂在离地 ROPE_UP 的高处，中间下垂
    const end = (wx: number) => H - heightAt(wx) - ROPE_UP;
    const y0 = end(CENTER - SPAN);
    const y1 = end(CENTER + SPAN);
    f.fillStyle = fr.dark ? '#5a4a40' : '#7a5e48';
    for (let wx = CENTER - SPAN; wx <= CENTER + SPAN; wx++) {
      const u = (wx - (CENTER - SPAN)) / (SPAN * 2);
      const sx = Math.round(wx - camLeft);
      if (sx < 0 || sx >= W) continue;
      f.fillRect(sx, Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * SAG), 1, 1);
    }
    for (let i = 0; i < n; i++) {
      const { wx, u, sag } = Lanterns.slot(i, n);
      const swing = fr.reduced ? 0 : Math.round(Math.sin(fr.time * 1.4 + i * 1.7) * 0.6);
      const ropeY = Math.round(y0 + (y1 - y0) * u + sag);
      const x = Math.round(wx - camLeft - sp.width / 2) + swing;
      const y = ropeY + 1;
      if (x > W || x + sp.width < 0) continue;
      f.fillStyle = fr.dark ? '#5a4a40' : '#7a5e48';
      f.fillRect(x + 2, ropeY + 1, 1, 1); // 吊绳
      f.drawImage(sp, x, y);
      emit(fr, sp, x, y);
      this.hits.push({ note: this.notes[i], x0: x - 2, y0: y - 2, x1: x + sp.width + 2, y1: y + sp.height + 2 });
    }
  }

  /** 夜里的光晕位置（屏幕坐标），交给灯光模块统一画 */
  glowPoints() {
    return this.hits.map((h) => ({ x: Math.round((h.x0 + h.x1) / 2), y: h.y0 + 6 }));
  }

  hitAt(lx: number, ly: number) {
    return this.hits.find((h) => lx >= h.x0 && lx <= h.x1 && ly >= h.y0 && ly <= h.y1) ?? null;
  }
}
