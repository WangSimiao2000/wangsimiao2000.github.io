/**
 * 天空：不抢内容，只是淡淡的一层。白天一轮太阳，夜里月亮和一片固定的星空。
 */
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

function disc(sk: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  sk.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    sk.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

/** 光晕：几圈逐级变淡的像素圆，台阶状的边缘和世界的像素颗粒一致 */
function skyHalo(sk: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, base: number) {
  for (let i = 3; i >= 1; i--) {
    sk.globalAlpha = base * (0.1 + (3 - i) * 0.07);
    disc(sk, cx, cy, r + i * 2, col);
  }
}

export function drawSky(fr: Frame, stars: Star[]) {
  const { sk, W, H } = fr;
  sk.clearRect(0, 0, W, H);
  const drift = fr.camX * 0.012; // 极慢的视差：天上的东西几乎不动
  const cx = Math.round(W * 0.87 - drift);
  const cy = Math.round(Math.max(12, H * 0.15));
  if (!fr.dark) {
    skyHalo(sk, cx, cy, 7, '#ffd58a', 0.6);
    sk.globalAlpha = 0.5;
    disc(sk, cx, cy, 7, '#ffd27e');
    disc(sk, cx - 1, cy - 1, 5, '#ffe2a2');
    disc(sk, cx - 2, cy - 2, 2, '#fff0c8');
    sk.globalAlpha = 1;
    return;
  }
  for (const st of stars) {
    let x = (st.x - drift * 0.6) % W;
    if (x < 0) x += W;
    const tw = fr.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(fr.time * st.speed + st.phase);
    sk.globalAlpha = (st.big ? 0.3 : 0.12) + tw * (st.big ? 0.3 : 0.22);
    sk.fillStyle = st.warm ? '#ffeccc' : '#dce4ff';
    const px = Math.floor(x);
    const py = Math.floor(st.y);
    sk.fillRect(px, py, 1, 1);
    if (st.big && tw > 0.7) {
      sk.globalAlpha *= 0.4;
      sk.fillRect(px - 1, py, 1, 1);
      sk.fillRect(px + 1, py, 1, 1);
      sk.fillRect(px, py - 1, 1, 1);
      sk.fillRect(px, py + 1, 1, 1);
    }
  }
  // 弯月：亮盘减去偏右上的一块
  skyHalo(sk, cx, cy, 6, '#c9d3ee', 0.35);
  sk.globalAlpha = 0.55;
  disc(sk, cx, cy, 6, '#eef1f8');
  disc(sk, cx - 1, cy - 1, 3, '#ffffff');
  sk.globalCompositeOperation = 'destination-out';
  sk.globalAlpha = 1;
  disc(sk, cx + 3, cy - 2, 5, '#000');
  sk.globalCompositeOperation = 'source-over';
  sk.globalAlpha = 1;
}
