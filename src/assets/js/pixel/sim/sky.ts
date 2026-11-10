/**
 * 天空：不抢内容，只是淡淡的一层。白天一轮太阳，夜里一轮月亮和一片固定的星空；日月都是纯色的像素圆。
 */
import type { DrawList, LayerName } from '../drawlist.js';
import type { Frame } from './frame.js';

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

/** 像素圆盘：逐行一条横线。按半径 r + 0.5 取宽度，顶上和底下是一段平边，不会冒出单独一个像素的尖 */
export function disc(dl: DrawList, layer: LayerName, cx: number, cy: number, r: number, col: string, alpha = 1) {
  const R = r + 0.5;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(R * R - y * y));
    dl.rect(layer, cx - w, cy + y, w * 2 + 1, 1, col, alpha);
  }
}

export function drawSky(fr: Frame, stars: Star[]) {
  const { dl, W, H } = fr;
  const drift = fr.camX * 0.012; // 极慢的视差：天上的东西几乎不动
  const cx = Math.round(W * 0.87 - drift);
  // 画布贴底、可能比视口高（手机地址栏展开时顶上一截在屏幕外），日月按屏幕上实际看得到的部分定位
  const vis = Math.min(H, fr.visH);
  const cy = H - vis + Math.round(Math.max(12, vis * 0.15));
  dl.sun = [cx, cy];
  if (!fr.dark) {
    disc(dl, 'sky', cx, cy, 7, '#ffd98a', 0.95);
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
  disc(dl, 'sky', cx, cy, 6, '#eef1f8', 0.95);
}
