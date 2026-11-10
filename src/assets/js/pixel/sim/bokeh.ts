/**
 * 失焦的光点（散景）：后排和镜头前飘着的几点光，渲染器画成六边形（光圈的形状）。
 * 夜里是萤火虫一样的暖黄、黄绿光点，白天只有镜头前几点被太阳照亮的浮尘，很淡。
 * 不存状态：每个光点的位置按编号和时间算，翻页时跟着自己那一层的视差走（和 backrow.ts、front.ts 的 SPEED 一致）。
 * 镜头前的光点停在一屏时靠两边，不压在卡片中间。
 */
import { GROUND } from './biomes.js';
import { hash } from './sprites.js';
import { smooth } from './util.js';
import type { Frame } from './frame.js';
import type { LayerName } from '../drawlist.js';

interface Kind {
  layer: LayerName;
  count: number;
  /** 视差：比主平面快多少 */
  speed: number;
  /** 半径范围（逻辑像素） */
  r: readonly [number, number];
  /** 离画布底边多高（逻辑像素），范围 */
  y: (H: number) => readonly [number, number];
  /** 不透明度：白天、夜里 */
  alpha: readonly [number, number];
}

const KINDS: Kind[] = [
  { layer: 'back', count: 12, speed: 0.85, r: [1.6, 2.8], y: () => [GROUND + 6, GROUND + 46], alpha: [0, 0.55] },
  { layer: 'front', count: 7, speed: 1.4, r: [5, 9], y: (H) => [8, H * 0.7], alpha: [0.1, 0.45] },
];
const NIGHT = ['#ffe36b', '#ffc46e', '#d9ff7a'];
const DAY = ['#fff6dc', '#ffffff'];

export function drawBokeh(fr: Frame) {
  const { dl, W, H, camX, dark } = fr;
  const t = fr.reduced ? 0 : fr.time;
  const span = W + 40;
  KINDS.forEach((k, ki) => {
    const alpha = k.alpha[dark ? 1 : 0];
    if (alpha <= 0) return;
    const [y0, y1] = k.y(H);
    for (let i = 0; i < k.count; i++) {
      const s = ki * 100 + i;
      const h = (j: number) => hash(s * 7 + j);
      // 慢慢往一边飘，翻页时按视差扫过去；出了一边从另一边回来
      const drift = (h(1) - 0.5) * 3;
      const raw = h(0) * span + t * drift - camX * k.speed;
      const x = (((raw % span) + span) % span) - 20;
      const y = H - (y0 + h(2) * (y1 - y0)) + Math.sin(t * (0.4 + h(3) * 0.4) + h(4) * 6.3) * 3;
      let a = alpha * (0.55 + 0.45 * Math.sin(t * (0.8 + h(5)) + h(6) * 6.3));
      if (k.layer === 'front') a *= smooth(0.18, 0.34, Math.abs(x / W - 0.5));
      if (a <= 0.01) continue;
      const pal = dark ? NIGHT : DAY;
      dl.bokeh.push({ layer: k.layer, x, y, r: k.r[0] + h(7) * (k.r[1] - k.r[0]), color: pal[Math.floor(h(8) * pal.length)], alpha: a });
    }
  });
}
