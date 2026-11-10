/**
 * 天空：不抢内容，只是淡淡的一层。白天一轮太阳，夜里一轮月亮和一片固定的星空；日月是带明暗的像素圆球。
 */
import type { DrawList } from '../drawlist.js';
import type { Frame } from './frame.js';
import { GROUND } from './biomes.js';
import { mix } from './util.js';

interface Star {
  x: number;
  y: number;
  big: boolean;
  warm: boolean;
  phase: number;
  speed: number;
}

/** 星星位置用固定种子生成：每次打开都是同一片星空 */
export function makeStars(W: number, H: number): Star[] {
  const out: Star[] = [];
  const n = Math.round((W * H) / 420);
  for (let i = 0; i < n; i++) {
    const r = (k2: number) => {
      const v = Math.sin(i * 127.1 + k2 * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    out.push({ x: r(1) * W, y: 2 + Math.pow(r(2), 1.4) * H * 0.5, big: r(3) < 0.05, warm: r(4) < 0.2, phase: r(5) * 6.28, speed: 0.6 + r(6) * 1.6 });
  }
  return out;
}

/**
 * 日月：像素圆球，按左上来的光分 4 档明暗（和布景一个光向），月亮再点几个坑。
 * 逐个像素算球面法线和光的夹角，量化成 4 档
 */
const SUN = ['#f0a04a', '#ffc35c', '#ffdb86', '#fff1c2'];
const SUNSET = ['#c4472a', '#e8693a', '#ff9250', '#ffc884']; // 日出日落：贴着山的时候偏橘红
const MOON = ['#98a3c2', '#c3cce2', '#e2e7f3', '#fbfcff'];
const CRATERS: readonly [number, number, number][] = [[-2, 1, 1], [2, -2, 0], [1, 3, 0], [-3, -2, 0]]; // dx, dy, 大坑 = 1
const LIGHT_DIR = (() => {
  const v = [-0.55, -0.6, 0.58];
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
})();

function orb(dl: DrawList, cx: number, cy: number, r: number, tones: string[], alpha: number, craters = false) {
  const R = r + 0.5;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(R * R - y * y));
    for (let x = -w; x <= w; x++) {
      const nx = x / R;
      const ny = y / R;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const d = nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1] + nz * LIGHT_DIR[2];
      const k = d > 0.85 ? 3 : d > 0.55 ? 2 : d > 0.2 ? 1 : 0;
      dl.rect('sky', cx + x, cy + y, 1, 1, tones[k], alpha);
    }
  }
  if (!craters) return;
  for (const [dx, dy, big] of CRATERS) {
    dl.rect('sky', cx + dx, cy + dy, 1 + big, 1 + big, tones[1], alpha);
    if (big) dl.rect('sky', cx + dx, cy + dy, 1, 1, tones[0], alpha);
  }
}

/**
 * 日月的位置：按 daytime.ts 的 arc 从左边地平线升起、越过天顶、落到右边地平线（贴着远山，会被山挡住一部分）。
 * 画布贴底、可能比视口高（手机地址栏展开时顶上一截在屏幕外），高度按屏幕上实际看得到的部分算
 */
function orbAt(fr: Frame): [number, number] {
  const { W, H, day } = fr;
  const drift = fr.camX * 0.012; // 极慢的视差：天上的东西几乎不动
  const vis = Math.min(H, fr.visH);
  const low = H - GROUND - 34;
  const high = H - vis + Math.round(Math.max(12, vis * 0.12));
  const x = W * (0.1 + 0.8 * day.arc) - drift;
  const y = low - Math.sin(Math.PI * day.arc) * (low - high);
  return [Math.round(x), Math.round(y)];
}

export function drawSky(fr: Frame, stars: Star[]) {
  const { dl, W } = fr;
  const drift = fr.camX * 0.012;
  const [cx, cy] = orbAt(fr);
  dl.sun = [cx, cy];
  if (!fr.dark) {
    const g = fr.day.golden;
    orb(dl, cx, cy, 7, g > 0 ? SUN.map((c, i) => mix(c, SUNSET[i], g)) : SUN, 0.95);
    return;
  }
  for (const st of stars) {
    let x = (st.x - drift * 0.6) % W;
    if (x < 0) x += W;
    const tw = fr.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(fr.time * st.speed + st.phase);
    const a = (st.big ? 0.3 : 0.12) + tw * (st.big ? 0.3 : 0.22);
    const col = st.warm ? '#ffeccc' : '#dce4ff';
    const px = Math.floor(x);
    const py = Math.floor(st.y);
    dl.rect('sky', px, py, 1, 1, col, a);
    if (st.big && tw > 0.7) {
      const b = a * 0.4;
      dl.rect('sky', px - 1, py, 1, 1, col, b);
      dl.rect('sky', px + 1, py, 1, 1, col, b);
      dl.rect('sky', px, py - 1, 1, 1, col, b);
      dl.rect('sky', px, py + 1, 1, 1, col, b);
    }
  }
  orb(dl, cx, cy, 6, MOON, 0.95, true);
}
